import axios from 'axios'

/**
 * Single Axios instance. Every REST call in the app goes through here so that
 * MSW has exactly one surface to intercept and so auth/error handling lives in
 * one place. Never call fetch() directly in features.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})
