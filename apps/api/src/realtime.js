import { Server } from 'socket.io'

let io

const clientOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173']

export function initRealtime(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: clientOrigins,
            credentials: true,
        },
    })

    io.on('connection', (socket) => {
        console.log('Socket connected', socket.id)

        socket.on('join-session', ({ sessionId }) => {
            if (sessionId) {
                socket.join(`session:${sessionId}`)
            }
        })

        socket.on('leave-session', ({ sessionId }) => {
            if (sessionId) {
                socket.leave(`session:${sessionId}`)
            }
        })
    })

    return io
}

export function emitSessionUpdate(sessionId, event, payload) {
    if (!io) return
    io.to(`session:${sessionId}`).emit(event, payload)
}

export function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialised yet')
    }
    return io
}
