import { InboxOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Space, Typography, Upload, message } from 'antd'
import PropTypes from 'prop-types'
import { useMutation } from '@tanstack/react-query'
import { useDispatch, useSelector } from 'react-redux'
import { apiClient } from '../../../lib/apiClient.js'
import { upsertSessionState } from '../interviewSlice.js'
import { selectInterviewStateByToken } from '../selectors.js'

const { Dragger } = Upload
const { Title, Paragraph, Text } = Typography

function ResumeUploader({ token, session }) {
    const dispatch = useDispatch()
    const storedState = useSelector((state) => selectInterviewStateByToken(state, token))
    const extractedFields = storedState?.extractedFields

    const uploadMutation = useMutation({
        mutationFn: (file) => {
            const formData = new FormData()
            formData.append('resume', file)
            return apiClient
                .post(`/invite/${token}/resume`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
                .then((res) => res.data)
        },
        onSuccess: (data) => {
            dispatch(
                upsertSessionState({
                    token,
                    session: data.session,
                    extractedFields: data.extracted,
                    deadline: data.session.currentQuestionDeadline,
                }),
            )
            message.success('Resume uploaded successfully')
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Resume upload failed'
            message.error(msg)
        },
    })

    const handleBeforeUpload = (file) => {
        const isSupported =
            file.type === 'application/pdf' ||
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.type === 'application/msword'

        if (!isSupported) {
            message.error('Only PDF or DOCX files are supported')
            return Upload.LIST_IGNORE
        }

        uploadMutation.mutate(file)
        return false
    }

    return (
        <div className="chat-container">
            <Card className="chat-panel">
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                        <Title level={3}>Upload your resume</Title>
                        <Paragraph type="secondary">
                            We support PDF (preferred) and DOCX. Your resume stays local to this interview and is never shared externally.
                        </Paragraph>
                    </div>

                    <Dragger
                        multiple={false}
                        accept=".pdf,.doc,.docx"
                        maxCount={1}
                        showUploadList={false}
                        beforeUpload={handleBeforeUpload}
                        disabled={uploadMutation.isPending}
                        style={{ padding: '32px 16px' }}
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">Click or drag resume file to this area</p>
                        <p className="ant-upload-hint">File size limit: 8MB</p>
                    </Dragger>

                    <Alert
                        type="info"
                        showIcon
                        message="Why we need your resume"
                        description={
                            <Paragraph style={{ marginBottom: 0 }}>
                                The assistant uses your resume to personalize questions and pre-fill your contact details. If anything is missing we’ll ask before the interview starts.
                            </Paragraph>
                        }
                    />

                    {session.missingFields?.length && (
                        <Alert
                            type="warning"
                            showIcon
                            message="Information still required"
                            description={
                                <Paragraph style={{ marginBottom: 0 }}>
                                    Missing: {session.missingFields.join(', ')}
                                </Paragraph>
                            }
                        />
                    )}

                    {extractedFields && (
                        <Card size="small" style={{ background: '#f8fafc' }}>
                            <Title level={5}>We found:</Title>
                            <Paragraph style={{ marginBottom: 0 }}>
                                <Text strong>Name:</Text> {extractedFields.name || '—'}
                            </Paragraph>
                            <Paragraph style={{ marginBottom: 0 }}>
                                <Text strong>Email:</Text> {extractedFields.email || '—'}
                            </Paragraph>
                            <Paragraph style={{ marginBottom: 0 }}>
                                <Text strong>Phone:</Text> {extractedFields.phone || '—'}
                            </Paragraph>
                        </Card>
                    )}

                    <Button type="link" size="large" href="/">
                        Need to reschedule? Return to home
                    </Button>
                </Space>
            </Card>
        </div>
    )
}

ResumeUploader.propTypes = {
    token: PropTypes.string.isRequired,
    session: PropTypes.object,
}

export default ResumeUploader
