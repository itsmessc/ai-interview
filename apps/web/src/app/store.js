import { combineReducers, configureStore } from '@reduxjs/toolkit'
import {
    FLUSH,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER,
    REHYDRATE,
    persistReducer,
    persistStore,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import localforage from 'localforage'
import authReducer from '../features/auth/authSlice.js'
import interviewReducer from '../features/interviewee/interviewSlice.js'
import { setApiAuthToken } from '../lib/apiClient.js'

localforage.config({
    name: 'ai-interview-assistant',
})

const authPersistConfig = {
    key: 'auth',
    storage,
    whitelist: ['token', 'interviewer'],
}

const interviewPersistConfig = {
    key: 'interview',
    storage: localforage,
}

const rootReducer = combineReducers({
    auth: persistReducer(authPersistConfig, authReducer),
    interview: persistReducer(interviewPersistConfig, interviewReducer),
})

const persistedReducer = rootReducer

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
                ignoredPaths: ['interview.sessions'],
            },
        }),
})

export const persistor = persistStore(store)

let currentToken

setApiAuthToken(store.getState().auth.token)

store.subscribe(() => {
    const state = store.getState()
    const nextToken = state.auth.token
    if (currentToken !== nextToken) {
        currentToken = nextToken
        setApiAuthToken(nextToken)
    }
})
