import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { authRouter } from './routes/auth.js'
import { interviewsRouter } from './routes/interviews.js'
import { inviteRouter } from './routes/invite.js'

const app = express()

const clientOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173']

app.use(
    cors({
        origin: clientOrigins,
        credentials: true,
    }),
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../uploads')
app.use('/uploads', express.static(uploadsDir))

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }))

app.use('/api/auth', authRouter)
app.use('/api/interviews', interviewsRouter)
app.use('/api/invite', inviteRouter)

app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled error', err)

    if (err.name === 'ZodError') {
        return res.status(400).json({
            message: 'Validation failed',
            issues: err.issues,
        })
    }

    const status = err.status || 500
    res.status(status).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    })
})

export { app }
