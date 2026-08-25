import axios from 'axios'
import api from './axiosInstance'
import type { TokenPair, User } from '../types'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm_password: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  new_password: string
  confirm_password: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1'

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenPair> => {
    const response = await api.post('/auth/login', data)
    return response.data
  },

  sendEmailOtp: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/send-email-otp', { email })
    return response.data
  },

  verifyEmailOtp: async (email: string, otp: string): Promise<{ verified: boolean; message: string }> => {
    const response = await api.post('/auth/verify-email-otp', { email, otp })
    return response.data
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await api.post('/auth/register', data)
    return response.data
  },

  refresh: async (): Promise<TokenPair> => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) throw new Error('No refresh token')
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    })
    return response.data
  },

  me: async (): Promise<User> => {
    const response = await api.get('/auth/me')
    return response.data
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', data)
    return response.data
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', data)
    return response.data
  },
}