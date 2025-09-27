import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const phoneRegex = /(\+?\d[\d\s\-()]{7,}\d)/

function extractLikelyName(lines) {
    const blacklist = ['email', 'phone', 'linkedin', 'github']

    for (const line of lines) {
        const lower = line.toLowerCase()
        if (blacklist.some((term) => lower.includes(term))) {
            continue
        }
        if (line.length < 2 || line.length > 80) {
            continue
        }
        if (/^[\d\W]+$/.test(line)) {
            continue
        }
        return line.replace(/[^A-Za-z\s'-]/g, ' ').replace(/\s+/g, ' ').trim()
    }
    return undefined
}

export async function extractResumeFields({ buffer, mimeType }) {
    let text
    if (mimeType === 'application/pdf') {
        const result = await pdfParse(buffer)
        text = result.text
    } else if (
        mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
    ) {
        const { value } = await mammoth.extractRawText({ buffer })
        text = value
    } else {
        throw new Error('Unsupported file type')
    }

    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    const emailMatch = text.match(emailRegex)
    const phoneMatch = text.match(phoneRegex)

    const name = extractLikelyName(lines)

    return {
        name,
        email: emailMatch ? emailMatch[0] : undefined,
        phone: phoneMatch ? phoneMatch[0] : undefined,
        rawText: text,
    }
}
