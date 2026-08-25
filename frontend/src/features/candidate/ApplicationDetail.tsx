import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { candidateApi } from '../../api/candidate'
import type { Application, Education, WorkExperience } from '../../types'
import { Card, CardHeader, CardBody, Badge, Button } from '../../components/ui'
import { Link } from 'react-router-dom'

const STATUS_BADGE_MAP: Record<string, 'new' | 'reviewed' | 'shortlisted' | 'rejected'> = {
  NEW: 'new',
  REVIEWED: 'reviewed',
  SHORTLISTED: 'shortlisted',
  REJECTED: 'rejected',
}

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: application, isLoading } = useQuery({
    queryKey: ['candidateApplication', id],
    queryFn: () => candidateApi.getApplication(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <Card><CardBody><div className="h-4 bg-gray-200 rounded w-1/4" /></CardBody></Card>
        <Card><CardBody><div className="h-4 bg-gray-200 rounded w-1/2" /></CardBody></Card>
      </div>
    )
  }

  if (!application) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <p className="text-gray-600">Application not found</p>
          <Link to="/candidate/applications" className="mt-4 inline-block btn-primary">
            Back to Applications
          </Link>
        </CardBody>
      </Card>
    )
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/candidate/applications" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Applications
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{application.job_title || 'Application'}</h1>
        </div>
        <Badge variant={STATUS_BADGE_MAP[application.status] || 'default'} className="text-lg px-4 py-2">
          {application.status}
        </Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Application Details</h2>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Application Number</dt>
                  <dd className="font-mono text-gray-900">{application.application_number}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd className="font-medium text-gray-900">
                    <Badge variant={STATUS_BADGE_MAP[application.status] || 'default'}>{application.status}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Applied On</dt>
                  <dd className="font-medium text-gray-900">{formatDate(application.applied_at)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Experience</dt>
                  <dd className="font-medium text-gray-900">{application.total_experience_months} months</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {/* Education snapshot - would need to be added to the Application type if available */}
          {/* For now, we show what's in the base Application type */}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <Link to="/jobs" className="btn-secondary w-full text-center">
                Browse More Jobs
              </Link>
              <Link to="/candidate/profile" className="btn-ghost w-full text-center">
                Update Profile
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Information</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Application ID</span>
                <span className="font-mono text-gray-900">{application.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Location</span>
                <span className="font-medium text-gray-900">{application.current_location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Experience</span>
                <span className="font-medium text-gray-900">
                  {application.fresher ? 'Fresher' : `${application.total_experience_months} months`}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}