import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminJobsApi } from '../../api/admin'
import { AdminJob, JobStatus, EmploymentType } from '../../types'
import { Button, Badge, Card, CardHeader, CardBody, CardFooter } from '../../components/ui'

const STATUS_BADGE_MAP: Record<JobStatus, 'draft' | 'published' | 'closed'> = {
  [JobStatus.DRAFT]: 'draft',
  [JobStatus.PUBLISHED]: 'published',
  [JobStatus.CLOSED]: 'closed',
}

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  [EmploymentType.FULL_TIME]: 'Full Time',
  [EmploymentType.PART_TIME]: 'Part Time',
  [EmploymentType.CONTRACT]: 'Contract',
  [EmploymentType.INTERNSHIP]: 'Internship',
}

export function AdminJobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['adminJobDetail', id],
    queryFn: () => adminJobsApi.get(id!),
    enabled: !!id,
  })

  const publishMutation = useMutation({
    mutationFn: (jobId: string) => adminJobsApi.publish(jobId),
    onSuccess: () => {
      toast.success('Job published successfully')
      queryClient.invalidateQueries({ queryKey: ['adminJobDetail', id] })
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] })
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to publish job'),
  })

  const closeMutation = useMutation({
    mutationFn: (jobId: string) => adminJobsApi.close(jobId),
    onSuccess: () => {
      toast.success('Job closed successfully')
      queryClient.invalidateQueries({ queryKey: ['adminJobDetail', id] })
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] })
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to close job'),
  })

  const duplicateMutation = useMutation({
    mutationFn: (jobId: string) => adminJobsApi.duplicate(jobId),
    onSuccess: (newJob) => {
      toast.success('Job duplicated successfully')
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] })
      navigate(`/admin/jobs/${newJob.id}`)
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to duplicate job'),
  })

  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Requisition</h1>
          </div>
        </div>
        <Card>
          <CardBody className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Job Not Found</h3>
            <p className="mt-2 text-gray-600">The job requisition you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/admin/jobs')} className="mt-4">Back to Jobs</Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  const formatDate = (dateStr: string | null) => dateStr ? new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  const handleAction = async (action: 'publish' | 'close' | 'duplicate') => {
    if (!job) return
    if (action === 'publish') {
      await publishMutation.mutateAsync(job.id)
    } else if (action === 'close') {
      await closeMutation.mutateAsync(job.id)
    } else if (action === 'duplicate') {
      await duplicateMutation.mutateAsync(job.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/admin/jobs" className="text-sm text-indigo-600 hover:text-indigo-500 mb-2 inline-block">
            ← Back to Jobs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-gray-600 mt-1">{job.requisition_id}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Badge variant={STATUS_BADGE_MAP[job.status]} className="text-sm px-3 py-1">
            {job.status}
          </Badge>
          {job.status === JobStatus.DRAFT && (
            <>
              <Button variant="secondary" onClick={() => setShowPublishConfirm(true)} loading={publishMutation.isPending}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Publish
              </Button>
              <Button variant="secondary" onClick={() => setShowDuplicateConfirm(true)} loading={duplicateMutation.isPending}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Duplicate
              </Button>
              <Link to={`/admin/jobs/${job.id}/edit`}>
                <Button variant="secondary">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit
                </Button>
              </Link>
            </>
          )}
          {job.status === JobStatus.PUBLISHED && (
            <>
              <Button variant="danger" onClick={() => setShowCloseConfirm(true)} loading={closeMutation.isPending}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Close
              </Button>
              <Button variant="secondary" onClick={() => setShowDuplicateConfirm(true)} loading={duplicateMutation.isPending}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Duplicate
              </Button>
              <Link to={`/admin/jobs/${job.id}/edit`}>
                <Button variant="secondary">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit
                </Button>
              </Link>
            </>
          )}
          {job.status === JobStatus.CLOSED && (
            <>
              <Button variant="secondary" onClick={() => setShowDuplicateConfirm(true)} loading={duplicateMutation.isPending}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Duplicate
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Job Details</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Department</dt>
                  <dd className="font-medium text-gray-900">{job.department}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Location</dt>
                  <dd className="font-medium text-gray-900">{job.location}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Employment Type</dt>
                  <dd className="font-medium text-gray-900">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Experience Range</dt>
                  <dd className="font-medium text-gray-900">{job.experience_range}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Openings</dt>
                  <dd className="font-medium text-gray-900">{job.openings}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Hiring Manager</dt>
                  <dd className="font-medium text-gray-900">{job.hiring_manager}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Responsibilities</dt>
                  <dd className="font-medium text-gray-900 whitespace-pre-wrap mt-1">{job.responsibilities}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Requirements</dt>
                  <dd className="font-medium text-gray-900 whitespace-pre-wrap mt-1">{job.requirements}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Applications</h2>
            </CardHeader>
            <CardBody>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-indigo-600">{job.application_count}</p>
                <Link to={`/admin/applications?job_id=${job.id}`} className="text-sm text-indigo-600 hover:text-indigo-500">
                  View All Applications →
                </Link>
              </div>
              <p className="text-sm text-gray-600 mt-2">Total applications received for this requisition</p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
              <Link
                to={`/admin/jobs/${job.id}/edit`}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
              >
                Edit Dates
              </Link>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="border-l-2 border-gray-200 pl-4">
                <div className="relative pb-4">
                  <div className="absolute left-[-6px] top-0 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white" />
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">{formatDate(job.created_at)}</p>
                </div>
                {job.posted_date ? (
                  <div className="relative pb-4">
                    <div className="absolute left-[-6px] top-0 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                    <p className="text-sm text-gray-500">{job.status === JobStatus.DRAFT ? 'Scheduled Publish Date' : 'Published'}</p>
                    <p className="font-medium text-gray-900">{formatDate(job.posted_date)}</p>
                  </div>
                ) : (
                  job.status === JobStatus.DRAFT && (
                    <div className="relative pb-4">
                      <div className="absolute left-[-6px] top-0 w-3 h-3 rounded-full bg-gray-300 border-2 border-white" />
                      <p className="text-sm text-gray-500">Published</p>
                      <p className="text-sm text-gray-400 italic">Not published yet</p>
                    </div>
                  )
                )}
                {job.application_end_date && (
                  <div className="relative pb-4">
                    <div className="absolute left-[-6px] top-0 w-3 h-3 rounded-full bg-amber-500 border-2 border-white" />
                    <p className="text-sm text-gray-500">Application End Date</p>
                    <p className="font-medium text-gray-900">{formatDate(job.application_end_date)}</p>
                    {new Date(job.application_end_date) < new Date() && (
                      <span className="inline-block mt-0.5 text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">
                        Deadline Passed
                      </span>
                    )}
                  </div>
                )}
                {job.status === JobStatus.CLOSED && (
                  <div className="relative">
                    <div className="absolute left-[-6px] top-0 w-3 h-3 rounded-full bg-red-600 border-2 border-white" />
                    <p className="text-sm text-gray-500">Closed</p>
                    <p className="font-medium text-gray-900">{formatDate(job.updated_at)}</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <Link to={`/admin/jobs/${job.id}/edit`} className="btn-secondary w-full text-center">
                <svg className="w-5 h-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit Job
              </Link>
              <Link to={`/admin/applications?job_id=${job.id}`} className="btn-secondary w-full text-center">
                <svg className="w-5 h-5 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                View Applications
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Publish Confirm Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ display: showPublishConfirm ? 'block' : 'none' }}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowPublishConfirm(false)} />
          <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Publish this requisition?</h3>
              <p className="mt-2 text-sm text-gray-600">This job will immediately become visible on the public career site.</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowPublishConfirm(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { handleAction('publish'); setShowPublishConfirm(false) }} loading={publishMutation.isPending}>
                {publishMutation.isPending ? 'Publishing...' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Close Confirm Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ display: showCloseConfirm ? 'block' : 'none' }}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowCloseConfirm(false)} />
          <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Close this requisition?</h3>
              <p className="mt-2 text-sm text-gray-600">The job will be removed from the public career site. Existing applications will be retained.</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => { handleAction('close'); setShowCloseConfirm(false) }} loading={closeMutation.isPending}>
                {closeMutation.isPending ? 'Closing...' : 'Close Requisition'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Confirm Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ display: showDuplicateConfirm ? 'block' : 'none' }}>
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowDuplicateConfirm(false)} />
          <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Create a draft copy of this requisition?</h3>
              <p className="mt-2 text-sm text-gray-600">Applications will not be copied. The duplicate will have a new requisition ID and start as a draft.</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDuplicateConfirm(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { handleAction('duplicate'); setShowDuplicateConfirm(false) }} loading={duplicateMutation.isPending}>
                {duplicateMutation.isPending ? 'Duplicating...' : 'Duplicate'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}