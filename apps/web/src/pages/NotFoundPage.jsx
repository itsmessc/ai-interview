import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'

function NotFoundPage() {
    return (
        <div className="interviewee-layout">
            <Result
                status="404"
                title="Page Not Found"
                subTitle="The page you are looking for might have been moved or removed."
                extra={
                    <Button type="primary">
                        <Link to="/">Go Home</Link>
                    </Button>
                }
            />
        </div>
    )
}

export default NotFoundPage
