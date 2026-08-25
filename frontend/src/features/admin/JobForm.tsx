import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { adminJobsApi } from '../../api/admin'
import { jobsApi } from '../../api/jobs'
import { Job, JobStatus, EmploymentType, Department, User } from '../../types'
import { Button, Input, Textarea, Select, Label, Card, CardHeader, CardBody, CardFooter, Badge } from '../../components/ui'

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

const jobSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  department: z.string().min(1, 'Department is required'),
  location: z.string().min(1, 'Location is required'),
  employment_type: z.nativeEnum(EmploymentType),
  experience_range: z.string().min(1, 'Experience range is required').max(50),
  openings: z.number().min(1, 'At least 1 opening required').max(1000),
  hiring_manager: z.string().min(1, 'Hiring manager is required').max(120),
  created_at: z.string().nullable().optional(),
  posted_date: z.string().nullable().optional(),
  application_end_date: z.string().nullable().optional(),
  responsibilities: z.string().min(1, 'Responsibilities are required'),
  requirements: z.string().min(1, 'Requirements are required'),
})

type JobForm = z.infer<typeof jobSchema>

export function AdminJobForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: jobsApi.getDepartments,
  })

  const { data: job, isLoading } = useQuery({
    queryKey: ['adminJobDetail', id],
    queryFn: () => adminJobsApi.get(id!),
    enabled: isEditing,
  })

  const createMutation = useMutation({
    mutationFn: (data: JobForm) => adminJobsApi.create(data as any),
    onSuccess: (newJob) => {
      toast.success('Job requisition created successfully')
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      navigate(`/admin/jobs/${newJob.id}`)
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to create job'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: JobForm }) => adminJobsApi.update(id, data as any),
    onSuccess: () => {
      toast.success('Job requisition updated successfully')
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] })
      queryClient.invalidateQueries({ queryKey: ['adminJobDetail'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobDetail'] })
      navigate(`/admin/jobs/${id}`)
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to update job'),
  })

  const publishMutation = useMutation({
    mutationFn: (jobId: string) => adminJobsApi.publish(jobId),
    onSuccess: () => {
      toast.success('Job published successfully')
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] })
      queryClient.invalidateQueries({ queryKey: ['adminJobDetail'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobDetail'] })
      navigate(`/admin/jobs/${id}`)
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to publish job'),
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: '',
      department: '',
      location: '',
      employment_type: EmploymentType.FULL_TIME,
      experience_range: '',
      openings: 1,
      hiring_manager: '',
      created_at: '',
      posted_date: '',
      application_end_date: '',
      responsibilities: '',
      requirements: '',
    },
  })

  const isDraftMode = (job?.status === JobStatus.DRAFT) || !job

  useEffect(() => {
    if (job) {
      reset({
        title: job.title,
        department: job.department,
        location: job.location,
        employment_type: job.employment_type,
        experience_range: job.experience_range,
        openings: job.openings,
        hiring_manager: job.hiring_manager,
        created_at: job.created_at ? job.created_at.split('T')[0] : '',
        posted_date: job.posted_date ? job.posted_date.split('T')[0] : '',
        application_end_date: job.application_end_date ? job.application_end_date.split('T')[0] : '',
        responsibilities: job.responsibilities,
        requirements: job.requirements,
      })
    }
  }, [job, reset])

  const handleFormSubmit = (data: JobForm, action: 'draft' | 'publish') => {
    const payload = {
      ...data,
      created_at: data.created_at ? new Date(`${data.created_at}T00:00:00Z`).toISOString() : undefined,
      posted_date: data.posted_date ? new Date(`${data.posted_date}T00:00:00Z`).toISOString() : undefined,
      application_end_date: data.application_end_date ? new Date(`${data.application_end_date}T23:59:59Z`).toISOString() : null,
      publish_now: action === 'publish',
    }
    if (isEditing) {
      if (action === 'publish' && job?.status === JobStatus.DRAFT) {
        updateMutation.mutate({ id: id!, data: payload as any }, {
          onSuccess: () => publishMutation.mutate(id!),
        })
      } else {
        updateMutation.mutate({ id: id!, data: payload as any })
      }
    } else {
      createMutation.mutate(payload as any)
    }
  }

  const handleCancel = () => {
    navigate('/admin/jobs')
  }

  if (isLoading && isEditing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/admin/jobs" className="text-sm text-indigo-600 hover:text-indigo-500 mb-2 inline-block">
            ← Back to Jobs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Job Requisition' : 'Create Job Requisition'}</h1>
          <p className="text-gray-600 mt-1">{isEditing ? 'Update the job details below' : 'Fill in the details to create a new job requisition'}</p>
        </div>
      </div>

      <Card>
        <CardBody className="p-6">
          <form onSubmit={handleSubmit((data) => handleFormSubmit(data, 'draft'))} className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="title">Job Title *</Label>
                  <Input {...register('title')} error={errors.title?.message} placeholder="e.g., Senior Python Developer" />
                </div>
                <div>
                  <Label htmlFor="department">Department *</Label>
                  <Select {...register('department')} error={errors.department?.message}>
                    <option value="">Select Department</option>
                    {(departments as Department[] || []).map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input {...register('location')} error={errors.location?.message} placeholder="e.g., Bangalore, India" />
                </div>
                <div>
                  <Label htmlFor="employment_type">Employment Type *</Label>
                  <Select {...register('employment_type')} error={errors.employment_type?.message}>
                    {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Hiring Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="experience_range">Experience Range *</Label>
                  <Input {...register('experience_range')} placeholder="e.g., 3-5 years" error={errors.experience_range?.message} />
                  <p className="mt-1 text-sm text-gray-500">Format: X-Y years (e.g., 3-5 years)</p>
                </div>
                <div>
                  <Label htmlFor="openings">Number of Openings *</Label>
                  <Input type="number" {...register('openings', { valueAsNumber: true })} error={errors.openings?.message} min={1} max={1000} />
                </div>
                <div>
                  <Label htmlFor="hiring_manager">Hiring Manager *</Label>
                  <Input
                    id="hiring_manager"
                    {...register('hiring_manager')}
                    placeholder="e.g., Sarah Jenkins (HR Lead)"
                    error={errors.hiring_manager?.message}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={job?.status || JobStatus.DRAFT}
                    onChange={(e) => {}}
                    disabled={!isEditing}
                  >
                    {JOB_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                  {!isEditing && <p className="mt-1 text-sm text-gray-500">New requisitions are created as Draft by default.</p>}
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline & Dates (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="created_at">Creation Date</Label>
                  <Input
                    id="created_at"
                    type="date"
                    {...register('created_at')}
                    error={errors.created_at?.message}
                  />
                  <p className="mt-1 text-sm text-gray-500">Leave blank to use current date automatically.</p>
                </div>
                <div>
                  <Label htmlFor="posted_date">Published / Posted Date</Label>
                  <Input
                    id="posted_date"
                    type="date"
                    {...register('posted_date')}
                    error={errors.posted_date?.message}
                  />
                  <p className="mt-1 text-sm text-gray-500">Set manually before publishing or update after publish.</p>
                </div>
                <div>
                  <Label htmlFor="application_end_date">Application End Date (Deadline)</Label>
                  <Input
                    id="application_end_date"
                    type="date"
                    {...register('application_end_date')}
                    error={errors.application_end_date?.message}
                  />
                  <p className="mt-1 text-sm text-gray-500">Requisition automatically closes after this date passes.</p>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Description</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="responsibilities">Responsibilities *</Label>
                  <Textarea
                    {...register('responsibilities' as any)}
                    rows={4}
                    placeholder="- Design backend services\n- Build REST APIs\n- Work with PostgreSQL\n- Collaborate with frontend engineers"
                    error={errors.responsibilities?.message}
                  />
                </div>
                <div>
                  <Label htmlFor="requirements">Requirements *</Label>
                  <Textarea
                    {...register('requirements' as any)}
                    rows={4}
                    placeholder="- 3+ years Python experience\n- FastAPI experience\n- PostgreSQL knowledge\n- REST API experience"
                    error={errors.requirements?.message}
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                  className="min-w-[140px]"
                >
                  {isEditing ? 'Save Changes' : 'Save as Draft'}
                </Button>
                {(!isEditing || job?.status === JobStatus.DRAFT) && (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleSubmit((data) => handleFormSubmit(data, 'publish'))()}
                    loading={createMutation.isPending || updateMutation.isPending || publishMutation.isPending}
                    className="min-w-[140px]"
                    disabled={isSubmitting}
                  >
                    Publish
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                {isEditing ? (
                  <>
                    <strong>Save Changes:</strong> Updates all job requisition details and timeline dates.
                  </>
                ) : (
                  <>
                    <strong>Save as Draft:</strong> Saves incomplete requisition. Not visible publicly.
                    <br />
                    <strong>Publish:</strong> Validates all required fields and makes job visible on public career site immediately.
                  </>
                )}
              </p>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}