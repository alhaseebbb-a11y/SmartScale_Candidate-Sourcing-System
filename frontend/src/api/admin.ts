import api from './axiosInstance'
import type { AdminApplicationDetail, ApplicationListResponse, ApplicationListParams, Notification, NotificationListResponse, NotificationParams, Application, Job, JobListResponse } from '../types'

export const adminApplicationsApi = {
  list: async (params: ApplicationListParams = {}): Promise<ApplicationListResponse> => {
    const queryParams: Record<string, unknown> = {
      page: params.page,
      page_size: params.page_size,
      status: params.status,
      search: params.search || params.candidate_name,
      job_id: params.job_id,
    }
    const response = await api.get('/admin/applications', { params: queryParams })
    return response.data
  },

  listByJob: async (jobId: string, params: ApplicationListParams = {}): Promise<ApplicationListResponse> => {
    const response = await api.get(`/admin/jobs/${jobId}/applications`, { params })
    return response.data
  },

  get: async (id: string): Promise<AdminApplicationDetail> => {
    const response = await api.get(`/admin/applications/${id}`)
    return response.data
  },

  downloadResume: async (id: string): Promise<Blob> => {
    const response = await api.get(`/admin/applications/${id}/resume`, { responseType: 'blob' })
    return response.data
  },

  updateStatus: async (id: string, status: string): Promise<AdminApplicationDetail> => {
    const response = await api.patch(`/admin/applications/${id}/status`, { status })
    return response.data
  },

  exportCsv: async (jobId?: string): Promise<Blob> => {
    const params = jobId ? { job_id: jobId } : {}
    const response = await api.get('/admin/applications/export', { params, responseType: 'blob' })
    return response.data
  },

  exportCsvByJob: async (jobId: string): Promise<Blob> => {
    const response = await api.get(`/admin/jobs/${jobId}/applications/export`, { responseType: 'blob' })
    return response.data
  },
}

export const adminJobsApi = {
  list: async (params: { page?: number; page_size?: number; search?: string; department?: string; location?: string; employment_type?: string; status?: string; experience?: string } = {}): Promise<JobListResponse> => {
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

export const notificationsApi = {
  list: async (params: NotificationParams = {}): Promise<NotificationListResponse> => {
    const response = await api.get('/notifications', { params })
    return response.data
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const response = await api.get('/notifications/unread-count')
    return response.data
  },

  markRead: async (id: string): Promise<Notification> => {
    const response = await api.patch(`/notifications/${id}/read`)
    return response.data
  },

  markAllRead: async (): Promise<{ message: string }> => {
    const response = await api.post('/notifications/read-all')
    return response.data
  },
}