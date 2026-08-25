import api from './axiosInstance'
import type { CandidateProfile, Education, WorkExperience, ExperienceSummary, Application, ApplicationListResponse, ApplicationSubmit, ApplicationSubmitProfile, ApplicationSubmitEducation, ApplicationSubmitExperience } from '../types'

export const candidateApi = {
  getProfile: async (): Promise<CandidateProfile> => {
    const response = await api.get('/candidate/profile')
    return response.data
  },

  updateProfile: async (data: Partial<CandidateProfile>): Promise<CandidateProfile> => {
    const response = await api.put('/candidate/profile', data)
    return response.data
  },

  uploadPhoto: async (file: File): Promise<{ photo_url: string }> => {
    const formData = new FormData()
    formData.append('photo', file)
    const response = await api.post('/candidate/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  getExperienceSummary: async (): Promise<ExperienceSummary> => {
    const response = await api.get('/candidate/experience-summary')
    return response.data
  },

  // Education
  listEducation: async (): Promise<Education[]> => {
    const response = await api.get('/candidate/education')
    return response.data
  },

  createEducation: async (data: Omit<Education, 'id' | 'created_at'>): Promise<Education> => {
    const response = await api.post('/candidate/education', data)
    return response.data
  },

  updateEducation: async (id: string, data: Partial<Education>): Promise<Education> => {
    const response = await api.put(`/candidate/education/${id}`, data)
    return response.data
  },

  deleteEducation: async (id: string): Promise<void> => {
    await api.delete(`/candidate/education/${id}`)
  },

  // Experience
  listExperience: async (): Promise<WorkExperience[]> => {
    const response = await api.get('/candidate/experience')
    return response.data
  },

  createExperience: async (data: Omit<WorkExperience, 'id' | 'created_at'>): Promise<WorkExperience> => {
    const response = await api.post('/candidate/experience', data)
    return response.data
  },

  updateExperience: async (id: string, data: Partial<WorkExperience>): Promise<WorkExperience> => {
    const response = await api.put(`/candidate/experience/${id}`, data)
    return response.data
  },

  deleteExperience: async (id: string): Promise<void> => {
    await api.delete(`/candidate/experience/${id}`)
  },

  // Applications
  listApplications: async (params: { page?: number; page_size?: number } = {}): Promise<ApplicationListResponse> => {
    const response = await api.get('/candidate/applications', { params })
    return response.data
  },

  getApplication: async (id: string): Promise<Application> => {
    const response = await api.get(`/candidate/applications/${id}`)
    return response.data
  },

  submitApplication: async (jobId: string, data: ApplicationSubmit, resume: File): Promise<{ id: string; application_number: string }> => {
    const formData = new FormData()
    formData.append('payload', JSON.stringify(data))
    formData.append('resume', resume)
    const response = await api.post(`/jobs/${jobId}/applications`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
}