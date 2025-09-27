import { Button, Card, Col, Form, Input, Row, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'

const { Title, Paragraph, Text } = Typography

function LandingPage() {
    const navigate = useNavigate()
    const [form] = Form.useForm()

    const handleSubmit = ({ token }) => {
        const trimmed = token?.trim()
        if (trimmed) {
            navigate(`/invite/${trimmed}`)
        }
    }

    return (
        <div className="landing-wrapper">
            <header className="landing-hero">
                <Title>AI Interview Assistant</Title>
                <Paragraph type="secondary">
                    Run collaborative, AI-enhanced mock interviews with synced candidate and interviewer views.
                </Paragraph>
                <div className="landing-actions">
                    <Button type="primary" size="large">
                        <Link to="/interviewer/login">Interviewer Login</Link>
                    </Button>
                    <Button size="large" onClick={() => navigate('#invite-token')}>
                        Have an invite token?
                    </Button>
                </div>
            </header>

            <Row gutter={[24, 24]} className="landing-grid">
                <Col xs={24} md={12}>
                    <Card title="For Candidates" bordered={false}>
                        <Paragraph>
                            Upload your resume, confirm your details, and complete a timed six-question interview tailored to full-stack roles.
                        </Paragraph>
                        <Paragraph>
                            Your progress is saved locally, so you can pause and resume whenever you need.
                        </Paragraph>
                        <div id="invite-token" className="landing-form">
                            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                                <Form.Item
                                    name="token"
                                    label="Enter your invite token"
                                    rules={[{ required: true, message: 'Invite token is required' }]}
                                >
                                    <Input placeholder="e.g. 8d3f7b90-..." allowClear />
                                </Form.Item>
                                <Button type="primary" htmlType="submit" block>
                                    Start Interview
                                </Button>
                            </Form>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card title="For Interviewers" bordered={false}>
                        <Paragraph>
                            Track candidates in real time, view transcripts, scores, and AI summaries, and manage invites from a streamlined dashboard.
                        </Paragraph>
                        <Paragraph>
                            <Text strong>New to the platform?</Text> Use the seeded credentials <code>alice@example.com</code> / <code>Password123!</code> after running the API seed command.
                        </Paragraph>
                        <Button type="default" size="large">
                            <Link to="/interviewer/login">Go to Interviewer Portal</Link>
                        </Button>
                    </Card>
                </Col>
            </Row>
        </div>
    )
}

export default LandingPage
