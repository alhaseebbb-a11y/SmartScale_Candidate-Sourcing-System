import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, UserRole } from '../types'
import { authApi } from '../api/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (firstName: string, lastName: string, email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => void
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string, confirmPassword: string) => Promise<void>
  hasRole: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user')
      const token = localStorage.getItem('access_token')

      if (!storedUser || !token) {
        setIsLoading(false)
        return
      }

      // Restore user from storage so protected pages render
      // while we validate in the background.
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        // Corrupted stored user JSON — clear and bail
        localStorage.removeItem('user')
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        setIsLoading(false)
        return
      }

      try {
        // Validate token with backend
        const userData = await authApi.me()
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
      } catch (error: any) {
        const status = error?.response?.status

        if (status === 401) {
          // Access token expired — try to refresh
          const refreshToken = localStorage.getItem('refresh_token')
          if (refreshToken) {
            try {
              const tokens = await authApi.refresh()
              localStorage.setItem('access_token', tokens.access_token)
              localStorage.setItem('refresh_token', tokens.refresh_token)
              const userData = await authApi.me()
              localStorage.setItem('user', JSON.stringify(userData))
              setUser(userData)
            } catch {
              // Refresh failed — keep the initially restored user so the
              // UI doesn't flash blank. The stored user from localStorage
              // is the best available state until the user logs in again.
              // Do NOT clear storage or setUser(null).
            }
          } else {
            // No refresh token — clear session
            localStorage.removeItem('user')
            localStorage.removeItem('access_token')
            setUser(null)
          }
        }
        // For non-401 errors (network down, 5xx) we leave the stored user
        // in place so the UI doesn't flash blank on a transient backend hiccup
      }

      setIsLoading(false)
    }
    initAuth()
  }, [])


  const login = async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password })
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    const userData = await authApi.me()
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    navigate(userData.role === UserRole.ADMIN ? '/admin/dashboard' : '/candidate/dashboard')
  }

  const register = async (firstName: string, lastName: string, email: string, password: string, confirmPassword: string) => {
    await authApi.register({ first_name: firstName, last_name: lastName, email, password, confirm_password: confirmPassword })
    await login(email, password)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }

  const forgotPassword = async (email: string) => {
    await authApi.forgotPassword({ email })
  }

  const resetPassword = async (token: string, newPassword: string, confirmPassword: string) => {
    await authApi.resetPassword({ token, new_password: newPassword, confirm_password: confirmPassword })
  }

  const hasRole = (roles: UserRole[]) => {
    return user ? roles.includes(user.role) : false
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, forgotPassword, resetPassword, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}