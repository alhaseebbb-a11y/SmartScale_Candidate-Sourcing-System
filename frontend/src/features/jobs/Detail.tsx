import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { jobsApi } from '../../api/jobs'
import { candidateApi } from '../../api/candidate'
import { useAuth } from '../../hooks/useAuth'
import { Job, EmploymentType, EducationLevel, ApplicationSubmit } from '../../types'
import { Button, Input, Textarea, Select, Label, Card, CardBody, CardHeader, Badge, FileUploader } from '../../components/ui'

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: EmploymentType.FULL_TIME, label: 'Full Time' },
  { value: EmploymentType.PART_TIME, label: 'Part Time' },
  { value: EmploymentType.CONTRACT, label: 'Contract' },
  { value: EmploymentType.INTERNSHIP, label: 'Internship' },
]

const EDUCATION_LEVELS: { value: EducationLevel; label: string }[] = [
  { value: EducationLevel.SECONDARY_SCHOOL, label: '10th / Secondary School' },
  { value: EducationLevel.HIGHER_SECONDARY, label: '12th / Higher Secondary' },
  { value: EducationLevel.DIPLOMA, label: 'Diploma' },
  { value: EducationLevel.BACHELORS, label: "Bachelor's Degree" },
  { value: EducationLevel.MASTERS, label: "Master's Degree" },
  { value: EducationLevel.DOCTORATE, label: 'Doctorate' },
]

const NOTICE_PERIODS = [
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: '15_DAYS', label: '15 Days' },
  { value: '30_DAYS', label: '30 Days' },
  { value: '60_DAYS', label: '60 Days' },
  { value: '90_PLUS_DAYS', label: '90+ Days' },
]

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
]

const educationSchema = z.object({
  degree: z.string().optional(),
  specialization: z.string().optional(),
  institution: z.string().min(1, 'Institution is required'),
  board: z.string().optional(),
  stream: z.string().optional(),
  year_of_passing: z.number({ message: 'Year of passing is required' })
    .min(1950, 'Year must be 1950 or later')
    .max(new Date().getFullYear() + 5, 'Year cannot be in the future'),
  grade: z.string().optional(),
  level: z.nativeEnum(EducationLevel),
})

const experienceSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  title: z.string().min(1, 'Title is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().nullable().optional(),
  currently_working: z.boolean(),
  responsibilities: z.string().optional(),
})

const applicationSchema = z.object({
  profile: z.object({
    first_name: z.string().min(1, 'First name is required').max(50),
    last_name: z.string().min(1, 'Last name is required').max(50),
    mobile: z.string().min(1, 'Mobile is required').max(20),
    current_location: z.string().min(1, 'Current location is required').max(120),
    gender: z.nativeEnum({ MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER', PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY' }).optional(),
    date_of_birth: z.string().optional(),
    current_company: z.string().max(120).optional(),
    notice_period: z.nativeEnum({ IMMEDIATE: 'IMMEDIATE', '15_DAYS': '15_DAYS', '30_DAYS': '30_DAYS', '60_DAYS': '60_DAYS', '90_PLUS_DAYS': '90_PLUS_DAYS' }).optional(),
    current_address: z.string().max(1000).optional(),
  }),
  education: z.array(educationSchema).max(20, 'Too many education records'),
  experience: z.array(experienceSchema).max(20, 'Too many experience records'),
  cover_note: z.string().max(3500).optional(),
  consent_accuracy: z.boolean().refine((v) => v === true, 'You must accept the data accuracy declaration'),
  consent_privacy: z.boolean().refine((v) => v === true, 'You must accept the privacy policy'),
})

