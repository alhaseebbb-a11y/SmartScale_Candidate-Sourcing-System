import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { candidateApi } from '../../api/candidate'
import { Application } from '../../types'
import { Card, CardHeader, CardBody, Badge, Button } from '../../components/ui'

const STATUS_BADGE_MAP: Record<string, 'new' | 'reviewed' | 'shortlisted' | 'rejected'> = {
  NEW: 'new',
  REVIEWED: 'reviewed',
  SHORTLISTED: 'shortlisted',
  REJECTED: 'rejected',
}

export function CandidateDashboard() {
  const { data: applications, isLoading } = useQuery({
    queryKey: ['candidateApplications'],
    queryFn: () => candidateApi.listApplications({ page: 1, page_size: 5 }),
  })

  const { data: profile } = useQuery({
    queryKey: ['candidateProfile'],
    queryFn: candidateApi.getProfile,
  })

  const stats = {
    total: applications?.total || 0,
    pending: applications?.items.filter((a) => a.status === 'NEW' || a.status === 'REVIEWED').length || 0,
    shortlisted: applications?.items.filter((a) => a.status === 'SHORTLISTED').length || 0,
    rejected: applications?.items.filter((a) => a.status === 'REJECTED').length || 0,
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardBody className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-1/4" />
            </CardBody>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {profile?.first_name || 'Candidate'}!</p>
        </div>
        <Link to="/jobs" className="btn-primary self-start">
          Browse Jobs
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Total Applications</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Pending Review</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{stats.pending}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Shortlisted</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{stats.shortlisted}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Rejected</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected}</p>
          </CardBody>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
          <Link to="/candidate/applications" className="text-sm text-indigo-600 hover:text-indigo-500">
            View All
          </Link>
        </CardHeader>
        <CardBody className="p-0">
          {applications?.items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No applications yet</h3>
              <p className="mt-2 text-gray-600">Start applying to jobs to see them here</p>
              <Link to="/jobs" className="mt-4 inline-block btn-primary">
                Browse Jobs
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {applications!.items.map((app: Application) => (
                <Link
                  key={app.id}
                  to={`/candidate/applications/${app.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900 truncate">{app.job_title || 'Job'}</h3>
                      <Badge variant={STATUS_BADGE_MAP[app.status] || 'default'}>
                        {app.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Applied on {new Date(app.applied_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      {app.application_number && ` • ${app.application_number}`}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/jobs" className="card hover:shadow-md transition-shadow p-6 text-center">
              <svg className="mx-auto h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-3 font-medium text-gray-900">Browse Jobs</h3>
              <p className="mt-1 text-sm text-gray-600">Explore new opportunities</p>
            </Link>
            <Link to="/candidate/profile" className="card hover:shadow-md transition-shadow p-6 text-center">
              <svg className="mx-auto h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="mt-3 font-medium text-gray-900">Update Profile</h3>
              <p className="mt-1 text-sm text-gray-600">Keep your profile current</p>
            </Link>
            <Link to="/candidate/applications" className="card hover:shadow-md transition-shadow p-6 text-center">
              <svg className="mx-auto h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-3 font-medium text-gray-900">View Applications</h3>
              <p className="mt-1 text-sm text-gray-600">Track your applications</p>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}