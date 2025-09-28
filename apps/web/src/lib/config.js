const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
    ? import.meta.env.VITE_SOCKET_URL
    : API_BASE_URL.replace(/\/api$/, '')

// Optional customizable application title (used in document.title / headers)
const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'AI Interview Assistant'

export { API_BASE_URL, SOCKET_URL, APP_TITLE }
