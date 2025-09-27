const defaultOrigin = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',')[0].trim()
    : 'http://localhost:5173'

export function buildInviteUrl(token) {
    const origin = defaultOrigin.endsWith('/') ? defaultOrigin.slice(0, -1) : defaultOrigin
    return `${origin}/invite/${token}`
}
