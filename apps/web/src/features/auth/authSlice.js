import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    token: null,
    interviewer: null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials(state, action) {
            state.token = action.payload.token
            state.interviewer = action.payload.interviewer
        },
        clearCredentials(state) {
            state.token = null
            state.interviewer = null
        },
    },
})

export const { setCredentials, clearCredentials } = authSlice.actions
export default authSlice.reducer
