import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { candidateApi } from '../../api/candidate'
import { Education, WorkExperience, EducationLevel } from '../../types'
import { Button, Input, Textarea, Select, Label, Card, CardHeader, CardBody, Badge, FileUploader } from '../../components/ui'

const EDUCATION_LEVELS: { value: EducationLevel; label: string }[] = [
  { value: EducationLevel.HIGH_SCHOOL, label: 'High School' },
  { value: EducationLevel.SECONDARY_SCHOOL, label: '10th / Secondary School' },
  { value: EducationLevel.HIGHER_SECONDARY, label: '12th / Higher Secondary' },
  { value: EducationLevel.DIPLOMA, label: 'Diploma' },
  { value: EducationLevel.BACHELORS, label: "Bachelor's" },
  { value: EducationLevel.MASTERS, label: "Master's" },
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

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  mobile: z.string().min(1, 'Mobile is required').max(20),
  current_location: z.string().min(1, 'Current location is required').max(120),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  date_of_birth: z.string().optional(),
  current_company: z.string().max(120).optional(),
  notice_period: z.enum(['IMMEDIATE', '15_DAYS', '30_DAYS', '60_DAYS', '90_PLUS_DAYS']).optional(),
  current_address: z.string().max(1000).optional(),
})

const educationSchema = z.object({
  id: z.string().optional(),
  degree: z.string().optional(),
  specialization: z.string().optional(),
  institution: z.string().min(1, 'School / Institution is required'),
  board: z.string().optional(),
  stream: z.string().optional(),
  year_of_passing: z.number({ message: 'Year of passing is required' })
    .min(1950, 'Year must be 1950 or later')
    .max(new Date().getFullYear() + 5, 'Year cannot be in the future'),
  grade: z.string().optional(),
  level: z.nativeEnum(EducationLevel),
})

