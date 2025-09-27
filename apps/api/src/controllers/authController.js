import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Interviewer } from '../models/Interviewer.js'
import { signAccessToken } from '../utils/jwt.js'

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
})

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
})

function toInterviewerDto(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        email: doc.email,
    }
}

export async function login(req, res) {
    const { email, password } = loginSchema.parse(req.body)

    const interviewer = await Interviewer.findOne({ email })
    if (!interviewer) {
        return res.status(401).json({ message: 'Invalid credentials' })
    }

    const match = await bcrypt.compare(password, interviewer.passwordHash)
    if (!match) {
        return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = signAccessToken({ sub: interviewer._id.toString(), email })

    res.json({
        token,
        interviewer: toInterviewerDto(interviewer),
    })
}

export async function register(req, res) {
    const { name, email, password } = registerSchema.parse(req.body)

    const exists = await Interviewer.findOne({ email })
    if (exists) {
        return res.status(409).json({ message: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const interviewer = await Interviewer.create({ name, email, passwordHash })

    const token = signAccessToken({ sub: interviewer._id.toString(), email })

    res.status(201).json({ token, interviewer: toInterviewerDto(interviewer) })
}

export async function me(req, res) {
    res.json({ interviewer: req.interviewer })
}
