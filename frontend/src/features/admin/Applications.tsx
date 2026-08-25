import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminApplicationsApi } from '../../api/admin'
import { AdminApplicationDetail, ApplicationStatus, Application } from '../../types'
import { Button, Input, Card, CardHeader, CardBody, Badge, Table, Pagination, Modal, Select, Label } from '../../components/ui'

const APPLICATION_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: ApplicationStatus.NEW, label: 'New' },
  { value: ApplicationStatus.REVIEWED, label: 'Reviewed' },
  { value: ApplicationStatus.SHORTLISTED, label: 'Shortlisted' },
  { value: ApplicationStatus.REJECTED, label: 'Rejected' },
]

const STATUS_BADGE_MAP: Record<ApplicationStatus, 'new' | 'reviewed' | 'shortlisted' | 'rejected'> = {
  [ApplicationStatus.NEW]: 'new',
  [ApplicationStatus.REVIEWED]: 'reviewed',
  [ApplicationStatus.SHORTLISTED]: 'shortlisted',
  [ApplicationStatus.REJECTED]: 'rejected',
}

export function AdminApplications() {
  const [searchParams, setSearchParams] = useSearchParams()
  const jobIdParam = searchParams.get('job_id') || ''

  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('')
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['adminApplications', page, pageSize, statusFilter, searchFilter, jobIdParam],
    queryFn: () =>
      adminApplicationsApi.list({
        page,
        page_size: pageSize,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
        job_id: jobIdParam || undefined,
      }),
    placeholderData: (previous) => previous,
  })

  // Full detail query when an application row is selected
  const { data: detailApplication, isLoading: isDetailLoading } = useQuery({
    queryKey: ['adminApplicationDetail', selectedAppId],
    queryFn: () => adminApplicationsApi.get(selectedAppId!),
    enabled: !!selectedAppId,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      adminApplicationsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated successfully')
      queryClient.invalidateQueries({ queryKey: ['adminApplications'] })
      queryClient.invalidateQueries({ queryKey: ['adminApplicationDetail'] })
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to update status'),
  })

  const downloadResumeMutation = useMutation({
    mutationFn: (id: string) => adminApplicationsApi.downloadResume(id),
    onSuccess: (blob, id) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resume_${id}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Failed to download resume'),
  })

  const exportCsvMutation = useMutation({
    mutationFn: () => adminApplicationsApi.exportCsv(jobIdParam || undefined),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `applications_${jobIdParam ? `job_${jobIdParam}_` : ''}${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setExporting(false)
      toast.success('CSV downloaded successfully')
    },
    onError: (error: unknown) => {
      setExporting(false)
      toast.error(error instanceof Error ? error.message : 'Failed to export CSV')
    },
  })

  const handleStatusChange = (appId: string, newStatus: ApplicationStatus) => {
    updateStatusMutation.mutate({ id: appId, status: newStatus })
  }

  const handleDownloadResume = (id: string) => {
    downloadResumeMutation.mutate(id)
  }

  const handleExport = () => {
    setExporting(true)
    exportCsvMutation.mutate()
  }

  const clearJobFilter = () => {
    searchParams.delete('job_id')
    setSearchParams(searchParams)
    setPage(1)
  }

  const columns = [
    {
      key: 'application_number',
      header: 'Application #',
      render: (app: Application) => (
        <span
          className="font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedAppId(app.id)
          }}
        >
          {app.application_number}
        </span>
      ),
    },
    {
      key: 'job_title',
      header: 'Job Title',
      render: (app: Application) =>
        app.job_title ? (
          <span className="font-medium text-gray-900">{app.job_title}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'candidate_name',
      header: 'Candidate',
      render: (app: Application) => (
        <div>
          <p className="font-medium text-gray-900">{app.candidate_name}</p>
          {app.mobile && <p className="text-xs text-gray-500">{app.mobile}</p>}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (app: Application) => (
        <span className="text-sm text-gray-700">{app.email || '—'}</span>
      ),
    },
    {
      key: 'current_location',
      header: 'Location',
      render: (app: Application) => (
        <span className="text-sm text-gray-600">{app.current_location || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (app: Application) => (
        <Badge variant={STATUS_BADGE_MAP[app.status as ApplicationStatus]}>
          {app.status}
        </Badge>
      ),
    },
    {
      key: 'applied_at',
      header: 'Applied',
      render: (app: Application) => new Date(app.applied_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (app: Application) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedAppId(app.id)
          }}
        >
          View Full App
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Applications</h1>
          <p className="text-gray-600 mt-1">
            Manage and review candidate applications across all requisitions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Requisition Filter Banner */}
      {jobIdParam && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <p className="text-sm text-indigo-900 font-medium">
              Filtered for specific job requisition
            </p>
          </div>
          <button
            type="button"
            onClick={clearJobFilter}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline"
          >
            Show All Requisitions
          </button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="status_filter">Status</Label>
              <Select
                id="status_filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ApplicationStatus | '')
                  setPage(1)
                }}
              >
                <option value="">All Statuses</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="candidate_filter">Search Candidate / Email</Label>
              <Input
                id="candidate_filter"
                type="text"
                placeholder="Search candidate name or email..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="flex items-end">
              {(statusFilter || searchFilter || jobIdParam) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusFilter('')
                    setSearchFilter('')
                    if (jobIdParam) clearJobFilter()
                    setPage(1)
                  }}
                  className="w-full"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Grid */}
      <Card>
        <CardBody className="p-0">
          {isLoading && !data ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto" />
              <p className="mt-4 text-gray-600">Loading applications...</p>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No applications found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your search criteria or filters.
              </p>
            </div>
          ) : (
            <>
              <Table
                data={data!.items as unknown as Application[]}
                columns={columns}
                keyExtractor={(app) => app.id}
                onRowClick={(app) => setSelectedAppId(app.id)}
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

      {/* Full Application Detail Modal (FR-ADM-06) */}
      {selectedAppId && (
        <ApplicationDetailModal
          applicationId={selectedAppId}
          application={detailApplication || null}
          isLoading={isDetailLoading}
          onClose={() => setSelectedAppId(null)}
          onStatusChange={handleStatusChange}
          onDownloadResume={handleDownloadResume}
          isUpdating={updateStatusMutation.isPending}
        />
      )}
    </div>
  )
}

function ApplicationDetailModal({
  applicationId,
  application,
  isLoading,
  onClose,
  onStatusChange,
  onDownloadResume,
  isUpdating,
}: {
  applicationId: string
  application: AdminApplicationDetail | null
  isLoading: boolean
  onClose: () => void
  onStatusChange: (appId: string, status: ApplicationStatus) => void
  onDownloadResume: (id: string) => void
  isUpdating: boolean
}) {
  const [activeTab, setActiveTab] = useState<'bio' | 'education' | 'experience' | 'resume'>('bio')
  const [resumeBlobUrl, setResumeBlobUrl] = useState<string | null>(null)
  const [loadingResumePreview, setLoadingResumePreview] = useState(false)

  // Auto-fetch resume preview blob when opening resume tab
  useEffect(() => {
    let active = true
    if (activeTab === 'resume' && applicationId && !resumeBlobUrl) {
      setLoadingResumePreview(true)
      adminApplicationsApi
        .downloadResume(applicationId)
        .then((blob) => {
          if (active) {
            const isPdf = application?.resume_original_name.toLowerCase().endsWith('.pdf')
            const mimeType = isPdf ? 'application/pdf' : blob.type || 'application/octet-stream'
            const typedBlob = new Blob([blob], { type: mimeType })
            const url = window.URL.createObjectURL(typedBlob)
            setResumeBlobUrl(url)
            setLoadingResumePreview(false)
          }
        })
        .catch(() => {
          if (active) setLoadingResumePreview(false)
        })
    }
    return () => {
      active = false
    }
  }, [activeTab, applicationId, resumeBlobUrl, application?.resume_original_name])

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (resumeBlobUrl) {
        window.URL.revokeObjectURL(resumeBlobUrl)
      }
    }
  }, [resumeBlobUrl])

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        application
          ? `Application: ${application.application_number}`
          : 'Loading Application...'
      }
      size="xl"
    >
      {isLoading || !application ? (
        <div className="p-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Fetching candidate details...</p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
          {/* Header Summary Banner */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h3 className="text-xl font-bold text-gray-900">
                  {application.candidate_name}
                </h3>
                <Badge variant={STATUS_BADGE_MAP[application.status as ApplicationStatus]}>
                  {application.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Applied for{' '}
                <span className="font-semibold text-gray-900">
                  {application.job_title || 'Requisition'}
                </span>{' '}
                on {formatDate(application.applied_at)}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="min-w-[160px]">
                <Label htmlFor="quick_status_change" className="sr-only">
                  Update Status
                </Label>
                <Select
                  id="quick_status_change"
                  value={application.status}
                  onChange={(e) =>
                    onStatusChange(application.id, e.target.value as ApplicationStatus)
                  }
                  disabled={isUpdating}
                  className="font-medium bg-white"
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      Status: {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6">
              {[
                { id: 'bio', label: '1. Candidate Bio-Data' },
                {
                  id: 'education',
                  label: `2. Education (${application.education?.length || 0})`,
                },
                {
                  id: 'experience',
                  label: `3. Work Experience (${application.fresher ? 'Fresher' : application.experience?.length || 0})`,
                },
                { id: 'resume', label: '4. Resume & Cover Note' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab 1: Bio-Data */}
          {activeTab === 'bio' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h4 className="text-base font-semibold text-gray-900">
                    Personal & Contact Information
                  </h4>
                </CardHeader>
                <CardBody>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                    <div>
                      <dt className="text-gray-500 font-medium">Full Name</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.candidate_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Email Address</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.email || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Mobile Phone</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.mobile || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Current Location</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.current_location || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Gender</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.gender
                          ? application.gender.replace('_', ' ')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Date of Birth</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {formatDate(application.date_of_birth)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Current Company</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.current_company || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Notice Period</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.notice_period
                          ? application.notice_period.replace('_', ' ')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 font-medium">Total Experience</dt>
                      <dd className="font-semibold text-indigo-700 mt-0.5">
                        {application.fresher
                          ? 'Fresher (No Prior Experience)'
                          : `${application.total_experience_months} months (${(
                              application.total_experience_months / 12
                            ).toFixed(1)} yrs)`}
                      </dd>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                      <dt className="text-gray-500 font-medium">Residential / Current Address</dt>
                      <dd className="font-semibold text-gray-900 mt-0.5">
                        {application.current_address || '—'}
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>

              {/* Consent & Audit */}
              <Card>
                <CardHeader>
                  <h4 className="text-base font-semibold text-gray-900">
                    Application Audit & Consent Status
                  </h4>
                </CardHeader>
                <CardBody>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Application Number</dt>
                      <dd className="font-mono font-semibold text-gray-900">
                        {application.application_number}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Submission Date</dt>
                      <dd className="font-medium text-gray-900">
                        {formatDate(application.applied_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Data Accuracy Declaration</dt>
                      <dd className="font-medium text-green-700 flex items-center mt-0.5">
                        <svg
                          className="w-4 h-4 mr-1 text-green-600 inline"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Accepted
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Privacy Policy Terms</dt>
                      <dd className="font-medium text-green-700 flex items-center mt-0.5">
                        <svg
                          className="w-4 h-4 mr-1 text-green-600 inline"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Accepted
                      </dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Tab 2: Education */}
          {activeTab === 'education' && (
            <Card>
              <CardHeader>
                <h4 className="text-base font-semibold text-gray-900">
                  Educational Qualifications
                </h4>
              </CardHeader>
              <CardBody>
                {!application.education || application.education.length === 0 ? (
                  <p className="text-gray-500 italic">No education records submitted.</p>
                ) : (
                  <div className="space-y-4">
                    {application.education.map((edu, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                          <div>
                            <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                              {edu.level ? edu.level.replace('_', ' ') : 'Education'}
                            </span>
                            <h5 className="text-lg font-bold text-gray-900 mt-1">
                              {edu.degree || edu.board || 'Qualification'}
                              {edu.specialization || edu.stream ? ` — ${edu.specialization || edu.stream}` : ''}
                            </h5>
                          </div>
                          <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-md">
                            Passing Year: {edu.year_of_passing}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Institution / University:</span>{' '}
                            <span className="font-semibold text-gray-900">
                              {edu.institution}
                            </span>
                          </div>
                          {edu.board && (
                            <div>
                              <span className="text-gray-500">Board / Council:</span>{' '}
                              <span className="font-semibold text-gray-900">
                                {edu.board}
                              </span>
                            </div>
                          )}
                          {edu.stream && (
                            <div>
                              <span className="text-gray-500">Stream:</span>{' '}
                              <span className="font-semibold text-gray-900">
                                {edu.stream}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Grade / CGPA / %:</span>{' '}
                            <span className="font-semibold text-gray-900">
                              {edu.grade || '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Tab 3: Work Experience */}
          {activeTab === 'experience' && (
            <Card>
              <CardHeader>
                <h4 className="text-base font-semibold text-gray-900">
                  Employment & Professional Experience
                </h4>
              </CardHeader>
              <CardBody>
                {application.fresher ? (
                  <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl text-center">
                    <p className="text-blue-900 font-semibold text-base">
                      Candidate applied as a Fresher
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      No prior full-time work experience records submitted.
                    </p>
                  </div>
                ) : !application.experience || application.experience.length === 0 ? (
                  <p className="text-gray-500 italic">No work experience records added.</p>
                ) : (
                  <div className="space-y-4">
                    {application.experience.map((exp, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                          <div>
                            <h5 className="text-lg font-bold text-gray-900">
                              {exp.title}
                            </h5>
                            <p className="text-base font-semibold text-indigo-700">
                              {exp.company}
                            </p>
                          </div>
                          <Badge variant={exp.currently_working ? 'shortlisted' : 'default'}>
                            {exp.currently_working ? 'Currently Working Here' : 'Past Role'}
                          </Badge>
                        </div>

                        <div className="text-sm text-gray-600 mb-3">
                          <span className="font-medium text-gray-800">Duration: </span>
                          {new Date(exp.start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          —{' '}
                          {exp.currently_working
                            ? 'Present'
                            : exp.end_date
                            ? new Date(exp.end_date).toLocaleDateString('en-US', {
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </div>

                        {exp.responsibilities && (
                          <div className="bg-gray-50 rounded-lg p-3.5 mt-2 text-sm text-gray-800">
                            <span className="font-semibold text-gray-900 block mb-1">
                              Key Responsibilities:
                            </span>
                            <p className="whitespace-pre-line text-gray-700">
                              {exp.responsibilities}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Tab 4: Resume & Cover Note */}
          {activeTab === 'resume' && (
            <div className="space-y-6">
              {application.cover_note && (
                <Card>
                  <CardHeader>
                    <h4 className="text-base font-semibold text-gray-900">
                      Cover Note to Recruiter
                    </h4>
                  </CardHeader>
                  <CardBody>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
                      {application.cover_note}
                    </div>
                  </CardBody>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">
                      Attached Resume Document
                    </h4>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {application.resume_original_name}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {resumeBlobUrl && (
                      <a
                        href={resumeBlobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary text-sm px-3 py-1.5 inline-flex items-center rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-medium"
                      >
                        <svg
                          className="w-4 h-4 mr-1.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        Open in New Tab
                      </a>
                    )}
                    <Button onClick={() => onDownloadResume(application.id)}>
                      <svg
                        className="w-4 h-4 mr-1.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download File
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  {loadingResumePreview ? (
                    <div className="p-16 text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mx-auto" />
                      <p className="mt-4 text-sm text-gray-600 font-medium">
                        Loading document preview...
                      </p>
                    </div>
                  ) : resumeBlobUrl &&
                    application.resume_original_name.toLowerCase().endsWith('.pdf') ? (
                    <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm bg-gray-100">
                      <iframe
                        src={`${resumeBlobUrl}#toolbar=1&navpanes=0`}
                        title="Resume Preview"
                        className="w-full h-[650px] border-0"
                      />
                    </div>
                  ) : (
                    <div className="p-10 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-indigo-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-base font-semibold text-gray-900 mt-3">
                        {application.resume_original_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Direct document preview is optimized for PDF files. You can open or download the original file to view.
                      </p>
                      <div className="mt-4 flex justify-center space-x-3">
                        <Button onClick={() => onDownloadResume(application.id)}>
                          Download Resume File
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}