const experienceSchema = z.object({
  id: z.string().optional(),
  company: z.string().min(1, 'Company is required'),
  title: z.string().min(1, 'Title is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().nullable().optional(),
  currently_working: z.boolean(),
  responsibilities: z.string().optional(),
})

type ProfileForm = z.infer<typeof profileSchema>
type EducationForm = z.infer<typeof educationSchema>
type ExperienceForm = z.infer<typeof experienceSchema>

export function CandidateProfile() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'profile' | 'education' | 'experience' | 'photo'>('profile')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [deletingEducationIndex, setDeletingEducationIndex] = useState<number | null>(null)
  const [isSavingEducation, setIsSavingEducation] = useState(false)
  const [deletingExperienceIndex, setDeletingExperienceIndex] = useState<number | null>(null)
  const [isSavingExperience, setIsSavingExperience] = useState(false)

  // BUG FIX 1: ProfileResponse does NOT include educations/experiences.
  // Use the correct separate endpoints for each.
  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidateProfile'],
    queryFn: candidateApi.getProfile,
  })

  const { data: educations } = useQuery({
    queryKey: ['candidateEducation'],
    queryFn: candidateApi.listEducation,
  })

  const { data: experiences } = useQuery({
    queryKey: ['candidateExperience'],
    queryFn: candidateApi.listExperience,
  })

  // BUG FIX 2: ExperienceSummary returns { total_months, total_years } not { fresher, total_experience_months }
  const { data: experienceSummary } = useQuery({
    queryKey: ['experienceSummary'],
    queryFn: candidateApi.getExperienceSummary,
  })

  // Profile form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
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
  })

  // Education form
  const educationForm = useForm<{ education: EducationForm[] }>({
    resolver: zodResolver(z.object({ education: z.array(educationSchema).max(20) })),
    defaultValues: { education: [] },
  })

  // Experience form
  const experienceForm = useForm<{ experience: ExperienceForm[] }>({
    resolver: zodResolver(z.object({ experience: z.array(experienceSchema).max(20) })),
    defaultValues: { experience: [] },
  })

  const { register: regProfile, handleSubmit: handleSubmitProfile, formState: { errors: profileErrors } } = profileForm
  const {
    control: educationControl,
    register: regEducation,
    handleSubmit: handleSubmitEducation,
    formState: { errors: educationErrors },
    reset: resetEducation,
    watch: watchEducation,
  } = educationForm
  const {
    control: experienceControl,
    register: regExperience,
    handleSubmit: handleSubmitExperience,
    formState: { errors: experienceErrors },
    reset: resetExperience,
    watch: watchExperience,
  } = experienceForm

  const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({
    control: educationControl,
    name: 'education',
  })

  const { fields: experienceFields, append: appendExperience, remove: removeExperience } = useFieldArray({
    control: experienceControl,
    name: 'experience',
  })

  // BUG FIX 3: Initialize forms in useEffect, not during render.
  // Calling form.reset() during render calls setState during render — React anti-pattern.
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        mobile: profile.mobile ?? '',
        current_location: profile.current_location ?? '',
        gender: profile.gender || undefined,
        date_of_birth: profile.date_of_birth || undefined,
        current_company: profile.current_company || undefined,
        notice_period: profile.notice_period || undefined,
        current_address: profile.current_address || undefined,
      })
    }
  }, [profile])

  useEffect(() => {
    if (educations) {
      resetEducation({
        education: educations.map((e: Education) => ({
          id: e.id,
          degree: e.degree ?? '',
          specialization: e.specialization ?? '',
          institution: e.institution ?? '',
          board: e.board ?? '',
          stream: e.stream ?? '',
          year_of_passing: e.year_of_passing,
          grade: e.grade ?? '',
          level: e.level,
        })),
      })
    }
  }, [educations, resetEducation])

  const handleAddEducation = () => {
    appendEducation({
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      degree: '',
      specialization: '',
      institution: '',
      board: '',
      stream: '',
      year_of_passing: new Date().getFullYear(),
      grade: '',
      level: EducationLevel.SECONDARY_SCHOOL,
    })
  }

  const handleRemoveEducation = async (index: number) => {
    const currentItem = educationForm.getValues(`education.${index}`)
    if (!currentItem) return

    // If it's a persisted database record (has a real UUID, not temp-), delete from DB
    if (currentItem.id && !currentItem.id.startsWith('temp-')) {
      try {
        setDeletingEducationIndex(index)
        await candidateApi.deleteEducation(currentItem.id)
        toast.success('Education removed')
        removeEducation(index)
        await queryClient.invalidateQueries({ queryKey: ['candidateEducation'] })
      } catch (error: any) {
        const backendError = error?.response?.data
        const errorMsg = backendError?.detail || backendError?.message || (error instanceof Error ? error.message : 'Failed to remove education')
        toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
      } finally {
        setDeletingEducationIndex(null)
      }
    } else {
      // Unsaved local record: remove immediately from local UI state
      removeEducation(index)
    }
  }

  const handleSaveEducation = handleSubmitEducation(async (data) => {
    const items = data.education || []
    if (items.length === 0) {
      toast.error('No education records to save')
      return
    }

    try {
      setIsSavingEducation(true)
      const promises = items.map((item) => {
        const payload: Omit<Education, 'id' | 'created_at'> = {
          degree: item.degree?.trim() || null,
          specialization: item.specialization?.trim() || null,
          institution: item.institution.trim(),
          board: item.board?.trim() || null,
          stream: item.stream?.trim() || null,
          year_of_passing: Number(item.year_of_passing),
          grade: item.grade?.trim() || null,
          level: item.level,
        }

        if (item.id && !item.id.startsWith('temp-')) {
          return candidateApi.updateEducation(item.id, payload)
        } else {
          return candidateApi.createEducation(payload)
        }
      })

      await Promise.all(promises)
      toast.success('Education details saved successfully')
      await queryClient.invalidateQueries({ queryKey: ['candidateEducation'] })
    } catch (error: any) {
      const backendError = error?.response?.data
      const errorMsg = backendError?.detail || backendError?.message || (error instanceof Error ? error.message : 'Failed to save education details')
      toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
    } finally {
      setIsSavingEducation(false)
    }
  })

  useEffect(() => {
    if (experiences) {
      resetExperience({
        experience: experiences.map((e: WorkExperience) => ({
          id: e.id,
          company: e.company ?? '',
          title: e.title ?? '',
          start_date: e.start_date ? e.start_date.split('T')[0] : '',
          end_date: e.end_date ? e.end_date.split('T')[0] : null,
          currently_working: e.currently_working ?? false,
          responsibilities: e.responsibilities ?? '',
        })),
      })
    }
  }, [experiences, resetExperience])

  const handleAddExperience = () => {
    appendExperience({
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      company: '',
      title: '',
      start_date: '',
      end_date: null,
      currently_working: false,
      responsibilities: '',
    })
  }

  const handleRemoveExperience = async (index: number) => {
    const currentItem = experienceForm.getValues(`experience.${index}`)
    if (!currentItem) return

    if (currentItem.id && !currentItem.id.startsWith('temp-')) {
      try {
        setDeletingExperienceIndex(index)
        await candidateApi.deleteExperience(currentItem.id)
        toast.success('Experience removed')
        removeExperience(index)
        await queryClient.invalidateQueries({ queryKey: ['candidateExperience'] })
        await queryClient.invalidateQueries({ queryKey: ['experienceSummary'] })
      } catch (error: any) {
        const backendError = error?.response?.data
        const errorMsg = backendError?.detail || backendError?.message || (error instanceof Error ? error.message : 'Failed to remove experience')
        toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
      } finally {
        setDeletingExperienceIndex(null)
      }
    } else {
      removeExperience(index)
    }
  }

  const handleSaveExperience = handleSubmitExperience(async (data) => {
    const items = data.experience || []
    if (items.length === 0) {
      toast.error('No experience records to save')
      return
    }

    try {
      setIsSavingExperience(true)
      const promises = items.map((item: ExperienceForm) => {
        const payload: Omit<WorkExperience, 'id' | 'created_at'> = {
          company: item.company.trim(),
          title: item.title.trim(),
          start_date: item.start_date,
          end_date: item.currently_working ? null : (item.end_date || null),
          currently_working: item.currently_working,
          responsibilities: item.responsibilities?.trim() || '',
        }

        if (item.id && !item.id.startsWith('temp-')) {
          return candidateApi.updateExperience(item.id, payload)
        } else {
          return candidateApi.createExperience(payload)
        }
      })

      await Promise.all(promises)
      toast.success('Experience details saved successfully')
      await queryClient.invalidateQueries({ queryKey: ['candidateExperience'] })
      await queryClient.invalidateQueries({ queryKey: ['experienceSummary'] })
    } catch (error: any) {
      const backendError = error?.response?.data
      const errorMsg = backendError?.detail || backendError?.message || (error instanceof Error ? error.message : 'Failed to save experience details')
      toast.error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
    } finally {
      setIsSavingExperience(false)
    }
  })

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<ProfileForm>) => candidateApi.updateProfile(data as any),
    onSuccess: () => {
      toast.success('Profile updated successfully')
      queryClient.invalidateQueries({ queryKey: ['candidateProfile'] })
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to update profile'),
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => candidateApi.uploadPhoto(file),
    onSuccess: () => {
      toast.success('Photo updated')
      queryClient.invalidateQueries({ queryKey: ['candidateProfile'] })
      setPhotoFile(null)
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to upload photo'),
  })

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <Card><CardBody><div className="h-4 bg-gray-200 rounded w-1/4" /></CardBody></Card>
        <Card><CardBody><div className="h-4 bg-gray-200 rounded w-1/2" /></CardBody></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-1">Manage your professional information</p>
        </div>
        {/* BUG FIX 2: backend returns total_months / total_years, not fresher / total_experience_months */}
        {experienceSummary && (
          <Badge variant={experienceSummary.total_months === 0 ? 'new' : 'published'}>
            {experienceSummary.total_months === 0 ? 'Fresher' : `${experienceSummary.total_months} months experience`}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Profile sections">
          {[
            { id: 'profile', label: 'Personal Info' },
            { id: 'education', label: 'Education' },
            { id: 'experience', label: 'Experience' },
            { id: 'photo', label: 'Photo' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmitProfile((data) => {
  const cleanData = {
    first_name: data.first_name,
    last_name: data.last_name,
    mobile: data.mobile.startsWith('+') ? data.mobile : `+91${data.mobile}`,
    current_location: data.current_location,
    ...(data.gender && { gender: data.gender }),
    ...(data.date_of_birth && { date_of_birth: data.date_of_birth }),
    ...(data.current_company && { current_company: data.current_company }),
    ...(data.notice_period && { notice_period: data.notice_period }),
    ...(data.current_address && { current_address: data.current_address }),
  };
  updateProfileMutation.mutate(cleanData);
})} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input {...regProfile('first_name')} error={profileErrors.first_name?.message} />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input {...regProfile('last_name')} error={profileErrors.last_name?.message} />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile *</Label>
                  <Input {...regProfile('mobile')} error={profileErrors.mobile?.message} />
                </div>
                <div>
                  <Label htmlFor="current_location">Current Location *</Label>
                  <Input {...regProfile('current_location')} error={profileErrors.current_location?.message} />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select {...regProfile('gender')}>
                    <option value="">Select</option>
                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input type="date" {...regProfile('date_of_birth')} />
                </div>
                <div>
                  <Label htmlFor="current_company">Current Company</Label>
                  <Input {...regProfile('current_company')} />
                </div>
                <div>
                  <Label htmlFor="notice_period">Notice Period</Label>
                  <Select {...regProfile('notice_period')}>
                    <option value="">Select</option>
                    {NOTICE_PERIODS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="current_address">Current Address</Label>
                <Textarea {...regProfile('current_address')} rows={3} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={updateProfileMutation.isPending}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Education Tab */}
      {activeTab === 'education' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Education</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddEducation}
            >
              Add Education
            </Button>
          </CardHeader>
          <CardBody>
            {educationFields.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No education records</h3>
                <p className="mt-2 text-gray-600">Add your educational background</p>
              </div>
            ) : (
              <div className="space-y-4">
                {educationFields.map((field, index) => {
                  const level = watchEducation(`education.${index}.level`) || field.level

                  return (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-gray-900">Education #{index + 1}</h5>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEducation(index)}
                          loading={deletingEducationIndex === index}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {level === EducationLevel.SECONDARY_SCHOOL ? (
                          <>
                            <div>
                              <Label>School / Institution *</Label>
                              <Input
                                {...regEducation(`education.${index}.institution`)}
                                error={educationErrors.education?.[index]?.institution?.message}
                              />
                            </div>
                            <div>
                              <Label>Board *</Label>
                              <Input
                                {...regEducation(`education.${index}.board`)}
                                error={educationErrors.education?.[index]?.board?.message}
                              />
                            </div>
                            <div>
                              <Label>Year of Passing *</Label>
                              <Input
                                type="number"
                                {...regEducation(`education.${index}.year_of_passing`, {
                                  valueAsNumber: true,
                                })}
                                error={educationErrors.education?.[index]?.year_of_passing?.message}
                              />
                            </div>
                            <div>
                              <Label>Percentage / Grade *</Label>
                              <Input
                                {...regEducation(`education.${index}.grade`)}
                                error={educationErrors.education?.[index]?.grade?.message}
                              />
                            </div>
                          </>
                        ) : level === EducationLevel.HIGHER_SECONDARY ? (
                          <>
                            <div>
                              <Label>School / Institution *</Label>
                              <Input
                                {...regEducation(`education.${index}.institution`)}
                                error={educationErrors.education?.[index]?.institution?.message}
                              />
                            </div>
                            <div>
                              <Label>Board *</Label>
                              <Input
                                {...regEducation(`education.${index}.board`)}
                                error={educationErrors.education?.[index]?.board?.message}
                              />
                            </div>
                            <div>
                              <Label>Stream *</Label>
                              <Input
                                {...regEducation(`education.${index}.stream`)}
                                error={educationErrors.education?.[index]?.stream?.message}
                              />
                            </div>
                            <div>
                              <Label>Year of Passing *</Label>
                              <Input
                                type="number"
                                {...regEducation(`education.${index}.year_of_passing`, {
                                  valueAsNumber: true,
                                })}
                                error={educationErrors.education?.[index]?.year_of_passing?.message}
                              />
                            </div>
                            <div>
                              <Label>Percentage / Grade *</Label>
                              <Input
                                {...regEducation(`education.${index}.grade`)}
                                error={educationErrors.education?.[index]?.grade?.message}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <Label>Degree *</Label>
                              <Input
                                {...regEducation(`education.${index}.degree`)}
                                error={educationErrors.education?.[index]?.degree?.message}
                              />
                            </div>
                            <div>
                              <Label>Specialization *</Label>
                              <Input
                                {...regEducation(`education.${index}.specialization`)}
                                error={educationErrors.education?.[index]?.specialization?.message}
                              />
                            </div>
                            <div>
                              <Label>Institution *</Label>
                              <Input
                                {...regEducation(`education.${index}.institution`)}
                                error={educationErrors.education?.[index]?.institution?.message}
                              />
                            </div>
                            <div>
                              <Label>Year of Passing *</Label>
                              <Input
                                type="number"
                                {...regEducation(`education.${index}.year_of_passing`, {
                                  valueAsNumber: true,
                                })}
                                error={educationErrors.education?.[index]?.year_of_passing?.message}
                              />
                            </div>
                            <div>
                              <Label>Percentage / Grade *</Label>
                              <Input
                                {...regEducation(`education.${index}.grade`)}
                                error={educationErrors.education?.[index]?.grade?.message}
                              />
                            </div>
                          </>
                        )}

                        <div>
                          <Label>Level *</Label>
                          <Select
                            {...regEducation(`education.${index}.level`)}
                            error={educationErrors.education?.[index]?.level?.message}
                          >
                            {EDUCATION_LEVELS.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={handleSaveEducation}
                loading={isSavingEducation}
              >
                Save Education
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
      {/* Experience Tab */}
      {activeTab === 'experience' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Work Experience</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddExperience}
            >
              Add Experience
            </Button>
          </CardHeader>
          <CardBody>
            {experienceFields.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No work experience</h3>
                <p className="mt-2 text-gray-600">Add your professional experience</p>
              </div>
            ) : (
              <div className="space-y-4">
                {experienceFields.map((field, index) => {
                  const isCurrentlyWorking = watchExperience(`experience.${index}.currently_working`)

                  return (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-gray-900">Experience #{index + 1}</h5>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExperience(index)}
                          loading={deletingExperienceIndex === index}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Company *</Label>
                          <Input
                            {...regExperience(`experience.${index}.company`)}
                            error={experienceErrors.experience?.[index]?.company?.message}
                          />
                        </div>
                        <div>
                          <Label>Title *</Label>
                          <Input
                            {...regExperience(`experience.${index}.title`)}
                            error={experienceErrors.experience?.[index]?.title?.message}
                          />
                        </div>
                        <div>
                          <Label>Start Date *</Label>
                          <Input
                            type="date"
                            {...regExperience(`experience.${index}.start_date`)}
                            error={experienceErrors.experience?.[index]?.start_date?.message}
                          />
                        </div>
                        <div>
                          <Label>End Date {!isCurrentlyWorking && '*'}</Label>
                          <Input
                            type="date"
                            disabled={isCurrentlyWorking}
                            {...regExperience(`experience.${index}.end_date`)}
                            error={experienceErrors.experience?.[index]?.end_date?.message}
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-4">
                          <Label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              {...regExperience(`experience.${index}.currently_working`)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm">Currently working here</span>
                          </Label>
                        </div>
                        <div className="md:col-span-2">
                          <Label>Responsibilities</Label>
                          <Textarea {...regExperience(`experience.${index}.responsibilities`)} rows={3} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={handleSaveExperience}
                loading={isSavingExperience}
              >
                Save Experience
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Photo Tab */}
      {activeTab === 'photo' && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Profile Photo</h2>
          </CardHeader>
          <CardBody>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                {profile?.photo_path ? (
                  <img src={profile.photo_path} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-medium text-gray-400">
                    {profile?.first_name?.charAt(0) || '?'}{profile?.last_name?.charAt(0) || ''}
                  </span>
                )}
              </div>
              <div>
                <FileUploader
                  accept="image/jpeg,image/png,image/webp"
                  maxSizeMB={2}
                  onFileSelect={setPhotoFile}
                  currentFile={photoFile}
                  label="Photo"
                  helpText="JPG, PNG, WebP up to 2MB"
                />
                {photoFile && (
                  <Button className="mt-4" onClick={() => uploadPhotoMutation.mutate(photoFile)} loading={uploadPhotoMutation.isPending}>
                    Upload Photo
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}