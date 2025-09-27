import { DownloadOutlined, LogoutOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
    Alert,
    Badge,
    Button,
    Card,
    Descriptions,
    Drawer,
    Flex,
    Form,
    Input,
    Modal,
    Space,
    Table,
    Tag,
    Typography,
    message,
    Select,
    Empty,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import { apiClient } from '../../lib/apiClient.js'
import { API_BASE_URL, SOCKET_URL } from '../../lib/config.js'
import { clearCredentials } from '../auth/authSlice.js'

const { Title, Paragraph, Text } = Typography

const STATUS_COLORS = {
    'waiting-profile': 'processing',
    ready: 'default',
    'in-progress': 'warning',
    completed: 'success',
    expired: 'error',
}

function useInterviewsList(filters) {
    return useQuery({
        queryKey: ['interviews', filters],
        queryFn: () => apiClient.get('/interviews', { params: filters }).then((res) => res.data),
        keepPreviousData: true,
    })
}

function useInterviewDetail(sessionId) {
    return useQuery({
        queryKey: ['interview', sessionId],
        queryFn: () => apiClient.get(`/interviews/${sessionId}`).then((res) => res.data),
        enabled: Boolean(sessionId),
    })
}

function InterviewerDashboardPage() {
    const interviewer = useSelector((state) => state.auth.interviewer)
    const dispatch = useDispatch()
    const queryClient = useQueryClient()

    const [filters, setFilters] = useState({ search: '', sort: 'score', order: 'desc' })
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedSessionId, setSelectedSessionId] = useState(null)
    const [inviteModal, setInviteModal] = useState(null)

    const { data, isLoading, refetch } = useInterviewsList(filters)
    const sessions = data?.sessions || []

    const { data: detailData, isLoading: detailLoading } = useInterviewDetail(selectedSessionId)
    const sessionDetail = detailData?.session
    const uploadsBaseUrl = API_BASE_URL.replace(/\/api$/, '')
    const resumeDetails = sessionDetail?.candidate?.resume
    const resumeUrl = resumeDetails?.storedName ? `${uploadsBaseUrl}/uploads/${resumeDetails.storedName}` : null

    useEffect(() => {
        if (!selectedSessionId) return undefined

        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            withCredentials: true,
        })

        socket.emit('join-session', { sessionId: selectedSessionId })

        socket.on('session:update', (payload) => {
            queryClient.setQueriesData({ queryKey: ['interviews'] }, (oldData) => {
                if (!oldData?.sessions) return oldData
                return {
                    ...oldData,
                    sessions: oldData.sessions.map((item) =>
                        item.id === payload.id
                            ? {
                                ...item,
                                candidate: payload.candidate,
                                finalScore: payload.finalScore,
                                finalSummary: payload.finalSummary,
                                status: payload.status,
                                updatedAt: payload.updatedAt,
                            }
                            : item,
                    ),
                }
            })

            queryClient.setQueryData(['interview', selectedSessionId], (previous) =>
                previous ? { session: payload } : previous,
            )
        })

        return () => {
            socket.emit('leave-session', { sessionId: selectedSessionId })
            socket.disconnect()
        }
    }, [queryClient, selectedSessionId])

    const createInviteMutation = useMutation({
        mutationFn: (values) => apiClient.post('/interviews', values).then((res) => res.data),
        onSuccess: (response) => {
            setIsCreateModalOpen(false)
            const emailStatus = response.email

            if (emailStatus?.sent) {
                message.success('Invite created and email sent to the candidate')
            } else if (emailStatus?.skipped) {
                message.success('Invite created. Email not configured, copy the link below to share')
            } else if (emailStatus) {
                const reason = emailStatus.error ? ` (${emailStatus.error})` : ''
                message.warning(`Invite created, but sending the email failed${reason}. Copy the link below to share manually.`)
            } else {
                message.success('Invite created')
            }
            setInviteModal({
                inviteUrl: response.inviteUrl,
                session: response.session,
                emailStatus,
            })
            queryClient.invalidateQueries({ queryKey: ['interviews'] })
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Unable to create invite'
            message.error(msg)
        },
    })

    const inviteModalAlert = useMemo(() => {
        if (!inviteModal) return null

        const status = inviteModal.emailStatus

        if (!status) {
            return {
                type: 'info',
                title: 'Invite created',
                description: 'Share the secure link below with your candidate.',
            }
        }

        if (status.sent) {
            return {
                type: 'success',
                title: 'Email sent to the candidate',
                description: 'We also generated the invitation link in case you want to share it directly.',
            }
        }

        if (status.skipped) {
            return {
                type: 'warning',
                title: 'Email skipped (SMTP isn\'t configured)',
                description: 'Copy the link below and send it to the candidate manually.',
            }
        }

        const baseDescription = 'Share the link manually while we investigate the issue.'
        const errorSuffix = status.error ? ` Reason: ${status.error}${status.code ? ` (code: ${status.code})` : ''}.` : ''

        return {
            type: 'error',
            title: 'Email failed to send',
            description: `${baseDescription}${errorSuffix}`,
        }
    }, [inviteModal])

    const handleLogout = () => {
        dispatch(clearCredentials())
        message.info('Signed out')
    }

    const columns = useMemo(
        () => [
            {
                title: 'Candidate',
                dataIndex: ['candidate', 'name'],
                key: 'candidate',
                render: (_value, record) => (
                    <Space direction="vertical" size={0}>
                        <Text strong>{record.candidate?.name || 'Pending name'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.candidate?.email || 'Awaiting email'}
                        </Text>
                    </Space>
                ),
            },
            {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status) => <Badge status={STATUS_COLORS[status] || 'default'} text={status.replace('-', ' ')} />,
            },
            {
                title: 'Score',
                dataIndex: 'finalScore',
                key: 'finalScore',
                render: (score) => (score ? <Tag color="blue">{score}/10</Tag> : <Tag color="default">Pending</Tag>),
            },
            {
                title: 'Last updated',
                dataIndex: 'updatedAt',
                key: 'updatedAt',
                render: (value) => dayjs(value).format('MMM D, HH:mm'),
            },
            {
                key: 'actions',
                render: (_, record) => (
                    <Button type="link" onClick={() => setSelectedSessionId(record.id)}>
                        View details
                    </Button>
                ),
            },
        ],
        [],
    )

    const handleFilterChange = (changed) => {
        setFilters((prev) => ({ ...prev, ...changed }))
    }

    return (
        <div className="dashboard-container">
            <div className="interviewer-header">
                <div>
                    <Title level={3} style={{ marginBottom: 0 }}>
                        Interviewer Dashboard
                    </Title>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        Monitor live interviews, review transcripts, and invite candidates.
                    </Paragraph>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
                        Refresh
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
                        New invite
                    </Button>
                    <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                        Logout
                    </Button>
                </Space>
            </div>

            <Card className="dashboard-card" title={`Welcome, ${interviewer?.name || 'Interviewer'}`}>
                <Paragraph style={{ marginBottom: 0 }}>
                    {sessions.length} candidate{sessions.length === 1 ? '' : 's'} in your pipeline.
                </Paragraph>
            </Card>

            <Card className="dashboard-table-wrapper" bodyStyle={{ padding: 0 }}>
                <Flex justify="space-between" align="flex-end" style={{ padding: '16px 16px 0' }} wrap>
                    <Form layout="inline" style={{ marginBottom: 16 }}>
                        <Form.Item label="Search">
                            <Input
                                placeholder="Search name or email"
                                allowClear
                                value={filters.search}
                                onChange={(event) => handleFilterChange({ search: event.target.value })}
                            />
                        </Form.Item>
                        <Form.Item label="Sort by">
                            <Select
                                value={filters.sort}
                                style={{ width: 160 }}
                                onChange={(value) => handleFilterChange({ sort: value })}
                                options={[
                                    { label: 'Score', value: 'score' },
                                    { label: 'Recent', value: 'recent' },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item label="Order">
                            <Select
                                value={filters.order}
                                style={{ width: 140 }}
                                onChange={(value) => handleFilterChange({ order: value })}
                                options={[
                                    { label: 'Descending', value: 'desc' },
                                    { label: 'Ascending', value: 'asc' },
                                ]}
                            />
                        </Form.Item>
                    </Form>
                </Flex>
                <Table
                    rowKey="id"
                    dataSource={sessions}
                    columns={columns}
                    loading={isLoading}
                    locale={{ emptyText: <Empty description="No candidates yet" /> }}
                    pagination={{ pageSize: 8 }}
                />
            </Card>

            <Modal
                title="Create an interview invite"
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                <Form layout="vertical" onFinish={createInviteMutation.mutate} autoComplete="off">
                    <Form.Item
                        label="Candidate email"
                        name="candidateEmail"
                        rules={[{ required: true, message: 'Candidate email is required' }]}
                    >
                        <Input placeholder="candidate@email.com" type="email" />
                    </Form.Item>
                    <Form.Item label="Candidate name" name="candidateName">
                        <Input placeholder="Optional" />
                    </Form.Item>
                    <Form.Item label="Candidate phone" name="candidatePhone">
                        <Input placeholder="Optional" />
                    </Form.Item>
                    <Form.Item label="Notes" name="notes">
                        <Input.TextArea rows={3} placeholder="Optional notes visible only to you" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={createInviteMutation.isPending}>
                        Create invite
                    </Button>
                </Form>
            </Modal>

            <Modal
                title="Invite ready"
                open={Boolean(inviteModal)}
                onCancel={() => setInviteModal(null)}
                onOk={() => setInviteModal(null)}
                centered
            >
                {inviteModalAlert && (
                    <Alert
                        type={inviteModalAlert.type}
                        showIcon
                        message={inviteModalAlert.title}
                        description={inviteModalAlert.description}
                        style={{ marginBottom: 16 }}
                    />
                )}
                <Card size="small" style={{ background: '#f8fafc' }}>
                    <Text copyable>{inviteModal?.inviteUrl}</Text>
                </Card>
            </Modal>

            <Drawer
                width={560}
                title={sessionDetail ? sessionDetail.candidate?.name || 'Candidate details' : 'Session details'}
                open={Boolean(selectedSessionId)}
                onClose={() => setSelectedSessionId(null)}
                destroyOnClose
            >
                {detailLoading && <Paragraph>Loading session...</Paragraph>}
                {!detailLoading && sessionDetail && (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Email">{sessionDetail.candidate?.email || '—'}</Descriptions.Item>
                            <Descriptions.Item label="Phone">{sessionDetail.candidate?.phone || '—'}</Descriptions.Item>
                            <Descriptions.Item label="Resume">
                                {resumeUrl ? (
                                    <Button
                                        type="link"
                                        icon={<DownloadOutlined />}
                                        href={resumeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ padding: 0 }}
                                    >
                                        {resumeDetails?.originalName || 'Download resume'}
                                    </Button>
                                ) : (
                                    'Not uploaded yet'
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">{sessionDetail.status}</Descriptions.Item>
                            <Descriptions.Item label="Final score">
                                {sessionDetail.finalScore ? `${sessionDetail.finalScore}/10` : 'Pending'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Summary">
                                {sessionDetail.finalSummary || 'Summary will appear after completion.'}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card title="Transcript" size="small" bodyStyle={{ maxHeight: 260, overflowY: 'auto' }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                {sessionDetail.chatTranscript?.length ? (
                                    sessionDetail.chatTranscript.map((messageItem, index) => (
                                        <Card
                                            key={index}
                                            size="small"
                                            style={{
                                                background: messageItem.role === 'candidate' ? '#e0f2fe' : '#f8fafc',
                                            }}
                                            title={`${messageItem.role.toUpperCase()} • ${dayjs(messageItem.createdAt).format(
                                                'MMM D, HH:mm',
                                            )}`}
                                        >
                                            <Paragraph style={{ marginBottom: 0 }}>{messageItem.content}</Paragraph>
                                            {messageItem.metadata?.score !== undefined && (
                                                <Tag color="blue" style={{ marginTop: 8 }}>
                                                    Score: {messageItem.metadata.score}/10
                                                </Tag>
                                            )}
                                        </Card>
                                    ))
                                ) : (
                                    <Paragraph type="secondary">Transcript will appear once the interview starts.</Paragraph>
                                )}
                            </Space>
                        </Card>
                    </Space>
                )}
            </Drawer>
        </div>
    )
}

export default InterviewerDashboardPage
