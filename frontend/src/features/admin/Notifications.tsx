import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { notificationsApi } from '../../api/admin'
import { Notification } from '../../types'
import { Button, Card, CardHeader, CardBody, Badge, Table, Pagination, Modal, Select, Label } from '../../components/ui'

const NOTIFICATION_TYPE_ICONS = {
  NEW_APPLICATION: <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  STATUS_CHANGED: <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  SYSTEM: <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
}

const NOTIFICATION_TYPE_LABELS = {
  NEW_APPLICATION: 'New Application',
  STATUS_CHANGED: 'Status Changed',
  SYSTEM: 'System',
}

export function AdminNotifications() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [isReadFilter, setIsReadFilter] = useState<boolean | undefined>(undefined)
  const [showDetail, setShowDetail] = useState<Notification | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, pageSize, isReadFilter],
    queryFn: () => notificationsApi.list({ page, page_size: pageSize, is_read: isReadFilter }),
    placeholderData: (previous) => previous,
  })

  const { data: unreadCount } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30000,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); queryClient.invalidateQueries({ queryKey: ['unreadCount'] }) },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to mark as read'),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => { toast.success('All notifications marked as read'); queryClient.invalidateQueries({ queryKey: ['notifications'] }); queryClient.invalidateQueries({ queryKey: ['unreadCount'] }) },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to mark all as read'),
  })

  const renderType = (n: Notification) => (
    <span className="flex items-center gap-2">
      {NOTIFICATION_TYPE_ICONS[n.type]}
      <span>{NOTIFICATION_TYPE_LABELS[n.type]}</span>
    </span>
  )

  const columns = [
    { key: 'type', header: 'Type', render: renderType },
    { key: 'title', header: 'Title', render: (n: Notification) => <span className="font-medium">{n.title}</span> },
    { key: 'message', header: 'Message', render: (n: Notification) => <span className="text-gray-600 max-w-xs truncate block">{n.message}</span> },
    { key: 'is_read', header: 'Status', render: (n: Notification) => <Badge variant={n.is_read ? 'reviewed' : 'new'}>{n.is_read ? 'Read' : 'Unread'}</Badge> },
    { key: 'created_at', header: 'Created', render: (n: Notification) => new Date(n.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
  ]

  const handleRowClick = (notification: Notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id)
    }
    setShowDetail(notification)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">Stay updated with platform activities</p>
        </div>
        <div className="flex items-center gap-4">
          {unreadCount && unreadCount.count > 0 && (
            <Badge variant="new" className="text-lg px-3 py-1">
              {unreadCount.count} unread
            </Badge>
          )}
          {unreadCount && unreadCount.count > 0 && (
            <Button variant="secondary" onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <Label htmlFor="read_filter" className="mb-0">Filter:</Label>
            <Select
              id="read_filter"
              value={isReadFilter === true ? 'true' : isReadFilter === false ? 'false' : ''}
              onChange={(e) => { setIsReadFilter(e.target.value === '' ? undefined : e.target.value === 'true'); setPage(1) }}
              className="w-auto"
            >
              <option value="">All</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {isLoading && !data ? (
            <div className="p-12 text-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto" /><p className="mt-4 text-gray-600">Loading...</p></div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No notifications</h3>
            </div>
          ) : (
            <>
              <Table
                data={data!.items}
                columns={columns}
                keyExtractor={(n) => n.id}
                onRowClick={handleRowClick}
                hoverable
              />
              {data && data.pages > 1 && (
                <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Detail Modal */}
      {showDetail && (
        <Modal isOpen={true} onClose={() => setShowDetail(null)} title="Notification Details" size="md">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {NOTIFICATION_TYPE_ICONS[showDetail.type]}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{NOTIFICATION_TYPE_LABELS[showDetail.type]}</h3>
                <span className="text-sm text-gray-600">{new Date(showDetail.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-2">{showDetail.title}</h4>
              <p className="text-gray-600 whitespace-pre-wrap">{showDetail.message}</p>
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowDetail(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}