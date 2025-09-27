let genAi
const modelCache = new Map()

const apiKey = process.env.GEMINI_API_KEY
const configuredModel = process.env.GEMINI_MODEL?.trim()
const DEFAULT_MODEL = 'gemini-2.5-flash'
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash']

const MODEL_CANDIDATES = Array.from(
    new Set([
        configuredModel,
        DEFAULT_MODEL,
        ...FALLBACK_MODELS,
    ].filter(Boolean)),
)

async function getGenAi() {
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured')
    }
    if (!genAi) {
        const { GoogleGenAI } = await import('@google/genai')
        genAi = new GoogleGenAI({ apiKey })
    }
    return genAi
}

async function getModelByName(name) {
    const client = await getGenAi()

    if (!modelCache.has(name)) {
        // The new SDK uses a `models` service with a `generateContent` method.
        // We will pass the model name directly to the executor.
        modelCache.set(name, { name })
    }

    return modelCache.get(name)
}

function isUnsupportedModelError(error) {
    if (!error) return false
    // The new SDK might have different error messages/codes.
    // This is a guess based on common API responses.
    const message = error.message || ''
    return error.status === 404 || /not found|not supported|invalid model/i.test(message)
}

async function withModel(executor) {
    const errors = []
    const client = await getGenAi()

    for (const candidate of MODEL_CANDIDATES) {
        try {
            // Pass the model name directly to the executor
            return await executor(client, candidate)
        } catch (error) {
            errors.push({ model: candidate, error })

            if (isUnsupportedModelError(error)) {
                console.warn(
                    `Gemini model "${candidate}" is unsupported for this endpoint. Attempting fallback...`,
                )
                modelCache.delete(candidate)
                continue
            }

            throw error
        }
    }

    const lastError = errors.at(-1)?.error
    const summary = errors.map((item) => `${item.model}: ${item.error?.message}`).join(' | ')
    throw new Error(`Unable to use any Gemini model. Attempts: ${summary || 'none'}`, { cause: lastError })
}

function extractJsonFromResponse(text) {
    const match = text.match(/```json([\s\S]*?)```/)
    if (match) {
        return match[1]
    }
    const altMatch = text.match(/```([\s\S]*?)```/)
    if (altMatch) {
        return altMatch[1]
    }
    return text
}

export async function generateQuestionSet({ plan, candidateProfile }) {
    return withModel(async (client, modelName) => {
        const systemPrompt = `You are an AI interviewer focused on full-stack (React + Node.js). You must return exactly ${plan.length} interview questions as strict JSON with the shape {"questions":[{"difficulty":"easy|medium|hard","question":"text","timeLimitSeconds":60},...]}. Each question should assess practical skills, increasing in difficulty following the provided order. Avoid markdown in the response.`

        const difficultyHints = plan
            .map((slot, index) => `${index + 1}. Difficulty: ${slot.difficulty}`)
            .join('\n')

        const candidateContext = [candidateProfile.name, candidateProfile.email, candidateProfile.phone]
            .filter(Boolean)
            .join(', ')

        const response = await client.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `${systemPrompt}\n\nCandidate context: ${candidateContext || 'Unknown candidate'}\nDifficulty plan:\n${difficultyHints}`,
                        },
                    ],
                },
            ],
            generationConfig: { responseMimeType: 'application/json' },
        })

        const text = response.candidates[0].content.parts[0].text
        const rawJson = extractJsonFromResponse(text)
        const parsed = JSON.parse(rawJson)

        const questions = parsed.questions
        if (!Array.isArray(questions) || questions.length < plan.length) {
            throw new Error('Gemini response missing required questions array')
        }

        return plan.map((slot, index) => {
            const question = questions[index]
            if (typeof question?.question !== 'string' || !question.question.trim()) {
                throw new Error(`Gemini response missing question text for index ${index}`)
            }
            return {
                question: question.question,
                difficulty: slot.difficulty,
                timeLimitSeconds: question.timeLimitSeconds || 60,
            }
        })
    })
}

export async function scoreAnswerWithAi({
    question,
    answer,
    difficulty,
    candidateProfile,
}) {
    return withModel(async (client, modelName) => {
        const response = await client.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `You are grading a full-stack interview answer. Provide JSON with keys score (0-10 integer) and feedback (short constructive text).\nQuestion (${difficulty}): ${question}\nCandidate: ${JSON.stringify(candidateProfile)}\nAnswer: ${answer || '<<blank>>'}`,
                        },
                    ],
                },
            ],
            generationConfig: { responseMimeType: 'application/json' },
        })

        const text = response.candidates[0].content.parts[0].text
        const parsed = JSON.parse(extractJsonFromResponse(text))

        if (parsed == null || parsed.score === undefined) {
            throw new Error('Gemini response missing score field')
        }

        const numericScore = Number.parseFloat(parsed.score)
        const safeScore = Number.isFinite(numericScore) ? Math.max(0, Math.min(10, numericScore)) : 0

        return {
            score: safeScore,
            feedback: parsed.feedback || 'Score generated by AI.',
        }
    })
}

export async function summarizeWithAi({ candidate, questions, answers, averageScore }) {
    return withModel(async (client, modelName) => {
        const qaPairs = questions.map((question, index) => ({
            question: question.prompt || question.question,
            difficulty: question.difficulty,
            answer: answers[index]?.candidateAnswer || '',
            score: answers[index]?.aiScore ?? null,
            feedback: answers[index]?.aiFeedback || '',
        }))

        const response = await client.models.generateContent({
            model: modelName,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Provide a concise (<= 120 words) JSON summary with keys summary (string) and recommendation (string). Do not include markdown.\nCandidate: ${JSON.stringify(candidate)}\nAverage score: ${averageScore.toFixed(2)}\nQA pairs: ${JSON.stringify(qaPairs)}`,
                        },
                    ],
                },
            ],
            generationConfig: { responseMimeType: 'application/json' },
        })

        const text = response.candidates[0].content.parts[0].text
        const parsed = JSON.parse(extractJsonFromResponse(text))

        if (!parsed || typeof parsed.summary !== 'string') {
            throw new Error('Gemini response missing summary')
        }

        return {
            summary: parsed.summary,
            recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
        }
    })
}
