import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminJobsApi } from '../../api/admin'
import { adminApplicationsApi } from '../../api/admin'
import { Job, AdminApplicationDetail, Application } from '../../types'
import { Card, CardHeader, CardBody, Badge, Button } from '../../components/ui'

export function AdminDashboard() {
  const { data: jobs } = useQuery({
    queryKey: ['adminJobs', { page: 1, page_size: 5 }],
    queryFn: () => adminJobsApi.list({ page: 1, page_size: 5 }),
    staleTime: 30000,
  })

  const { data: applications } = useQuery({
    queryKey: ['adminApplications', { page: 1, page_size: 5 }],
    queryFn: () => adminApplicationsApi.list({ page: 1, page_size: 5 }),
    staleTime: 30000,
  })

  const jobItems = jobs?.items ?? []
  const appItems = applications?.items ?? []

  const stats = {
    totalJobs: jobs?.total ?? 0,
    publishedJobs: jobItems.filter((j: Job) => j.status === 'PUBLISHED').length,
    draftJobs: jobItems.filter((j: Job) => j.status === 'DRAFT').length,
    totalApplications: applications?.total ?? 0,
    newApplications: appItems.filter((a: Application) => a.status === 'NEW').length,
    shortlistedApplications: appItems.filter((a: Application) => a.status === 'SHORTLISTED').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your recruitment platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Total Jobs</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalJobs}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Published</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{stats.publishedJobs}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Draft</p>
            <p className="text-3xl font-bold text-gray-600 mt-1">{stats.draftJobs}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">Total Applications</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalApplications}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
            <Link to="/admin/jobs" className="text-sm text-indigo-600 hover:text-indigo-500">View All</Link>
          </CardHeader>
          <CardBody className="p-0">
            {jobItems.length === 0 ? (
              <div className="p-6 text-center text-gray-600">No jobs created yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {jobItems.map((job: Job) => (
                  <Link key={job.id} to={`/admin/jobs/${job.id}`} className="block p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-600">{job.department} • {job.location}</p>
                    </div>
                    <Badge variant={job.status.toLowerCase() as any}>{job.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
            <Link to="/admin/applications" className="text-sm text-indigo-600 hover:text-indigo-500">View All</Link>
          </CardHeader>
          <CardBody className="p-0">
            {appItems.length === 0 ? (
              <div className="p-6 text-center text-gray-600">No applications yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {appItems.map((app: Application) => (
                  <Link key={app.id} to={`/admin/applications/${app.id}`} className="block p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{app.candidate_name}</h3>
                      <p className="text-sm text-gray-600">{app.job_title || 'Unknown Position'}</p>
                    </div>
                    <Badge variant={app.status.toLowerCase() as any}>{app.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-4">
            <Link to="/admin/jobs" className="btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Job Posting
            </Link>
            <Link to="/admin/applications" className="btn-secondary">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Review Applications
            </Link>
            <Link to="/admin/notifications" className="btn-secondary">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              View Notifications
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}