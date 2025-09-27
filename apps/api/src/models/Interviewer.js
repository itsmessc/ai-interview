import mongoose from 'mongoose'

const interviewerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, index: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: true },
)

export const Interviewer = mongoose.model('Interviewer', interviewerSchema)
