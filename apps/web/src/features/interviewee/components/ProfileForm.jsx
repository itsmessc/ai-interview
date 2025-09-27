import { CheckCircleOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Form, Input, Row, Space, Typography, message } from 'antd'
import PropTypes from 'prop-types'
import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useDispatch } from 'react-redux'
import { apiClient } from '../../../lib/apiClient.js'
import { upsertSessionState } from '../interviewSlice.js'

const { Title, Paragraph } = Typography

function ProfileForm({ token, session }) {
    const dispatch = useDispatch()
    const [form] = Form.useForm()

    useEffect(() => {
        if (!session) return
        form.setFieldsValue({
            name: session.candidate?.name,
            email: session.candidate?.email,
            phone: session.candidate?.phone,
        })
    }, [session, form])

    const mutation = useMutation({
        mutationFn: (values) => apiClient.post(`/invite/${token}/profile`, values).then((res) => res.data),
        onSuccess: (data) => {
            dispatch(
                upsertSessionState({
                    token,
                    session: data.session,
                    deadline: data.session.currentQuestionDeadline,
                }),
            )
            message.success('Profile updated')
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Unable to update profile'
            message.error(msg)
        },
    })

    const missing = session.missingFields?.filter((field) => field !== 'resume') || []

    return (
        <div className="chat-container">
            <Card className="chat-panel">
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                        <Title level={3}>Confirm your contact details</Title>
                        <Paragraph type="secondary">
                            We found some gaps in your profile. Please complete the fields below before starting the interview.
                        </Paragraph>
                    </div>

                    <Alert
                        type="info"
                        showIcon
                        message="Missing fields"
                        description={`We need: ${missing.join(', ')}`}
                    />

                    <Form layout="vertical" form={form} onFinish={mutation.mutate} style={{ marginTop: 12 }}>
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item label="Full name" name="name" rules={[{ required: true, message: 'Full name is required' }]}>
                                    <Input placeholder="Jane Doe" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label="Email"
                                    name="email"
                                    rules={[{ required: true, message: 'Email is required' }]}
                                >
                                    <Input type="email" placeholder="jane@example.com" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item label="Phone" name="phone" rules={[{ required: true, message: 'Phone is required' }]}>
                                    <Input placeholder="+1 555 123 4567" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Space>
                            <Button htmlType="submit" type="primary" size="large" loading={mutation.isPending} icon={<CheckCircleOutlined />}>
                                Save and continue
                            </Button>
                        </Space>
                    </Form>
                </Space>
            </Card>
        </div>
    )
}

ProfileForm.propTypes = {
    token: PropTypes.string.isRequired,
    session: PropTypes.object,
}

export default ProfileForm
