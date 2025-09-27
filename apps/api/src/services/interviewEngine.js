import { v4 as uuidv4 } from 'uuid'
import { emitSessionUpdate } from '../realtime.js'
import { generateQuestionSet, scoreAnswerWithAi, summarizeWithAi } from './geminiService.js'

export const QUESTION_PLAN = [
    { difficulty: 'easy', timeLimitSeconds: 20 },
    { difficulty: 'easy', timeLimitSeconds: 20 },
    { difficulty: 'medium', timeLimitSeconds: 60 },
    { difficulty: 'medium', timeLimitSeconds: 60 },
    { difficulty: 'hard', timeLimitSeconds: 120 },
    { difficulty: 'hard', timeLimitSeconds: 120 },
]

export function getNextQuestionDeadline(seconds) {
    return new Date(Date.now() + seconds * 1000)
}

export async function prepareQuestionsForSession(session) {
    if (session.questions.length) {
        return session.questions
    }

    const candidateProfile = {
        name: session.candidate?.name,
        email: session.candidate?.email,
        phone: session.candidate?.phone,
    }

    const questionSet = await generateQuestionSet({
        plan: QUESTION_PLAN,
        candidateProfile,
    })

    session.questions = questionSet.map((item) => ({
        id: uuidv4(),
        prompt: item.question,
        difficulty: item.difficulty,
        timeLimitSeconds:
            QUESTION_PLAN.find((planItem) => planItem.difficulty === item.difficulty)?.timeLimitSeconds || 60,
    }))
    session.difficultySequence = QUESTION_PLAN.map((item) => item.difficulty)
    session.currentQuestionIndex = 0
    session.currentQuestionDeadline = getNextQuestionDeadline(session.questions[0].timeLimitSeconds)
    session.startedAt = new Date()

    return session.questions
}

export async function evaluateAnswer(session, { answer, durationMs }) {
    const currentIndex = session.currentQuestionIndex
    const question = session.questions[currentIndex]
    if (!question) {
        throw new Error('No active question')
    }

    const aiResult = await scoreAnswerWithAi({
        question: question.prompt,
        answer,
        difficulty: question.difficulty,
        candidateProfile: session.candidate,
    })

    const answerRecord = {
        questionId: question.id,
        candidateAnswer: answer || '',
        aiScore: aiResult.score,
        aiFeedback: aiResult.feedback,
        durationMs,
    }

    const existingIndex = session.answers.findIndex((item) => item.questionId === question.id)
    if (existingIndex >= 0) {
        session.answers[existingIndex] = answerRecord
    } else {
        session.answers.push(answerRecord)
    }

    session.chatTranscript.push(
        {
            role: 'candidate',
            content: answer?.trim() || '[No answer provided]',
            createdAt: new Date(),
        },
        {
            role: 'assistant',
            content: aiResult.feedback,
            createdAt: new Date(),
            metadata: { score: aiResult.score },
        },
    )

    session.currentQuestionIndex = currentIndex + 1

    if (session.currentQuestionIndex < session.questions.length) {
        const nextQuestion = session.questions[session.currentQuestionIndex]
        session.currentQuestionDeadline = getNextQuestionDeadline(nextQuestion.timeLimitSeconds)
    } else {
        session.currentQuestionDeadline = null
    }

    return {
        answer: answerRecord,
        isComplete: session.currentQuestionIndex >= session.questions.length,
        nextQuestion: session.questions[session.currentQuestionIndex] || null,
    }
}

export async function finalizeSession(session) {
    if (session.finalScore) {
        return {
            finalScore: session.finalScore,
            summary: session.finalSummary,
        }
    }

    const totalScore = session.answers.reduce((acc, item) => acc + (item.aiScore ?? 0), 0)
    const avgScore = session.answers.length ? totalScore / session.answers.length : 0
    session.finalScore = Number(avgScore.toFixed(1))

    const { summary, recommendation } = await summarizeWithAi({
        candidate: session.candidate,
        notes: session.notes,
        questions: session.questions,
        answers: session.answers,
        averageScore: avgScore,
    })

    session.finalSummary = summary
    session.completedAt = new Date()

    session.chatTranscript.push({
        role: 'assistant',
        content: `Interview complete. Final score: ${session.finalScore}/10. ${recommendation || ''}`.trim(),
        createdAt: new Date(),
    })

    session.status = 'completed'

    return {
        finalScore: session.finalScore,
        summary: session.finalSummary,
    }
}

export function broadcastSession(session) {
    emitSessionUpdate(session._id.toString(), 'session:update', serializeSession(session))
}

export function serializeSession(session) {
    return {
        id: session._id.toString(),
        status: session.status,
        inviteToken: session.inviteToken,
        interviewer: session.interviewer?.toString?.() || session.interviewer,
        candidate: session.candidate,
        missingFields: session.missingFields,
        questions: session.questions,
        answers: session.answers,
        chatTranscript: session.chatTranscript,
        currentQuestionIndex: session.currentQuestionIndex,
        currentQuestionDeadline: session.currentQuestionDeadline,
        difficultySequence: session.difficultySequence,
        finalScore: session.finalScore,
        finalSummary: session.finalSummary,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
    }
}
