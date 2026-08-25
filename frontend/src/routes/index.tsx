import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { UserRole } from '../types'
import { AuthLayout } from '../layouts/AuthLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { MainLayout } from '../layouts/MainLayout'

export function AuthGuard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { user, isLoading } = useAuth()

  console.log("[DEBUG-30] AUTH GUARD: isLoading=", isLoading, "user=", user?.role, "user exists=", !!user)

  // Show spinner only when we genuinely don't know auth state yet
  // (no cached user in localStorage either). Once user is restored from
  // storage, skip the spinner even if background validation is still running.
  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    console.log("[DEBUG-31] AUTH GUARD: No user, navigating to /login")
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.log("[DEBUG-32] AUTH GUARD: Role check failed, user.role=", user.role, "allowedRoles=", allowedRoles)
    return <Navigate to={user.role === UserRole.ADMIN ? '/admin/dashboard' : '/candidate/dashboard'} replace />
  }

  console.log("[DEBUG-33] AUTH GUARD: Rendering children")
  return <>{children}</>
}

export function PublicOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (user) {
    return <Navigate to={user.role === UserRole.ADMIN ? '/admin/dashboard' : '/candidate/dashboard'} replace />
  }

  return <>{children}</>
}

export function PublicLayoutRoutes({ allowPublicAccess = false }: { allowPublicAccess?: boolean }) {
  if (allowPublicAccess) {
    return (
      <PublicLayout>
        <Outlet />
      </PublicLayout>
    )
  }
  return (
    <AuthLayout>
      <PublicOnlyGuard>
        <Outlet />
      </PublicOnlyGuard>
    </AuthLayout>
  )
}

export function ProtectedLayoutRoutes() {
  return (
    <MainLayout>
      <AuthGuard>
        <Outlet />
      </AuthGuard>
    </MainLayout>
  )
}

export function AdminLayoutRoutes() {
  return (
    <MainLayout>
      <AuthGuard allowedRoles={[UserRole.ADMIN]}>
        <Outlet />
      </AuthGuard>
    </MainLayout>
  )
}