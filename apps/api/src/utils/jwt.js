import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
    console.warn('JWT_SECRET is not set. Using insecure fallback for development only.')
}

export function signAccessToken(payload, options = {}) {
    const secret = JWT_SECRET || 'dev-secret'
    return jwt.sign(payload, secret, {
        expiresIn: '7d',
        ...options,
    })
}

export function verifyAccessToken(token) {
    const secret = JWT_SECRET || 'dev-secret'
    return jwt.verify(token, secret)
}
