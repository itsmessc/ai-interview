import { CheckCircleTwoTone, FileTextOutlined, HomeOutlined } from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Result, Row, Space, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import { useMemo } from 'react'

const { Title, Paragraph, Text } = Typography

function InterviewSummary({ session, plan }) {
    const qaPairs = useMemo(() => {
        if (!session?.questions?.length) return []
        return session.questions.map((question, index) => {
            const answer = session.answers?.find((item) => item.questionId === question.id)
            return {
                question,
                answer,
                index,
            }
        })
    }, [session])

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Result
                status="success"
                title="Interview complete"
                subTitle="Great work! Review your AI-generated feedback below."
                icon={<CheckCircleTwoTone twoToneColor="#3b82f6" />}
            />

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <Card title="Overview" className="chat-panel">
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Candidate">{session.candidate?.name}</Descriptions.Item>
                            <Descriptions.Item label="Email">{session.candidate?.email}</Descriptions.Item>
                            <Descriptions.Item label="Completed">
                                {dayjs(session.completedAt || session.updatedAt).format('MMM D, HH:mm')}
                            </Descriptions.Item>
                            <Descriptions.Item label="Final score">
                                <Tag color="blue" style={{ fontSize: 16, padding: '4px 12px' }}>
                                    {session.finalScore ? `${session.finalScore}/10` : 'Pending'}
                                </Tag>
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card title="AI summary" className="chat-panel">
                        <Paragraph>{session.finalSummary || 'Summary pending from AI.'}</Paragraph>
                        {plan && (
                            <Paragraph type="secondary">Interview blueprint: {plan.map((item) => item.difficulty).join(' → ')}</Paragraph>
                        )}
                        <Button type="primary" icon={<HomeOutlined />} href="/">
                            Return home
                        </Button>
                    </Card>
                </Col>
            </Row>

            <Card title="Question breakdown" className="chat-panel">
                <Space direction="vertical" style={{ width: '100%' }}>
                    {qaPairs.map(({ question, answer, index }) => (
                        <Card
                            key={question.id}
                            type="inner"
                            title={`Q${index + 1}: ${question.prompt}`}
                            extra={<Tag>{question.difficulty}</Tag>}
                        >
                            <Paragraph>
                                <Text strong>Your answer:</Text> {answer?.candidateAnswer || 'No answer recorded.'}
                            </Paragraph>
                            <Paragraph>
                                <Text strong>AI feedback:</Text> {answer?.aiFeedback || 'Feedback not available.'}
                            </Paragraph>
                            <Paragraph>
                                <Text strong>Score:</Text> {answer?.aiScore != null ? `${answer.aiScore}/10` : 'Pending'}
                            </Paragraph>
                        </Card>
                    ))}
                </Space>
            </Card>

            <Card className="chat-panel" title="Need a copy?">
                <Paragraph>
                    <FileTextOutlined style={{ marginRight: 8 }} /> Save this page or take a screenshot to preserve your results. You can safely close the tab.
                </Paragraph>
                <Paragraph type="secondary">
                    If you have questions about the next steps, reach out to your recruiter for guidance.
                </Paragraph>
            </Card>
        </Space>
    )
}

InterviewSummary.propTypes = {
    session: PropTypes.object.isRequired,
    plan: PropTypes.array,
}

export default InterviewSummary
