import { LoadingOutlined } from '@ant-design/icons'
import { Alert, Layout, Modal, Result, Spin, message } from 'antd'
import PropTypes from 'prop-types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import {
    markWelcomeBackSeen,
    setActiveToken,
    upsertSessionState,
} from './interviewSlice.js'
import { selectInterviewStateByToken } from './selectors.js'
import ResumeUploader from './components/ResumeUploader.jsx'
import ProfileForm from './components/ProfileForm.jsx'
import InterviewChat from './components/InterviewChat.jsx'
import InterviewSummary from './components/InterviewSummary.jsx'

const { Content, Header } = Layout

function InterviewLayout({ children }) {
    return (
        <Layout className="interviewee-layout">
            <Header
                style={{
                    background: 'transparent',
                    padding: '16px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <span style={{ fontWeight: 600, fontSize: 18 }}>AI Interview Assistant</span>
            </Header>
            <Content className="interview-layout-content">{children}</Content>
        </Layout>
    )
}

InterviewLayout.propTypes = {
    children: PropTypes.node,
}

function IntervieweeRouter() {
    const { token } = useParams()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [welcomeBackVisible, setWelcomeBackVisible] = useState(false)

    const storedState = useSelector((state) => selectInterviewStateByToken(state, token))
    const session = storedState?.session

    useEffect(() => {
        if (token) {
            dispatch(setActiveToken(token))
        }
    }, [token, dispatch])

    const inviteQuery = useQuery({
        queryKey: ['invite', token],
        enabled: Boolean(token),
        queryFn: () => apiClient.get(`/invite/${token}`).then((res) => res.data),
        refetchInterval: session?.status === 'in-progress' ? 15000 : false,
        onSuccess: (data) => {
            dispatch(
                upsertSessionState({
                    token,
                    session: data.session,
                    plan: data.plan,
                    deadline: data.session.currentQuestionDeadline,
                }),
            )
        },
        onError: (error) => {
            if (error.response?.status === 404) {
                navigate('/?expired=1', { replace: true })
            }
        },
    })

    const querySession = inviteQuery.data?.session || null
    const queryPlan = inviteQuery.data?.plan || null

    const resolvedSession = session || querySession
    const resolvedPlan = storedState?.plan || queryPlan
    const resolvedDeadline = storedState?.deadline || querySession?.currentQuestionDeadline || null

    useEffect(() => {
        if (!session) return
        if (session.status === 'in-progress' && !storedState?.welcomeBackSeen) {
            setWelcomeBackVisible(true)
        }
    }, [session, storedState])

    const startMutation = useMutation({
        mutationFn: () => apiClient.post(`/invite/${token}/start`).then((res) => res.data),
        onSuccess: (data) => {
            dispatch(
                upsertSessionState({
                    token,
                    session: data.session,
                    deadline: data.deadline,
                    plan: data.plan,
                }),
            )
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Unable to start interview yet'
            message.error(msg)
        },
    })

    const content = useMemo(() => {
        if (!resolvedSession) {
            if (inviteQuery.isLoading || inviteQuery.isFetching) {
                return (
                    <InterviewLayout>
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
                    </InterviewLayout>
                )
            }

            if (inviteQuery.isError) {
                return (
                    <InterviewLayout>
                        <Result
                            status="error"
                            title="Unable to load interview"
                            subTitle={inviteQuery.error?.response?.data?.message || 'Try refreshing the page.'}
                        />
                    </InterviewLayout>
                )
            }

            if (inviteQuery.isSuccess) {
                return (
                    <InterviewLayout>
                        <Result
                            status="info"
                            title="Preparing your interview..."
                            subTitle="Hang tight—this can take a couple of seconds on the first load."
                        />
                    </InterviewLayout>
                )
            }

            return (
                <InterviewLayout>
                    <Result status="info" title="Loading interview details" />
                </InterviewLayout>
            )
        }

        if (resolvedSession.status === 'expired') {
            return (
                <InterviewLayout>
                    <Result status="warning" title="This interview link has expired." />
                </InterviewLayout>
            )
        }

        if (resolvedSession.status === 'completed') {
            return (
                <InterviewLayout>
                    <InterviewSummary token={token} session={resolvedSession} plan={resolvedPlan} />
                </InterviewLayout>
            )
        }

        const missing = resolvedSession.missingFields || []

        if (missing.includes('resume')) {
            return (
                <InterviewLayout>
                    <ResumeUploader token={token} session={resolvedSession} />
                </InterviewLayout>
            )
        }

        if (missing.some((field) => field !== 'resume')) {
            return (
                <InterviewLayout>
                    <ProfileForm token={token} session={resolvedSession} />
                </InterviewLayout>
            )
        }

        return (
            <InterviewLayout>
                <InterviewChat
                    token={token}
                    session={resolvedSession}
                    plan={resolvedPlan}
                    startInterview={startMutation}
                    countdownDeadline={resolvedDeadline || resolvedSession.currentQuestionDeadline}
                />
            </InterviewLayout>
        )
    }, [inviteQuery, resolvedSession, resolvedPlan, resolvedDeadline, token, startMutation])

    return (
        <>
            {content}
            <Modal
                open={welcomeBackVisible}
                onCancel={() => {
                    setWelcomeBackVisible(false)
                    dispatch(markWelcomeBackSeen(token))
                }}
                onOk={() => {
                    setWelcomeBackVisible(false)
                    dispatch(markWelcomeBackSeen(token))
                }}
                title="Welcome back!"
            >
                <div className="welcome-modal-content">
                    <Alert
                        type="info"
                        message="Your timers and progress were restored automatically."
                        description="When you're ready, continue with the next question."
                        showIcon
                    />
                </div>
            </Modal>
        </>
    )
}

export default IntervieweeRouter
