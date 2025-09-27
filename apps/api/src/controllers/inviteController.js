import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { InterviewSession } from '../models/InterviewSession.js'
import {
    QUESTION_PLAN,
    broadcastSession,
    evaluateAnswer,
    finalizeSession,
    prepareQuestionsForSession,
    serializeSession,
} from '../services/interviewEngine.js'
import { extractResumeFields } from '../services/resumeParser.js'

const REQUIRED_FIELDS = ['name', 'email', 'phone']

const profileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(6).max(30).optional(),
})

const answerSchema = z.object({
    answer: z.string().optional(),
    durationMs: z.number().min(0).max(1000 * 60 * 10).optional(),
})

function computeMissingFields(session) {
    const missing = []
    const candidate = session.candidate || {}
    for (const field of REQUIRED_FIELDS) {
        if (!candidate[field]?.toString().trim()) {
            missing.push(field)
        }
    }
    if (!candidate.resume) {
        missing.push('resume')
    }
    session.missingFields = missing
    return missing
}

function ensureSessionActive(session) {
    if (!session) {
        const err = new Error('Session not found')
        err.status = 404
        throw err
    }
    if (session.status === 'expired') {
        const err = new Error('Session expired')
        err.status = 410
        throw err
    }
}

export async function bootstrapInvite(req, res) {
    const { token } = req.params

    const session = await InterviewSession.findOne({ inviteToken: token })
    ensureSessionActive(session)

    computeMissingFields(session)
    await session.save()

    res.json({
        session: serializeSession(session),
        plan: QUESTION_PLAN,
    })
}

export async function uploadResume(req, res) {
    const { token } = req.params
    const file = req.file

    if (!file) {
        return res.status(400).json({ message: 'Resume file is required' })
    }

    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
    ]

    if (!allowedTypes.includes(file.mimetype)) {
        await fs.unlink(file.path)
        return res.status(400).json({ message: 'Unsupported file type' })
    }

    const session = await InterviewSession.findOne({ inviteToken: token })
    ensureSessionActive(session)

    const buffer = await fs.readFile(file.path)
    const extracted = await extractResumeFields({ buffer, mimeType: file.mimetype })

    session.candidate = {
        ...(session.candidate || {}),
        name: session.candidate?.name || extracted.name,
        email: session.candidate?.email || extracted.email,
        phone: session.candidate?.phone || extracted.phone,
        resume: {
            originalName: file.originalname,
            storedName: path.basename(file.path),
            mimeType: file.mimetype,
            size: file.size,
        },
    }

    const missing = computeMissingFields(session)
    if (missing.length === 0) {
        session.status = session.status === 'completed' ? session.status : 'ready'
    } else {
        session.status = 'waiting-profile'
    }

    await session.save()
    broadcastSession(session)

    res.json({
        session: serializeSession(session),
        extracted,
    })
}

export async function updateProfile(req, res) {
    const { token } = req.params
    const payload = profileSchema.parse(req.body)

    const session = await InterviewSession.findOne({ inviteToken: token })
    ensureSessionActive(session)

    session.candidate = {
        ...(session.candidate || {}),
        ...payload,
        resume: session.candidate?.resume,
    }

    const missing = computeMissingFields(session)
    if (missing.length === 0 && session.status !== 'completed') {
        session.status = session.questions.length ? 'in-progress' : 'ready'
    } else if (missing.length > 0) {
        session.status = 'waiting-profile'
    }

    await session.save()
    broadcastSession(session)

    res.json({ session: serializeSession(session) })
}

export async function startInterview(req, res) {
    const { token } = req.params
    const session = await InterviewSession.findOne({ inviteToken: token })
    ensureSessionActive(session)

    const missing = computeMissingFields(session)
    if (missing.length > 0) {
        return res.status(400).json({ message: 'Profile incomplete', missingFields: missing })
    }

    if (session.status === 'completed') {
        return res.json({
            session: serializeSession(session),
            message: 'Interview already completed',
        })
    }

    await prepareQuestionsForSession(session)
    session.status = 'in-progress'
    session.chatTranscript.push({
        role: 'system',
        content: 'Interview started. Answer each question before the timer ends.',
        createdAt: new Date(),
    })

    await session.save()
    broadcastSession(session)

    const currentQuestion = session.questions[session.currentQuestionIndex]

    res.json({
        session: serializeSession(session),
        currentQuestion,
        deadline: session.currentQuestionDeadline,
        plan: QUESTION_PLAN,
    })
}

export async function submitAnswer(req, res) {
    const { token } = req.params
    const payload = answerSchema.parse({
        answer: req.body.answer,
        durationMs: Number(req.body.durationMs ?? 0),
    })

    const session = await InterviewSession.findOne({ inviteToken: token })
    ensureSessionActive(session)

    if (session.status !== 'in-progress') {
        return res.status(400).json({ message: 'Interview is not active' })
    }

    const { answer, durationMs = 0 } = payload

    const result = await evaluateAnswer(session, {
        answer: answer || '',
        durationMs,
    })

    if (result.isComplete) {
        await finalizeSession(session)
    }

    await session.save()
    broadcastSession(session)

    res.json({
        session: serializeSession(session),
        answer: result.answer,
        nextQuestion: result.nextQuestion,
        isComplete: result.isComplete,
        deadline: session.currentQuestionDeadline,
        finalScore: session.finalScore,
        finalSummary: session.finalSummary,
    })
}

export async function completeInterview(req, res) {
    const { token } = req.params
    const session = await InterviewSession.findOne({ inviteToken: token })
    ensureSessionActive(session)

    if (session.status === 'completed') {
        return res.json({ session: serializeSession(session) })
    }

    await finalizeSession(session)
    await session.save()
    broadcastSession(session)

    res.json({ session: serializeSession(session) })
}
