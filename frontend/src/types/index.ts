export type UUID = string

export const UserRole = {
  CANDIDATE: 'CANDIDATE',
  ADMIN: 'ADMIN',
} as const
export type UserRole = typeof UserRole[keyof typeof UserRole]

export interface User {
  id: UUID
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export const JobStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
} as const
export type JobStatus = typeof JobStatus[keyof typeof JobStatus]

export const EmploymentType = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  INTERNSHIP: 'INTERNSHIP',
} as const
export type EmploymentType = typeof EmploymentType[keyof typeof EmploymentType]

export interface Job {
  id: UUID
  requisition_id: string
  title: string
  department: string
  location: string
  employment_type: EmploymentType
  experience_range: string
  openings: number
  hiring_manager: string
  responsibilities: string
  requirements: string
  status: JobStatus
  posted_date: string | null
  application_end_date?: string | null
  created_at: string
  updated_at: string
  application_count?: number
}

export interface AdminJob extends Job {
  application_count: number
}

export interface JobListResponse {
  items: Job[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface Department {
  value: string
  label: string
}

export const ApplicationStatus = {
  NEW: 'NEW',
  REVIEWED: 'REVIEWED',
  SHORTLISTED: 'SHORTLISTED',
  REJECTED: 'REJECTED',
} as const
export type ApplicationStatus = typeof ApplicationStatus[keyof typeof ApplicationStatus]

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
} as const
export type Gender = typeof Gender[keyof typeof Gender]

export const NoticePeriod = {
  IMMEDIATE: 'IMMEDIATE',
  FIFTEEN_DAYS: '15_DAYS',
  THIRTY_DAYS: '30_DAYS',
  SIXTY_DAYS: '60_DAYS',
  NINETY_PLUS_DAYS: '90_PLUS_DAYS',
} as const
export type NoticePeriod = typeof NoticePeriod[keyof typeof NoticePeriod]

export const EducationLevel = {
  HIGH_SCHOOL: 'HIGH_SCHOOL',
  DIPLOMA: 'DIPLOMA',
  BACHELORS: 'BACHELORS',
  MASTERS: 'MASTERS',
  DOCTORATE: 'DOCTORATE',
  SECONDARY_SCHOOL: 'SECONDARY_SCHOOL',
  HIGHER_SECONDARY: 'HIGHER_SECONDARY',
} as const
export type EducationLevel = typeof EducationLevel[keyof typeof EducationLevel]

export interface Education {
  id: UUID
  degree?: string | null
  specialization?: string | null
  institution: string
  board?: string | null
  stream?: string | null
  year_of_passing: number
  grade?: string | null
  level: EducationLevel
  created_at?: string
}

export interface WorkExperience {
  id: UUID
  company: string
  title: string
  start_date: string
  end_date: string | null
  currently_working: boolean
  responsibilities: string
  created_at: string
}

export interface CandidateProfile {
  id: UUID
  user_id: UUID
  first_name: string
  last_name: string
  mobile: string
  current_location: string
  gender: Gender | null
  date_of_birth: string | null
  current_company: string | null
  notice_period: NoticePeriod | null
  current_address: string | null
  photo_url: string | null
  total_experience_months: number
  fresher: boolean
  educations: Education[]
  experiences: WorkExperience[]
  created_at: string
  updated_at: string
}

export interface ApplicationSubmitProfile {
  first_name: string
  last_name: string
  mobile: string
  current_location: string
  gender?: string
  date_of_birth?: string
  current_company?: string
  notice_period?: string
  current_address?: string
}

export interface ApplicationSubmitExperience {
  company: string
  title: string
  start_date: string
  end_date?: string | null
  currently_working: boolean
  responsibilities?: string
}

export interface ApplicationSubmitEducation {
  degree?: string | null
  specialization?: string | null
  institution: string
  board?: string | null
  stream?: string | null
  year_of_passing: number
  grade?: string | null
  level: EducationLevel
}

export interface ApplicationSubmit {
  profile: ApplicationSubmitProfile
  education: ApplicationSubmitEducation[]
  experience: ApplicationSubmitExperience[]
  cover_note?: string
  consent_accuracy: boolean
  consent_privacy: boolean
}

export interface Application {
  id: UUID
  application_number: string
  job_id: UUID
  job_title: string | null
  candidate_name: string
  current_location: string
  total_experience_months: number
  fresher: boolean
  status: ApplicationStatus
  applied_at: string
  email?: string
  mobile?: string
}

export interface AdminApplicationDetail extends Application {
  email: string
  mobile: string
  gender: Gender | null
  date_of_birth: string | null
  current_company: string | null
  notice_period: NoticePeriod | null
  fresher: boolean
  cover_note: string | null
  resume_original_name: string
  resume_url: string
  consent_accuracy: boolean
  consent_privacy: boolean
  updated_at: string
  current_address: string | null
  education: Education[]
  experience: WorkExperience[]
}

export interface ApplicationListResponse {
  items: Application[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface Notification {
  id: UUID
  user_id: UUID
  type: 'NEW_APPLICATION' | 'STATUS_CHANGED' | 'SYSTEM'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface NotificationListResponse {
  items: Notification[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface PaginatedParams {
  page?: number
  page_size?: number
}

export interface JobSearchParams extends PaginatedParams {
  search?: string
  department?: string
  location?: string
  employment_type?: EmploymentType
  experience_min?: number
  experience_max?: number
}

export interface ApplicationListParams extends PaginatedParams {
  job_id?: UUID
  status?: ApplicationStatus
  candidate_name?: string
  search?: string
}

export interface NotificationParams extends PaginatedParams {
  is_read?: boolean
}