import crypto from 'node:crypto'

let genAi
let generativeModel

const apiKey = process.env.GEMINI_API_KEY
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro'

async function ensureModel() {
    if (!apiKey) {
        return null
    }

    if (!genAi) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        genAi = new GoogleGenerativeAI(apiKey)
    }

    if (!generativeModel) {
        generativeModel = genAi.getGenerativeModel({ model: modelName })
    }

    return generativeModel
}

function extractJsonFromResponse(text) {
    const match = text.match(/```json([\s\S]*?)```/)
    if (match) {
        return match[1]
    }
    const altMatch = text.match(/```([\s\S]*?)```/)
    if (altMatch) {
        return altMatch[1]
    }
    return text
}

const fallbackBank = {
    easy: [
        'Explain the purpose of React hooks and give one example.',
        'What is the difference between == and === in JavaScript?',
        'How does destructuring assignment work in ES6?',
    ],
    medium: [
        'Describe how you would structure state management in a mid-sized React application.',
        'How do you design a REST API in Node.js that supports pagination and filtering?',
        'Explain how context and prop drilling differ in React applications.',
    ],
    hard: [
        'Walk through optimizing a React app that suffers from repeated re-renders in a complex component tree.',
        'Design a scalable architecture for uploading large files in a Node.js/Express backend.',
        'Explain how you would secure an SSR React application with role-based access control end-to-end.',
    ],
}

function fallbackQuestion({ difficulty, seed }) {
    const bank = fallbackBank[difficulty]
    const index = seed % bank.length
    return bank[index]
}

export async function generateQuestionSet({ plan, candidateProfile }) {
    const model = await ensureModel()

    if (!model) {
        const seed = Number.parseInt(crypto.createHash('sha1').update(candidateProfile.email || candidateProfile.name || Date.now().toString()).digest('hex').slice(0, 8), 16)
        return plan.map((slot, i) => ({
            question: fallbackQuestion({ difficulty: slot.difficulty, seed: seed + i }),
            difficulty: slot.difficulty,
        }))
    }

    const systemPrompt = `You are an AI interviewer focused on full-stack (React + Node.js). You must return exactly ${plan.length} interview questions as strict JSON with the shape {"questions":[{"difficulty":"easy|medium|hard","question":"text"},...]}. Each question should assess practical skills, increasing in difficulty following the provided order. Avoid markdown in the response.`

    const difficultyHints = plan
        .map((slot, index) => `${index + 1}. Difficulty: ${slot.difficulty} (time limit ${slot.timeLimitSeconds}s)`)
        .join('\n')

    const candidateContext = [candidateProfile.name, candidateProfile.email, candidateProfile.phone]
        .filter(Boolean)
        .join(', ')

    const { response } = await model.generateContent({
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `${systemPrompt}\n\nCandidate context: ${candidateContext || 'Unknown candidate'}\nDifficulty plan:\n${difficultyHints}`,
                    },
                ],
            },
        ],
        generationConfig: { responseMimeType: 'application/json' },
    })

    const text = response.text()
    const rawJson = extractJsonFromResponse(text)
    const parsed = JSON.parse(rawJson)

    const questions = parsed.questions || []
    return plan.map((slot, index) => ({
        question: questions[index]?.question || fallbackQuestion({ difficulty: slot.difficulty, seed: index }),
        difficulty: slot.difficulty,
    }))
}

export async function scoreAnswerWithAi({
    question,
    answer,
    difficulty,
    candidateProfile,
}) {
    const model = await ensureModel()

    if (!model) {
        const sanitized = (answer || '').trim()
        const lengthScore = Math.min(10, Math.round((sanitized.length / 200) * 10))
        const completenessBonus = sanitized.includes('React') || sanitized.includes('Node') ? 1 : 0
        const score = Math.min(10, Math.max(2, lengthScore + completenessBonus))
        return {
            score,
            feedback: sanitized
                ? `Fallback scoring: answer length implies score ${score}/10.`
                : 'Fallback scoring: no answer provided, score 2/10.',
        }
    }

    const { response } = await model.generateContent({
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `You are grading a full-stack interview answer. Provide JSON with keys score (0-10 integer) and feedback (short constructive text).\nQuestion (${difficulty}): ${question}\nCandidate: ${JSON.stringify(candidateProfile)}\nAnswer: ${answer || '<<blank>>'}`,
                    },
                ],
            },
        ],
        generationConfig: { responseMimeType: 'application/json' },
    })

    const text = response.text()
    const parsed = JSON.parse(extractJsonFromResponse(text))

    const numericScore = Number.parseFloat(parsed.score)
    const safeScore = Number.isFinite(numericScore) ? Math.max(0, Math.min(10, numericScore)) : 0

    return {
        score: safeScore,
        feedback: parsed.feedback || 'Score generated by AI.',
    }
}

export async function summarizeWithAi({ candidate, questions, answers, averageScore }) {
    const model = await ensureModel()

    if (!model) {
        return {
            summary: `Candidate ${candidate.name || candidate.email || 'Unknown'} completed the interview with an average score of ${averageScore.toFixed(1)}. Fallback summary available only in development mode.`,
        }
    }

    const qaPairs = questions.map((question, index) => ({
        question: question.prompt || question.question,
        difficulty: question.difficulty,
        answer: answers[index]?.candidateAnswer || '',
        score: answers[index]?.aiScore ?? null,
        feedback: answers[index]?.aiFeedback || '',
    }))

    const { response } = await model.generateContent({
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `Provide a concise (<= 120 words) JSON summary with keys summary (string) and recommendation (string). Do not include markdown.\nCandidate: ${JSON.stringify(candidate)}\nAverage score: ${averageScore.toFixed(2)}\nQA pairs: ${JSON.stringify(qaPairs)}`,
                    },
                ],
            },
        ],
        generationConfig: { responseMimeType: 'application/json' },
    })

    const parsed = JSON.parse(extractJsonFromResponse(response.text()))

    return {
        summary: parsed.summary || 'Summary not available.',
        recommendation: parsed.recommendation || '',
    }
}
