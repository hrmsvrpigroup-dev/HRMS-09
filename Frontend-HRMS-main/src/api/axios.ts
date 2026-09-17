import axios from 'axios'

import { useAuthStore } from '../store/auth.store'

const LIVE_API_URL = 'https://hrms-09.onrender.com/api'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || LIVE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Track if a refresh is already in progress to avoid multiple simultaneous refresh calls
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config

    if (!originalRequest) {
      return Promise.reject(error)
    }

    // 1. Retry network errors, 502, 503, 504 (e.g. Render waking up from cold start)
    const isNetworkOrGatewayError =
      !error.response ||
      error.code === 'ERR_NETWORK' ||
      [502, 503, 504].includes(error.response?.status)

    if (isNetworkOrGatewayError && (originalRequest._retryCount || 0) < 2) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1
      const delayMs = originalRequest._retryCount * 1500
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return api(originalRequest)
    }

    // 2. Only attempt refresh on 401, and not on the refresh/login endpoints themselves
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      const { refreshToken, setAuth, logout, user } = useAuthStore.getState()

      if (!refreshToken) {
        logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || LIVE_API_URL}/auth/refresh`,
          { refreshToken }
        )
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data

        // Update store with new tokens (keep existing user object)
        if (user) {
          setAuth(user, newAccessToken, newRefreshToken)
        }

        processQueue(null, newAccessToken)
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
