import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function RootRedirect() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  // If user is authenticated, redirect to appropriate dashboard
  if (user) {
    const redirectPath = user.role === 'ADMIN' ? '/admin/dashboard' : '/candidate/dashboard'
    // Preserve any intended redirect from state
    const from = location.state?.from?.pathname || redirectPath
    return <Navigate to={from} replace />
  }

  // Not authenticated, redirect to login
  return <Navigate to="/login" replace state={{ from: location }} />
}