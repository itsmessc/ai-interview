import { ConfigProvider, theme } from 'antd'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import IntervieweeRouter from './features/interviewee/IntervieweeRouter.jsx'
import InterviewerLoginPage from './features/auth/InterviewerLoginPage.jsx'
import InterviewerDashboardPage from './features/interviewer/InterviewerDashboardPage.jsx'
import RequireAuth from './features/auth/RequireAuth.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import './App.css'

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/invite/:token/*" element={<IntervieweeRouter />} />
          <Route path="/interviewer/login" element={<InterviewerLoginPage />} />
          <Route
            path="/interviewer/dashboard"
            element={
              <RequireAuth>
                <InterviewerDashboardPage />
              </RequireAuth>
            }
          />
          <Route path="/interviewer" element={<Navigate to="/interviewer/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
