import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminJobsApi } from '../../api/admin'
import { jobsApi } from '../../api/jobs'
import { AdminJob, JobStatus, EmploymentType, Department } from '../../types'
import { Button, Input, Select, Label, Card, CardBody, Badge, Table, Pagination } from '../../components/ui'

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: EmploymentType.FULL_TIME, label: 'Full Time' },
  { value: EmploymentType.PART_TIME, label: 'Part Time' },
  { value: EmploymentType.CONTRACT, label: 'Contract' },
  { value: EmploymentType.INTERNSHIP, label: 'Internship' },
]

const JOB_STATUSES: { value: JobStatus; label: string }[] = [
  { value: JobStatus.DRAFT, label: 'Draft' },
  { value: JobStatus.PUBLISHED, label: 'Published' },
  { value: JobStatus.CLOSED, label: 'Closed' },
]

const STATUS_BADGE_MAP: Record<JobStatus, 'draft' | 'published' | 'closed'> = {
  [JobStatus.DRAFT]: 'draft',
  [JobStatus.PUBLISHED]: 'published',
  [JobStatus.CLOSED]: 'closed',
}

type AdminJobsResponse = {
  items: AdminJob[]
  total: number
  page: number
  page_size: number
  pages: number
}

export function AdminJobs() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [pageSize] = useState(10)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>(searchParams.get('status') as JobStatus | '' || '')
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('department') || '')
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '')
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState(searchParams.get('employment_type') || '')
  const [experienceFilter, setExperienceFilter] = useState(searchParams.get('experience') || '')
  const queryClient = useQueryClient()

  // Sync search params with URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', page.toString())
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (departmentFilter) params.set('department', departmentFilter)
    if (locationFilter) params.set('location', locationFilter)
    if (employmentTypeFilter) params.set('employment_type', employmentTypeFilter)
    if (experienceFilter) params.set('experience', experienceFilter)
    setSearchParams(params, { replace: true })
  }, [page, search, statusFilter, departmentFilter, locationFilter, employmentTypeFilter, experienceFilter, setSearchParams])

  const { data, isLoading } = useQuery({
    queryKey: ['adminJobs', page, pageSize, search, statusFilter, departmentFilter, locationFilter, employmentTypeFilter, experienceFilter],
    queryFn: async () => {
      const response = await adminJobsApi.list({
        page,
        page_size: pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        location: locationFilter || undefined,
        employment_type: employmentTypeFilter || undefined,
        experience: experienceFilter || undefined,
      })
      return response as AdminJobsResponse
    },
    placeholderData: (previous) => previous,
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: jobsApi.getDepartments,
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => adminJobsApi.publish(id),
    onSuccess: () => { toast.success('Job published'); queryClient.invalidateQueries({ queryKey: ['adminJobs'] }) },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to publish job'),
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => adminJobsApi.close(id),
    onSuccess: () => { toast.success('Job closed'); queryClient.invalidateQueries({ queryKey: ['adminJobs'] }) },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to close job'),
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => adminJobsApi.duplicate(id),
    onSuccess: () => { toast.success('Job duplicated'); queryClient.invalidateQueries({ queryKey: ['adminJobs'] }) },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to duplicate job'),
  })

  const handleAction = async (job: AdminJob, action: 'publish' | 'close' | 'duplicate') => {
    if (action === 'publish') await publishMutation.mutateAsync(job.id)
    else if (action === 'close') await closeMutation.mutateAsync(job.id)
    else if (action === 'duplicate') await duplicateMutation.mutateAsync(job.id)
  }

  const handleView = (job: AdminJob) => {
    navigate(`/admin/jobs/${job.id}`)
  }

  const handleEdit = (job: AdminJob) => {
    navigate(`/admin/jobs/${job.id}/edit`)
  }

  const columns = [
    { key: 'title', header: 'Title', render: (job: AdminJob) => <span className="font-medium">{job.title}</span> },
    { key: 'requisition_id', header: 'Req. ID', render: (job: AdminJob) => <span className="font-mono text-sm">{job.requisition_id}</span> },
    { key: 'department', header: 'Department' },
    { key: 'location', header: 'Location' },
    { key: 'employment_type', header: 'Type', render: (job: AdminJob) => <Badge variant={job.employment_type === EmploymentType.FULL_TIME ? 'published' : job.employment_type === EmploymentType.PART_TIME ? 'shortlisted' : job.employment_type === EmploymentType.CONTRACT ? 'reviewed' : 'new'}>{job.employment_type.replace('_', ' ')}</Badge> },
    { key: 'openings', header: 'Openings' },
    { key: 'application_count', header: 'Applications', render: (job: AdminJob) => <span className="font-medium text-indigo-600">{job.application_count}</span> },
    { key: 'status', header: 'Status', render: (job: AdminJob) => <Badge variant={STATUS_BADGE_MAP[job.status]}>{job.status}</Badge> },
    { key: 'posted_date', header: 'Posted', render: (job: AdminJob) => job.posted_date ? new Date(job.posted_date).toLocaleDateString() : '—' },
    { key: 'created_at', header: 'Created', render: (job: AdminJob) => new Date(job.created_at).toLocaleDateString() },
  ]

  const handleFilterChange = () => {
    setPage(1)
  }

  const hasFilters = search || statusFilter || departmentFilter || locationFilter || employmentTypeFilter || experienceFilter
  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
          <p className="text-gray-600 mt-1">Create and manage job postings</p>
        </div>
        <Button onClick={() => navigate('/admin/jobs/create')}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Job
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search title, description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); handleFilterChange() }}
              />
            </div>
            <div>
              <Label htmlFor="status_filter">Status</Label>
              <Select
                id="status_filter"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as JobStatus | ''); handleFilterChange() }}
              >
                <option value="">All</option>
                {JOB_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="department_filter">Department</Label>
              <Select
                id="department_filter"
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); handleFilterChange() }}
              >
                <option value="">All</option>
                {(departments as Department[] || []).map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="location_filter">Location</Label>
              <Input
                id="location_filter"
                placeholder="e.g., Bangalore"
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value); handleFilterChange() }}
              />
            </div>
            <div>
              <Label htmlFor="employment_type_filter">Employment Type</Label>
              <Select
                id="employment_type_filter"
                value={employmentTypeFilter}
                onChange={(e) => { setEmploymentTypeFilter(e.target.value); handleFilterChange() }}
              >
                <option value="">All</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="experience_filter">Experience</Label>
              <Input
                id="experience_filter"
                placeholder="e.g., 3-5"
                value={experienceFilter}
                onChange={(e) => { setExperienceFilter(e.target.value); handleFilterChange() }}
              />
            </div>
          </div>
          {hasFilters && (
            <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setDepartmentFilter(''); setLocationFilter(''); setEmploymentTypeFilter(''); setExperienceFilter(''); setPage(1) }}>
              Clear Filters
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {isLoading && !data ? (
            <div className="p-12 text-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto" /><p className="mt-4 text-gray-600">Loading...</p></div>
          ) : data === undefined ? (
            <div className="p-12 text-center text-red-600">
              <p className="mb-4">Unable to load jobs</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['adminJobs'] })} className="mx-auto">
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 002-2H5a2 2 0 002-2v10a2 2 0 002 2z" /></svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No jobs found</h3>
              {hasFilters ? (
                <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter(''); setDepartmentFilter(''); setLocationFilter(''); setEmploymentTypeFilter(''); setExperienceFilter(''); setPage(1) }} className="mt-4">Clear Filters</Button>
              ) : (
                <Button onClick={() => navigate('/admin/jobs/create')} className="mt-4">Create your first job</Button>
              )}
            </div>
          ) : (
            <>
              <Table
                data={items}
                columns={columns}
                keyExtractor={(job) => job.id}
                onRowClick={(job) => handleView(job)}
              />
              {total > 0 && (
                <Pagination currentPage={page} totalPages={data?.pages ?? 1} onPageChange={setPage} />
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}