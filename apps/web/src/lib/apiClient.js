import axios from 'axios'
import { API_BASE_URL } from './config'

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
})

export function setApiAuthToken(token) {
    if (token) {
        apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
    } else {
        delete apiClient.defaults.headers.common.Authorization
    }
}
