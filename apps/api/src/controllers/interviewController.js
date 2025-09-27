import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { InterviewSession } from '../models/InterviewSession.js'
import { buildInviteUrl } from '../utils/url.js'
import { QUESTION_PLAN, serializeSession } from '../services/interviewEngine.js'

const createInterviewSchema = z.object({
    candidateName: z.string().min(2).max(100).optional(),
    candidateEmail: z.string().email(),
    candidatePhone: z.string().min(6).max(30).optional(),
    notes: z.string().max(500).optional(),
})

const listQuerySchema = z.object({
    search: z.string().optional(),
    sort: z.enum(['score', 'recent']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
})

function computeMissingFields({ name, email, phone }) {
    const missing = []
    if (!name) missing.push('name')
    if (!email) missing.push('email')
    if (!phone) missing.push('phone')
    missing.push('resume')
    return missing
}

function toSummary(session) {
    return {
        id: session._id.toString(),
        candidate: session.candidate,
        status: session.status,
        finalScore: session.finalScore,
        finalSummary: session.finalSummary,
        notes: session.notes,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        inviteToken: session.inviteToken,
        inviteUrl: buildInviteUrl(session.inviteToken),
        questionCount: session.questions.length || QUESTION_PLAN.length,
    }
}

export async function createInterview(req, res) {
    const payload = createInterviewSchema.parse(req.body)

    const inviteToken = uuidv4()

    const session = await InterviewSession.create({
        interviewer: req.interviewer.id,
        inviteToken,
        status: 'waiting-profile',
        candidate: {
            name: payload.candidateName,
            email: payload.candidateEmail,
            phone: payload.candidatePhone,
        },
        missingFields: computeMissingFields({
            name: payload.candidateName,
            email: payload.candidateEmail,
            phone: payload.candidatePhone,
        }),
        difficultySequence: QUESTION_PLAN.map((item) => item.difficulty),
        notes: payload.notes,
    })

    res.status(201).json({
        session: serializeSession(session),
        inviteUrl: buildInviteUrl(inviteToken),
    })
}

export async function listInterviews(req, res) {
    const query = listQuerySchema.parse(req.query)
    const filter = { interviewer: req.interviewer.id }

    if (query.search) {
        const searchRegex = new RegExp(query.search, 'i')
        filter.$or = [
            { 'candidate.name': searchRegex },
            { 'candidate.email': searchRegex },
            { 'candidate.phone': searchRegex },
        ]
    }

    let sort = { finalScore: -1, createdAt: -1 }

    if (query.sort === 'recent') {
        sort = { createdAt: query.order === 'asc' ? 1 : -1 }
    } else if (query.sort === 'score') {
        sort = { finalScore: query.order === 'asc' ? 1 : -1, createdAt: -1 }
    }

    const sessions = await InterviewSession.find(filter).sort(sort)

    res.json({
        sessions: sessions.map(toSummary),
    })
}

export async function getInterview(req, res) {
    const { id } = req.params

    const session = await InterviewSession.findOne({
        _id: id,
        interviewer: req.interviewer.id,
    })

    if (!session) {
        return res.status(404).json({ message: 'Interview not found' })
    }

    res.json({ session: serializeSession(session) })
}
