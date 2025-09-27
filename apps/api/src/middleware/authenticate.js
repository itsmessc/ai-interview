import { verifyAccessToken } from '../utils/jwt.js'
import { Interviewer } from '../models/Interviewer.js'

export async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Missing authorization header' })
        }

        const token = header.slice('Bearer '.length)
        const decoded = verifyAccessToken(token)
        const interviewer = await Interviewer.findById(decoded.sub).lean()
        if (!interviewer) {
            return res.status(401).json({ message: 'Invalid token' })
        }

        req.interviewer = {
            id: interviewer._id.toString(),
            name: interviewer.name,
            email: interviewer.email,
        }

        next()
    } catch (error) {
        console.error('Auth error', error)
        res.status(401).json({ message: 'Unauthorized' })
    }
}
