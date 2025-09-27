import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    bootstrapInvite,
    completeInterview,
    startInterview,
    submitAnswer,
    updateProfile,
    uploadResume,
} from '../controllers/inviteController.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../../uploads')

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`
        cb(null, unique)
    },
})

const upload = multer({
    storage,
    limits: {
        fileSize: 8 * 1024 * 1024, // 8MB max
    },
})

const inviteRouter = Router()

inviteRouter.get('/:token', bootstrapInvite)
inviteRouter.post('/:token/resume', upload.single('resume'), uploadResume)
inviteRouter.post('/:token/profile', updateProfile)
inviteRouter.post('/:token/start', startInterview)
inviteRouter.post('/:token/answers', submitAnswer)
inviteRouter.post('/:token/complete', completeInterview)

export { inviteRouter }
