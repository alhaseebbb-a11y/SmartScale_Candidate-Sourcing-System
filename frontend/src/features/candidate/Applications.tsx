import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { candidateApi } from '../../api/candidate'
import type { Application, ApplicationStatus } from '../../types'
import { Button, Card, CardBody, Badge, Table, Pagination } from '../../components/ui'

const STATUS_BADGE_MAP: Record<ApplicationStatus, 'new' | 'reviewed' | 'shortlisted' | 'rejected'> = {
  NEW: 'new',
  REVIEWED: 'reviewed',
  SHORTLISTED: 'shortlisted',
  REJECTED: 'rejected',
}

export function CandidateApplications() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const pageSize = 10

  const { data, isLoading } = useQuery({
    queryKey: ['candidateApplications', page, pageSize],
    queryFn: () => candidateApi.listApplications({ page, page_size: pageSize }),
    placeholderData: (previous) => previous,
  })

  const columns = [
    { key: 'job_title', header: 'Job', render: (app: Application) => <Link to={`/candidate/applications/${app.id}`} className="font-medium text-indigo-600 hover:text-indigo-500">{app.job_title || 'Unknown Position'}</Link> },
    { key: 'application_number', header: 'Application #', render: (app: Application) => <span className="font-mono text-sm">{app.application_number}</span> },
    { key: 'status', header: 'Status', render: (app: Application) => <Badge variant={STATUS_BADGE_MAP[app.status]}>{app.status}</Badge> },
    { key: 'applied_at', header: 'Applied On', render: (app: Application) => new Date(app.applied_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-600 mt-1">Track the status of your applications</p>
        </div>
        <Link to="/jobs" className="btn-primary self-start">
          Browse More Jobs
        </Link>
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading && !data ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto" />
              <p className="mt-4 text-gray-600">Loading applications...</p>
            </div>
          ) : data?.items.length === 0 ? (
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
            <>
              <Table
                data={data!.items}
                columns={columns}
                keyExtractor={(app) => app.id}
                emptyMessage="No applications found"
              />
              {data && data.pages > 1 && (
                <Pagination
                  currentPage={page}
                  totalPages={data.pages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}