type ApplicationForm = z.infer<typeof applicationSchema>

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)

  const shareJob = async (job: Job) => {
    const url = `${window.location.origin}/jobs/${job.id}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: job.title,
          text: `${job.title} at ${job.department}`,
          url,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(url)
          toast.success('Job link copied!')
        }
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Job link copied!')
    }
  }

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id!),
    enabled: !!id,
  })

  const { data: profile } = useQuery({
    queryKey: ['candidateProfile'],
    queryFn: candidateApi.getProfile,
    enabled: !!user,
  })

  const { data: educations } = useQuery({
    queryKey: ['candidateEducation'],
    queryFn: candidateApi.listEducation,
    enabled: !!user,
  })

  const { data: experiences } = useQuery({
    queryKey: ['candidateExperience'],
    queryFn: candidateApi.listExperience,
    enabled: !!user,
  })

  const submitMutation = useMutation({
    mutationFn: (data: { formData: ApplicationSubmit; resume: File }) =>
      candidateApi.submitApplication(id!, data.formData, data.resume),
    onSuccess: (result) => {
      toast.success(`Application submitted! Application number: ${result.application_number}`)
      setShowApplyModal(false)
      setResumeFile(null)
      queryClient.invalidateQueries({ queryKey: ['candidateApplications'] })
      navigate('/candidate/applications')
    },
    onError: (error: any) => {
      const backendError = error?.response?.data
      const message =
        backendError?.detail ||
        backendError?.message ||
        (error instanceof Error ? error.message : 'Failed to submit application')
      toast.error(typeof message === 'string' ? message : JSON.stringify(message))
    },
  })

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ApplicationForm>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      profile: {
        first_name: '',
        last_name: '',
        mobile: '',
        current_location: '',
        gender: undefined,
        date_of_birth: undefined,
        current_company: undefined,
        notice_period: undefined,
        current_address: undefined,
      },
      education: [],
      experience: [],
      consent_accuracy: false,
      consent_privacy: false,
    },
  })

  const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({
    control,
    name: 'education',
  })

  const { fields: experienceFields, append: appendExperience, remove: removeExperience } = useFieldArray({
    control,
    name: 'experience',
  })

  useEffect(() => {
    if (showApplyModal && user) {
      reset({
        profile: {
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          mobile: profile?.mobile || '',
          current_location: profile?.current_location || '',
          gender: profile?.gender || undefined,
          date_of_birth: profile?.date_of_birth ? profile.date_of_birth.split('T')[0] : undefined,
          current_company: profile?.current_company || undefined,
          notice_period: profile?.notice_period || undefined,
          current_address: profile?.current_address || undefined,
        },
        education: educations && educations.length > 0
          ? educations.map((e) => ({
              degree: e.degree ?? '',
              specialization: e.specialization ?? '',
              institution: e.institution ?? '',
              board: e.board ?? '',
              stream: e.stream ?? '',
              year_of_passing: e.year_of_passing,
              grade: e.grade ?? '',
              level: e.level,
            }))
          : [],
        experience: experiences && experiences.length > 0
          ? experiences.map((e) => ({
              company: e.company ?? '',
              title: e.title ?? '',
              start_date: e.start_date ? e.start_date.split('T')[0] : '',
              end_date: e.end_date ? e.end_date.split('T')[0] : undefined,
              currently_working: e.currently_working ?? false,
              responsibilities: e.responsibilities ?? '',
            }))
          : [],
        cover_note: '',
        consent_accuracy: false,
        consent_privacy: false,
      })
    }
  }, [showApplyModal, profile, educations, experiences, user, reset])

  const onSubmit = async (data: ApplicationForm) => {
    if (!resumeFile) {
      toast.error('Please upload your resume')
      return
    }
    setIsSubmitting(true)
    try {
      const formattedData: ApplicationSubmit = {
        profile: {
          ...data.profile,
          date_of_birth: data.profile.date_of_birth || undefined,
        },
        education: data.education.map((e) => ({
          degree: e.degree?.trim() || null,
          specialization: e.specialization?.trim() || null,
          institution: e.institution.trim(),
          board: e.board?.trim() || null,
          stream: e.stream?.trim() || null,
          year_of_passing: Number(e.year_of_passing),
          grade: e.grade?.trim() || null,
          level: e.level,
        })),
        experience: data.experience.map((e) => ({
          company: e.company.trim(),
          title: e.title.trim(),
          start_date: e.start_date,
          end_date: e.currently_working ? null : (e.end_date || null),
          currently_working: e.currently_working,
          responsibilities: e.responsibilities?.trim() || '',
        })),
        cover_note: data.cover_note?.trim() || undefined,
        consent_accuracy: data.consent_accuracy,
        consent_privacy: data.consent_privacy,
      }

      await submitMutation.mutateAsync({ formData: formattedData, resume: resumeFile })
    } catch {
      // Error handled in submitMutation.onError
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!job) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <p className="text-gray-600">Job not found</p>
        </CardBody>
      </Card>
    )
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link to="/jobs" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job header */}
          <Card>
            <CardBody>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                    <Badge variant="published">{job.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      {job.department}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Requisition ID</p>
                    <p className="font-mono text-lg font-medium text-gray-900">{job.requisition_id}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => shareJob(job)}>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    Share
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Responsibilities</h2>
            </CardHeader>
            <CardBody>
              <div className="prose prose-gray max-w-none whitespace-pre-wrap">{job.responsibilities}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Requirements</h2>
            </CardHeader>
            <CardBody>
              <div className="prose prose-gray max-w-none whitespace-pre-wrap">{job.requirements}</div>
            </CardBody>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Openings</dt>
                  <dd className="font-medium text-gray-900">{job.openings}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Hiring Manager</dt>
                  <dd className="font-medium text-gray-900">{job.hiring_manager}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Posted Date</dt>
                  <dd className="font-medium text-gray-900">{job.posted_date ? formatDate(job.posted_date) : 'Not published'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Application Deadline</dt>
                  <dd className="font-medium text-gray-900">{job.application_end_date ? formatDate(job.application_end_date) : 'Open until filled'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd className="font-medium text-gray-900">
                    <Badge variant="published">{job.status}</Badge>
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar - Apply */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Apply for this position</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {user ? (
                <>
                  <p className="text-sm text-gray-600">
                    Fill out the application form and upload your resume.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => setShowApplyModal(true)}
                    disabled={job.status !== 'PUBLISHED'}
                  >
                    Apply Now
                  </Button>
                  {job.status !== 'PUBLISHED' && (
                    <p className="text-xs text-gray-500 text-center">
                      This position is not currently accepting applications.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    You need to be logged in to apply for this position.
                  </p>
                  <Button className="w-full" onClick={() => navigate('/login', { state: { redirect: `/jobs/${job.id}` } })}>
                    Sign in to Apply
                  </Button>
                  <p className="text-center text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">
                      Sign up
                    </Link>
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <ApplicationModal
          job={job}
          profile={profile}
          onClose={() => setShowApplyModal(false)}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting || submitMutation.isPending}
          formMethods={{ register, control, handleSubmit, watch, setValue, errors, educationFields, appendEducation, removeEducation, experienceFields, appendExperience, removeExperience }}
          resumeFile={resumeFile}
          setResumeFile={setResumeFile}
        />
      )}
    </div>
  )
}

// Separate modal component to avoid re-render issues
function ApplicationModal({
  job,
  profile,
  onClose,
  onSubmit,
  isSubmitting,
  formMethods,
  resumeFile,
  setResumeFile,
}: {
  job: Job
  profile: any
  onClose: () => void
  onSubmit: (data: ApplicationForm) => void
  isSubmitting: boolean
  formMethods: any
  resumeFile: File | null
  setResumeFile: (file: File | null) => void
}) {
  const { register, control, handleSubmit, watch, setValue, errors, educationFields, appendEducation, removeEducation, experienceFields, appendExperience, removeExperience } = formMethods

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Background backdrop - clicking outside closes modal */}
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity" onClick={onClose} />

      {/* Modal Dialog Card - stop propagation so clicks inside do not close */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h3 className="text-lg font-semibold text-gray-900">Apply for {job.title}</h3>
            <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Profile Section */}
            <div className="mb-8">
              <h4 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input {...register('profile.first_name')} error={errors.profile?.first_name?.message} />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input {...register('profile.last_name')} error={errors.profile?.last_name?.message} />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile *</Label>
                  <Input {...register('profile.mobile')} error={errors.profile?.mobile?.message} />
                </div>
                <div>
                  <Label htmlFor="current_location">Current Location *</Label>
                  <Input {...register('profile.current_location')} error={errors.profile?.current_location?.message} />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select {...register('profile.gender')}>
                    <option value="">Select</option>
                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input type="date" {...register('profile.date_of_birth')} />
                </div>
                <div>
                  <Label htmlFor="current_company">Current Company</Label>
                  <Input {...register('profile.current_company')} />
                </div>
                <div>
                  <Label htmlFor="notice_period">Notice Period</Label>
                  <Select {...register('profile.notice_period')}>
                    <option value="">Select</option>
                    {NOTICE_PERIODS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="current_address">Current Address</Label>
                  <Textarea {...register('profile.current_address')} rows={3} />
                </div>
              </div>
            </div>

            {/* Education Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">Education</h4>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    appendEducation({
                      degree: '',
                      specialization: '',
                      institution: '',
                      board: '',
                      stream: '',
                      year_of_passing: new Date().getFullYear(),
                      grade: '',
                      level: EducationLevel.BACHELORS,
                    })
                  }
                >
                  Add Education
                </Button>
              </div>
              {educationFields.map((field: any, index: number) => {
                const currentLevel = watch(`education.${index}.level`)
                const isSecondary = currentLevel === EducationLevel.SECONDARY_SCHOOL
                const isHigherSecondary = currentLevel === EducationLevel.HIGHER_SECONDARY

                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-gray-900">Education #{index + 1}</h5>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeEducation(index)} className="text-red-600">
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {isSecondary && (
                        <>
                          <div>
                            <Label>School / Institution *</Label>
                            <Input {...register(`education.${index}.institution`)} error={errors.education?.[index]?.institution?.message} />
                          </div>
                          <div>
                            <Label>Board</Label>
                            <Input {...register(`education.${index}.board`)} error={errors.education?.[index]?.board?.message} />
                          </div>
                          <div>
                            <Label>Year of Passing *</Label>
                            <Input type="number" {...register(`education.${index}.year_of_passing`, { valueAsNumber: true })} error={errors.education?.[index]?.year_of_passing?.message} />
                          </div>
                          <div>
                            <Label>Percentage / Grade</Label>
                            <Input {...register(`education.${index}.grade`)} error={errors.education?.[index]?.grade?.message} />
                          </div>
                        </>
                      )}

                      {isHigherSecondary && (
                        <>
                          <div>
                            <Label>School / Institution *</Label>
                            <Input {...register(`education.${index}.institution`)} error={errors.education?.[index]?.institution?.message} />
                          </div>
                          <div>
                            <Label>Board</Label>
                            <Input {...register(`education.${index}.board`)} error={errors.education?.[index]?.board?.message} />
                          </div>
                          <div>
                            <Label>Stream</Label>
                            <Input placeholder="e.g. Science, Commerce, Arts" {...register(`education.${index}.stream`)} error={errors.education?.[index]?.stream?.message} />
                          </div>
                          <div>
                            <Label>Year of Passing *</Label>
                            <Input type="number" {...register(`education.${index}.year_of_passing`, { valueAsNumber: true })} error={errors.education?.[index]?.year_of_passing?.message} />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Percentage / Grade</Label>
                            <Input {...register(`education.${index}.grade`)} error={errors.education?.[index]?.grade?.message} />
                          </div>
                        </>
                      )}

                      {!isSecondary && !isHigherSecondary && (
                        <>
                          <div>
                            <Label>Degree</Label>
                            <Input {...register(`education.${index}.degree`)} error={errors.education?.[index]?.degree?.message} />
                          </div>
                          <div>
                            <Label>Specialization</Label>
                            <Input {...register(`education.${index}.specialization`)} error={errors.education?.[index]?.specialization?.message} />
                          </div>
                          <div>
                            <Label>Institution *</Label>
                            <Input {...register(`education.${index}.institution`)} error={errors.education?.[index]?.institution?.message} />
                          </div>
                          <div>
                            <Label>Year of Passing *</Label>
                            <Input type="number" {...register(`education.${index}.year_of_passing`, { valueAsNumber: true })} error={errors.education?.[index]?.year_of_passing?.message} />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Percentage / Grade</Label>
                            <Input {...register(`education.${index}.grade`)} error={errors.education?.[index]?.grade?.message} />
                          </div>
                        </>
                      )}

                      <div className="md:col-span-2">
                        <Label>Level *</Label>
                        <Select {...register(`education.${index}.level`)} error={errors.education?.[index]?.level?.message}>
                          {EDUCATION_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </Select>
                      </div>
                    </div>
                  </div>
                )
              })}
              {educationFields.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No education records added yet</p>
              )}
            </div>

            {/* Experience Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">Work Experience</h4>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    appendExperience({
                      company: '',
                      title: '',
                      start_date: '',
                      end_date: '',
                      currently_working: false,
                      responsibilities: '',
                    })
                  }
                >
                  Add Experience
                </Button>
              </div>
              {experienceFields.map((field: any, index: number) => {
                const isCurrentlyWorking = watch(`experience.${index}.currently_working`)

                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-gray-900">Experience #{index + 1}</h5>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeExperience(index)} className="text-red-600">
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Company *</Label>
                        <Input {...register(`experience.${index}.company`)} error={errors.experience?.[index]?.company?.message} />
                      </div>
                      <div>
                        <Label>Title *</Label>
                        <Input {...register(`experience.${index}.title`)} error={errors.experience?.[index]?.title?.message} />
                      </div>
                      <div>
                        <Label>Start Date *</Label>
                        <Input type="date" {...register(`experience.${index}.start_date`)} error={errors.experience?.[index]?.start_date?.message} />
                      </div>
                      <div>
                        <Label>End Date {!isCurrentlyWorking && '*'}</Label>
                        <Input type="date" disabled={isCurrentlyWorking} {...register(`experience.${index}.end_date`)} error={errors.experience?.[index]?.end_date?.message} />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-4">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" {...register(`experience.${index}.currently_working`)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm">Currently working here</span>
                        </Label>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Responsibilities</Label>
                        <Textarea {...register(`experience.${index}.responsibilities`)} rows={3} />
                      </div>
                    </div>
                  </div>
                )
              })}
              {experienceFields.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No work experience added yet</p>
              )}
            </div>

            {/* Cover Note */}
            <div className="mb-8">
              <Label htmlFor="cover_note">Cover Note (Optional)</Label>
              <Textarea id="cover_note" {...register('cover_note')} rows={4} placeholder="Why are you a good fit for this role?" />
            </div>

            {/* Resume Upload */}
            <div className="mb-8">
              <Label>Resume *</Label>
              <FileUploader
                onFileSelect={setResumeFile}
                currentFile={resumeFile}
                label="Resume"
                helpText="PDF, DOC, DOCX up to 5MB"
              />
            </div>

            {/* Consents */}
            <div className="mb-8 space-y-4 border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900">Declarations</h4>
              <div className="space-y-3">
                <Label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" {...register('consent_accuracy')} className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <div>
                    <p className="font-medium text-gray-900">Data Accuracy Declaration</p>
                    <p className="text-sm text-gray-600">I declare that all information provided in this application is true and accurate to the best of my knowledge.</p>
                  </div>
                </Label>
                {errors.consent_accuracy && <p className="text-sm text-red-600 ml-6">{errors.consent_accuracy.message}</p>}
                <Label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" {...register('consent_privacy')} className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <div>
                    <p className="font-medium text-gray-900">Privacy Policy Consent</p>
                    <p className="text-sm text-gray-600">I consent to the processing of my personal data in accordance with the Privacy Policy.</p>
                  </div>
                </Label>
                {errors.consent_privacy && <p className="text-sm text-red-600 ml-6">{errors.consent_privacy.message}</p>}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 sticky bottom-0 bg-white py-4 border-t border-gray-100">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={isSubmitting}>
                Submit Application
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}