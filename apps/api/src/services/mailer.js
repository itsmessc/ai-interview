import nodemailer from 'nodemailer'

const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    MAIL_FROM,
    NODE_ENV,
} = process.env

const isConfigured = Boolean(SMTP_HOST && MAIL_FROM)

let transporterPromise

async function getTransporter() {
    if (!isConfigured) return null
    if (!transporterPromise) {
        const transportConfig = {
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 587,
            secure: Number(SMTP_PORT) === 465,
            auth:
                SMTP_USER && SMTP_PASSWORD
                    ? {
                        user: SMTP_USER,
                        pass: SMTP_PASSWORD,
                    }
                    : undefined,
        }

        const transporter = nodemailer.createTransport(transportConfig)
        transporterPromise = transporter
            .verify()
            .then(() => transporter)
            .catch((error) => {
                console.error('Failed to initialise SMTP transporter', error)
                transporterPromise = null
                throw error
            })
    }

    return transporterPromise
}

export async function sendInviteEmail({
    to,
    candidateName,
    interviewerName,
    inviteUrl,
}) {
    if (!isConfigured) {
        if (NODE_ENV !== 'test') {
            console.warn('SMTP not configured. Skipping invite email sending.')
        }
        return { sent: false, skipped: true }
    }

    const transporter = await getTransporter()
    if (!transporter) {
        return { sent: false }
    }

    const subject = 'Your AI interview invite is ready'
    const greeting = candidateName ? `Hi ${candidateName},` : 'Hi there,'

    const text = `${greeting}

${interviewerName || 'An interviewer'} has invited you to complete an AI-powered interview.

Use the secure link below to get started:
${inviteUrl}

If you weren’t expecting this email, feel free to ignore it.

Thanks,
AI Interview Assistant`

    const html = `
    <div style="font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; color: #0f172a;">
      <p>${greeting}</p>
      <p>${(interviewerName || 'An interviewer')} has invited you to complete an AI-powered interview.</p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px;">Open your interview</a>
      </p>
      <p>Or copy this link into your browser:</p>
      <p style="word-break: break-all;">${inviteUrl}</p>
      <p style="margin-top: 32px;">If you weren’t expecting this email, you can ignore it safely.</p>
      <p style="margin-top: 24px;">Thanks,<br />AI Interview Assistant</p>
    </div>
  `

    await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject,
        text,
        html,
    })

    return { sent: true }
}
