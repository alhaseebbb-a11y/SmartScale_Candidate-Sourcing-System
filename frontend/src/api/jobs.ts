import api from './axiosInstance'
import type { Job, JobListResponse, JobSearchParams, Department } from '../types'

export const jobsApi = {
  list: async (params: JobSearchParams = {}): Promise<JobListResponse> => {
    const response = await api.get('/jobs', { params })
    return response.data
  },

  get: async (id: string): Promise<Job> => {
    const response = await api.get(`/jobs/${id}`)
    return response.data
  },

  getDepartments: async (): Promise<Department[]> => {
    const response = await api.get('/meta/departments')
    // Backend returns { departments: string[] } — extract the array and
    // transform each string into the { value, label } shape the UI expects.
    const raw: string[] = response.data?.departments ?? []
    return raw.map((d) => ({ value: d, label: d }))
  },
}

export const adminJobsApi = {
  list: async (params: JobSearchParams = {}): Promise<JobListResponse> => {
    const response = await api.get('/admin/jobs', { params })
    return response.data
  },

  get: async (id: string): Promise<Job> => {
    const response = await api.get(`/admin/jobs/${id}`)
    return response.data
  },

  create: async (data: Partial<Job>): Promise<Job> => {
    const response = await api.post('/admin/jobs', data)
    return response.data
  },

  update: async (id: string, data: Partial<Job>): Promise<Job> => {
    const response = await api.put(`/admin/jobs/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/admin/jobs/${id}`)
  },

  duplicate: async (id: string): Promise<Job> => {
    const response = await api.post(`/admin/jobs/${id}/duplicate`)
    return response.data
  },

  publish: async (id: string): Promise<Job> => {
    const response = await api.patch(`/admin/jobs/${id}/publish`)
    return response.data
  },

  close: async (id: string): Promise<Job> => {
    const response = await api.patch(`/admin/jobs/${id}/close`)
    return response.data
  },
}