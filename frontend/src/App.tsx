import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { PublicLayoutRoutes, ProtectedLayoutRoutes, AdminLayoutRoutes } from './routes'

// Auth pages
import { Login } from './features/auth/Login'
import { Register } from './features/auth/Register'
import { ForgotPassword } from './features/auth/ForgotPassword'
import { ResetPassword } from './features/auth/ResetPassword'
import { RootRedirect } from './features/auth/RootRedirect'

// Public pages
import { JobsIndex } from './features/jobs/Index'
import { JobDetail } from './features/jobs/Detail'

// Candidate pages
import { CandidateDashboard } from './features/candidate/Dashboard'
import { CandidateProfile } from './features/candidate/Profile'
import { CandidateApplications } from './features/candidate/Applications'
import { ApplicationDetail } from './features/candidate/ApplicationDetail'

// Admin pages
import { AdminDashboard } from './features/admin/Dashboard'
import { AdminJobs } from './features/admin/Jobs'
import { AdminJobDetail } from './features/admin/JobDetail'
import { AdminJobForm } from './features/admin/JobForm'
import { AdminApplications } from './features/admin/Applications'
import { AdminNotifications } from './features/admin/Notifications'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Truly public routes — accessible regardless of auth state */}
        <Route element={<PublicLayoutRoutes allowPublicAccess />}>
          <Route path="jobs" element={<JobsIndex />} />
          <Route path="jobs/:id" element={<JobDetail />} />
        </Route>

        {/* Auth-only pages — redirect to dashboard if already logged in */}
        <Route element={<PublicLayoutRoutes />}>
          <Route index element={<RootRedirect />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>

        {/* Candidate routes - use MainLayout with CANDIDATE guard */}
        <Route element={<ProtectedLayoutRoutes />}>
          <Route path="candidate/dashboard" element={<CandidateDashboard />} />
          <Route path="candidate/profile" element={<CandidateProfile />} />
          <Route path="candidate/applications" element={<CandidateApplications />} />
          <Route path="candidate/applications/:id" element={<ApplicationDetail />} />
        </Route>

        {/* Admin routes - use MainLayout with ADMIN guard */}
        <Route element={<AdminLayoutRoutes />}>
          <Route path="admin/dashboard" element={<AdminDashboard />} />
          <Route path="admin/jobs" element={<AdminJobs />} />
          <Route path="admin/jobs/create" element={<AdminJobForm />} />
          <Route path="admin/jobs/:id" element={<AdminJobDetail />} />
          <Route path="admin/jobs/:id/edit" element={<AdminJobForm />} />
          <Route path="admin/applications" element={<AdminApplications />} />
          <Route path="admin/notifications" element={<AdminNotifications />} />
        </Route>

        {/* Fallback - redirect to login for unknown routes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App