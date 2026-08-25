import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from '../../hooks/useDebounce'
import { jobsApi } from '../../api/jobs'
import { Job, EmploymentType } from '../../types'
import { Button, Input, Select, Label, Card, CardBody, Badge } from '../../components/ui'

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: EmploymentType.FULL_TIME, label: 'Full Time' },
  { value: EmploymentType.PART_TIME, label: 'Part Time' },
  { value: EmploymentType.CONTRACT, label: 'Contract' },
  { value: EmploymentType.INTERNSHIP, label: 'Internship' },
]

const DEFAULT_PAGE_SIZE = 10

export function JobsIndex() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [department, setDepartment] = useState(searchParams.get('department') || '')
  const [location, setLocation] = useState(searchParams.get('location') || '')
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>((searchParams.get('employment_type') as EmploymentType) || '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const debouncedSearch = useDebounce(search, 300)
  const debouncedDepartment = useDebounce(department, 300)
  const debouncedLocation = useDebounce(location, 300)
  const debouncedEmploymentType = useDebounce(employmentType, 300)

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (debouncedDepartment) params.set('department', debouncedDepartment)
    if (debouncedLocation) params.set('location', debouncedLocation)
    if (debouncedEmploymentType) params.set('employment_type', debouncedEmploymentType)
    if (page > 1) params.set('page', page.toString())
    // Only add page_size to URL if it's different from default
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      params.set('page_size', pageSize.toString())
    }
    setSearchParams(params, { replace: true })
  }, [debouncedSearch, debouncedDepartment, debouncedLocation, debouncedEmploymentType, page, pageSize, setSearchParams])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['jobs', debouncedSearch, debouncedDepartment, debouncedLocation, debouncedEmploymentType, page, pageSize],
    queryFn: () => jobsApi.list({
      search: debouncedSearch,
      department: debouncedDepartment || undefined,
      location: debouncedLocation || undefined,
      employment_type: debouncedEmploymentType || undefined,
      page,
      page_size: pageSize,
    }),
    placeholderData: (previous) => previous,
    retry: 1,
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: jobsApi.getDepartments,
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'department') setDepartment(value)
    else if (key === 'location') setLocation(value)
    else if (key === 'employment_type') setEmploymentType(value as EmploymentType)
    setPage(1)
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(parseInt(e.target.value, 10))
    setPage(1)
  }

  const clearFilters = () => {
    setSearch('')
    setDepartment('')
    setLocation('')
    setEmploymentType('')
    setPage(1)
  }

  const hasFilters = debouncedSearch || debouncedDepartment || debouncedLocation || debouncedEmploymentType

  // Error state - show error with retry option
  if (isError) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <p className="text-red-600 mb-4">Failed to load jobs. Please try again.</p>
          <p className="text-sm text-gray-600 mb-4">{error?.message || 'Unknown error'}</p>
          <Button onClick={() => refetch()} variant="primary">
            Retry
          </Button>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Explore Opportunities</h1>
          <p className="text-gray-600 mt-1">Find your next career move</p>
        </div>
        <Link to="/register" className="btn-primary self-start">
          Join as Candidate
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                type="text"
                placeholder="Search by title, description..."
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select
                id="department"
                value={department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="">All Departments</option>
                {departments?.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                type="text"
                placeholder="City, Remote..."
                value={location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="employment_type">Type</Label>
              <Select
                id="employment_type"
                value={employmentType}
                onChange={(e) => handleFilterChange('employment_type', e.target.value)}
              >
                <option value="">All Types</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="page_size">Results per page</Label>
              <Select
                id="page_size"
                value={pageSize}
                onChange={handlePageSizeChange}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </Select>
            </div>
          </div>
          {hasFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Active filters applied</span>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Jobs Grid */}
      <Card>
        <CardBody className="p-0">
          {isLoading && !data ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto" />
              <p className="mt-4 text-gray-600">Loading jobs...</p>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 002-2V8a2 2 0 002 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No jobs found</h3>
              <p className="mt-2 text-gray-600">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data!.items.map((job: Job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{job.title}</h3>
                        <Badge variant="published">{job.status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {job.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {job.experience_range}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.employment_type === EmploymentType.FULL_TIME ? 'bg-blue-100 text-blue-800' :
                          job.employment_type === EmploymentType.PART_TIME ? 'bg-green-100 text-green-800' :
                          job.employment_type === EmploymentType.CONTRACT ? 'bg-yellow-100 text-yellow-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {job.employment_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-gray-600 line-clamp-2">{job.responsibilities}</p>
                    </div>
                    <div className="flex items-center gap-4 sm:ml-6">
                      <span className="text-sm text-gray-600">
                        {job.openings} opening{job.openings > 1 ? 's' : ''}
                      </span>
                      <Button variant="secondary" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100">
              <nav className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          p === page ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === data.pages}
                  >
                    Next
                  </Button>
                </div>
                <span className="text-sm text-gray-600">
                  Page {page} of {data.pages} ({data.total} total)
                </span>
              </nav>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}