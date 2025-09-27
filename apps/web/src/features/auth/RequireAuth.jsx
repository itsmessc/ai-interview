import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'

function RequireAuth({ children }) {
    const token = useSelector((state) => state.auth.token)
    const location = useLocation()

    if (!token) {
        return <Navigate to="/interviewer/login" state={{ from: location.pathname }} replace />
    }

    return children
}

RequireAuth.propTypes = {
    children: PropTypes.node.isRequired,
}

export default RequireAuth
