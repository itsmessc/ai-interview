export const selectActiveInterviewToken = (state) => state.interview.activeToken

export const selectInterviewStateByToken = (state, token) =>
    token ? state.interview.sessions[token] || null : null

export const selectActiveInterviewState = (state) =>
    selectInterviewStateByToken(state, selectActiveInterviewToken(state))
