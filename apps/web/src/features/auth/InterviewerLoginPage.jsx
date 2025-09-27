import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, Typography, message } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiClient } from '../../lib/apiClient.js'
import { setCredentials } from './authSlice.js'

const { Title, Paragraph } = Typography

function InterviewerLoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const token = useSelector((state) => state.auth.token)

    useEffect(() => {
        if (token) {
            navigate('/interviewer/dashboard', { replace: true })
        }
    }, [token, navigate])

    const loginMutation = useMutation({
        mutationFn: (values) => apiClient.post('/auth/login', values).then((res) => res.data),
        onSuccess: (data) => {
            dispatch(setCredentials(data))
            message.success(`Welcome back, ${data.interviewer.name.split(' ')[0]}`)
            const redirectTo = location.state?.from || '/interviewer/dashboard'
            navigate(redirectTo, { replace: true })
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Unable to login'
            message.error(msg)
        },
    })

    return (
        <div className="interviewee-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Card style={{ maxWidth: 420, width: '100%', borderRadius: 20, boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)' }}>
                <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
                    Interviewer Login
                </Title>
                <Paragraph style={{ textAlign: 'center', color: '#475569', marginBottom: 32 }}>
                    Sign in to create invites, monitor candidates, and review transcripts.
                </Paragraph>
                <Form layout="vertical" size="large" onFinish={loginMutation.mutate} autoComplete="on">
                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[{ required: true, message: 'Please enter your email' }]}
                    >
                        <Input prefix={<MailOutlined />} placeholder="you@example.com" type="email" autoComplete="email" />
                    </Form.Item>
                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[{ required: true, message: 'Please enter your password' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="••••••••" autoComplete="current-password" />
                    </Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        block
                        loading={loginMutation.isPending}
                    >
                        Sign In
                    </Button>
                </Form>
                <Paragraph style={{ marginTop: 24, color: '#64748b', fontSize: 12 }}>
                    Tip: run the API seed command to create the example interviewer <strong>alice@example.com</strong> with password <strong>Password123!</strong>
                </Paragraph>
            </Card>
        </div>
    )
}

export default InterviewerLoginPage
