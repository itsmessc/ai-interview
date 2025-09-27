import mongoose from 'mongoose'

const { Schema } = mongoose

const resumeSchema = new Schema(
    {
        originalName: String,
        storedName: String,
        mimeType: String,
        size: Number,
        uploadedAt: { type: Date, default: Date.now },
    },
    { _id: false },
)

const questionSchema = new Schema(
    {
        id: { type: String, required: true },
        prompt: { type: String, required: true },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard'],
            required: true,
        },
        timeLimitSeconds: { type: Number, required: true },
    },
    { _id: false },
)

const answerSchema = new Schema(
    {
        questionId: { type: String, required: true },
        candidateAnswer: { type: String, default: '' },
        aiScore: { type: Number },
        aiFeedback: { type: String },
        durationMs: { type: Number },
        submittedAt: { type: Date, default: Date.now },
    },
    { _id: false },
)

const chatSchema = new Schema(
    {
        role: {
            type: String,
            enum: ['system', 'assistant', 'candidate'],
            required: true,
        },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        metadata: { type: Schema.Types.Mixed },
    },
    { _id: false },
)

const interviewSessionSchema = new Schema(
    {
        interviewer: { type: Schema.Types.ObjectId, ref: 'Interviewer', required: true },
        inviteToken: { type: String, required: true, unique: true, index: true },
        status: {
            type: String,
            enum: ['created', 'waiting-profile', 'ready', 'in-progress', 'completed', 'expired'],
            default: 'created',
        },
        candidate: {
            name: String,
            email: String,
            phone: String,
            resume: resumeSchema,
        },
        notes: { type: String },
        missingFields: { type: [String], default: [] },
        questions: { type: [questionSchema], default: [] },
        answers: { type: [answerSchema], default: [] },
        chatTranscript: { type: [chatSchema], default: [] },
        currentQuestionIndex: { type: Number, default: 0 },
        currentQuestionDeadline: { type: Date },
        difficultySequence: { type: [String], default: [] },
        finalScore: Number,
        finalSummary: String,
        startedAt: Date,
        completedAt: Date,
    },
    { timestamps: true },
)

export const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema)
