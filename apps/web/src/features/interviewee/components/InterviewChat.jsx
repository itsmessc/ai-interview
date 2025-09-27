import { ClockCircleOutlined, SendOutlined } from '@ant-design/icons'
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Progress,
    Result,
    Row,
    Space,
    Statistic,
    Tag,
    Typography,
    message,
} from 'antd'
import TextArea from 'antd/es/input/TextArea'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../../../lib/apiClient.js'
import { upsertSessionState } from '../interviewSlice.js'

const { Title, Paragraph, Text } = Typography

function formatTimeLeft(ms) {
    if (ms == null) return '--:--'
    const seconds = Math.max(0, Math.floor(ms / 1000))
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
    const secs = String(seconds % 60).padStart(2, '0')
    return `${mins}:${secs}`
}

function InterviewChat({ token, session, plan, startInterview, countdownDeadline }) {
    const dispatch = useDispatch()
    const [answer, setAnswer] = useState('')
    const [autoSubmitted, setAutoSubmitted] = useState(false)
    const [timeLeft, setTimeLeft] = useState(null)
    const questionStartRef = useRef(Date.now())
    const timelineRef = useRef(null)

    const currentQuestion = session.questions?.[session.currentQuestionIndex] || null
    const answeredCount = session.currentQuestionIndex
    const totalQuestions = plan?.length || session.questions?.length || 6

    useEffect(() => {
        if (!countdownDeadline) {
            setTimeLeft(null)
            return undefined
        }
        const compute = () => {
            const diff = dayjs(countdownDeadline).diff(dayjs(), 'millisecond')
            setTimeLeft(diff > 0 ? diff : 0)
        }
        compute()
        const interval = setInterval(compute, 250)
        return () => clearInterval(interval)
    }, [countdownDeadline])

    useEffect(() => {
        setAnswer('')
        setAutoSubmitted(false)
        questionStartRef.current = Date.now()
        if (timelineRef.current) {
            timelineRef.current.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' })
        }
    }, [currentQuestion?.id])

    const submitAnswerMutation = useMutation({
        mutationFn: (payload) => apiClient.post(`/invite/${token}/answers`, payload).then((res) => res.data),
        onSuccess: (data) => {
            dispatch(
                upsertSessionState({
                    token,
                    session: data.session,
                    deadline: data.deadline,
                }),
            )
            if (!data.isComplete && data.nextQuestion) {
                setAnswer('')
                setAutoSubmitted(false)
            }
            if (data.isComplete) {
                message.success('Interview complete! Generating summary...')
            } else {
                message.success('Answer submitted')
            }
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Unable to submit answer'
            message.error(msg)
            setAutoSubmitted(false)
        },
    })

    const handleSubmit = useCallback(
        (submittedAnswer, auto = false) => {
            if (!currentQuestion) return
            if (submitAnswerMutation.isPending) return

            const totalMs = currentQuestion.timeLimitSeconds * 1000
            const elapsed = countdownDeadline
                ? Math.min(totalMs, totalMs - Math.max(0, timeLeft ?? 0))
                : Date.now() - questionStartRef.current

            submitAnswerMutation.mutate({
                answer: submittedAnswer,
                durationMs: Math.max(0, elapsed),
            })
            if (auto) {
                setAutoSubmitted(true)
            }
        },
        [currentQuestion, countdownDeadline, timeLeft, submitAnswerMutation],
    )

    useEffect(() => {
        if (!currentQuestion) return
        if (session.status !== 'in-progress') return
        if (autoSubmitted) return
        if (timeLeft === 0) {
            handleSubmit('', true)
        }
    }, [timeLeft, session.status, currentQuestion, autoSubmitted, handleSubmit])

    const chatEntries = useMemo(() => session.chatTranscript || [], [session.chatTranscript])

    if (session.status === 'ready' && !session.questions.length) {
        return (
            <div className="chat-container">
                <Card className="chat-panel">
                    <Space direction="vertical" size="large">
                        <Title level={3}>Ready to begin?</Title>
                        <Paragraph type="secondary">
                            You will receive 6 questions: 2 easy, 2 medium, 2 hard. Each question is timed. When the clock reaches zero your answer will be auto-submitted.
                        </Paragraph>
                        <Button
                            type="primary"
                            size="large"
                            onClick={() => startInterview.mutate()}
                            loading={startInterview.isPending}
                        >
                            Start interview
                        </Button>
                    </Space>
                </Card>
            </div>
        )
    }

    if (!currentQuestion && session.status === 'in-progress') {
        return (
            <Result status="info" title="Processing your results..." subTitle="Please wait while we finalise your feedback." />
        )
    }

    return (
        <div className="chat-container">
            <Row gutter={[24, 24]}>
                <Col xs={24} md={14}>
                    <Card className="chat-panel">
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Title level={4} style={{ marginBottom: 4 }}>
                                        Question {answeredCount + 1} of {totalQuestions}
                                    </Title>
                                    <Text type="secondary">Difficulty: {currentQuestion?.difficulty}</Text>
                                </div>
                                <StatBlock
                                    label="Time left"
                                    value={formatTimeLeft(timeLeft)}
                                    status={timeLeft === 0 ? 'danger' : 'processing'}
                                />
                            </div>

                            <Paragraph style={{ fontSize: 16 }}>{currentQuestion?.prompt}</Paragraph>

                            <TextArea
                                autoSize={{ minRows: 6, maxRows: 10 }}
                                value={answer}
                                onChange={(event) => setAnswer(event.target.value)}
                                placeholder="Type your response here"
                                disabled={submitAnswerMutation.isPending || timeLeft === 0}
                            />

                            <Space>
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    size="large"
                                    onClick={() => handleSubmit(answer)}
                                    loading={submitAnswerMutation.isPending}
                                    disabled={!answer?.trim()}
                                >
                                    Submit answer
                                </Button>
                                <Button
                                    danger
                                    onClick={() => handleSubmit('')}
                                    disabled={submitAnswerMutation.isPending}
                                >
                                    Skip question
                                </Button>
                            </Space>
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} md={10}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Card className="chat-panel" title="Progress">
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Progress
                                    percent={Math.round((answeredCount / totalQuestions) * 100)}
                                    status={session.status === 'in-progress' ? 'active' : 'normal'}
                                />
                                <Alert
                                    type="info"
                                    showIcon
                                    icon={<ClockCircleOutlined />}
                                    message={`Current timer: ${currentQuestion?.timeLimitSeconds}s`}
                                    description="Focus on structured, concise responses. The AI will score each answer immediately."
                                />
                            </Space>
                        </Card>

                        <Card className="chat-panel" title="Interview timeline">
                            <div className="chat-timeline" ref={timelineRef}>
                                {chatEntries.length ? (
                                    chatEntries.map((entry, index) => (
                                        <div key={index} className={`timeline-entry ${entry.role}`}>
                                            <Tag color={entry.role === 'candidate' ? 'blue' : entry.role === 'assistant' ? 'green' : 'default'}>
                                                {entry.role.toUpperCase()}
                                            </Tag>
                                            <Paragraph style={{ marginBottom: 0 }}>{entry.content}</Paragraph>
                                            {entry.metadata?.score !== undefined && (
                                                <Tag color="geekblue">Score: {entry.metadata.score}/10</Tag>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <Paragraph type="secondary">Your conversation will appear here.</Paragraph>
                                )}
                            </div>
                        </Card>
                    </Space>
                </Col>
            </Row>
        </div>
    )
}

function StatBlock({ label, value, status }) {
    return (
        <Statistic
            title={label}
            value={value}
            prefix={<Badge status={status} />}
            valueStyle={{ fontSize: 24 }}
        />
    )
}

StatBlock.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    status: PropTypes.string,
}

InterviewChat.propTypes = {
    token: PropTypes.string.isRequired,
    session: PropTypes.object.isRequired,
    plan: PropTypes.array,
    startInterview: PropTypes.object.isRequired,
    countdownDeadline: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
}

export default InterviewChat
