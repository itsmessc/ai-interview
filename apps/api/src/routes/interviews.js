import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import {
    createInterview,
    getInterview,
    listInterviews,
} from '../controllers/interviewController.js'

const interviewsRouter = Router()

interviewsRouter.use(authenticate)

interviewsRouter.get('/', listInterviews)
interviewsRouter.post('/', createInterview)
interviewsRouter.get('/:id', getInterview)

export { interviewsRouter }
