import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { login, me, register } from '../controllers/authController.js'

const authRouter = Router()

authRouter.post('/login', login)
authRouter.post('/register', register)
authRouter.get('/me', authenticate, me)

export { authRouter }
