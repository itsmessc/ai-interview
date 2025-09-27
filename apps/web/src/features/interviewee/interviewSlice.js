import { createSlice } from '@reduxjs/toolkit'

const defaultSessionState = () => ({
    session: null,
    plan: null,
    deadline: null,
    welcomeBackSeen: false,
    extractedFields: null,
    lastVisitedAt: null,
})

const initialState = {
    activeToken: null,
    sessions: {},
}

const interviewSlice = createSlice({
    name: 'interview',
    initialState,
    reducers: {
        setActiveToken(state, action) {
            state.activeToken = action.payload
            if (action.payload && !state.sessions[action.payload]) {
                state.sessions[action.payload] = defaultSessionState()
            }
        },
        upsertSessionState(state, action) {
            const { token, session, plan, deadline, extractedFields } = action.payload
            if (!state.sessions[token]) {
                state.sessions[token] = defaultSessionState()
            }
            if (session) state.sessions[token].session = session
            if (plan) state.sessions[token].plan = plan
            if (deadline !== undefined) state.sessions[token].deadline = deadline
            if (extractedFields !== undefined) state.sessions[token].extractedFields = extractedFields
            state.sessions[token].lastVisitedAt = Date.now()
        },
        markWelcomeBackSeen(state, action) {
            const token = action.payload
            if (state.sessions[token]) {
                state.sessions[token].welcomeBackSeen = true
            }
        },
        resetSessionState(state, action) {
            const token = action.payload
            if (token) {
                delete state.sessions[token]
            }
            if (state.activeToken === token) {
                state.activeToken = null
            }
        },
    },
})

export const {
    setActiveToken,
    upsertSessionState,
    markWelcomeBackSeen,
    resetSessionState,
} = interviewSlice.actions

export default interviewSlice.reducer
