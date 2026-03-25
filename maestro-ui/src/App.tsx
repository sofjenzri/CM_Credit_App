import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import LoanRequestPage from './pages/LoanRequestPage';
import SubmissionsPage from './pages/SubmissionsPage';
import CaseDetailPage from './pages/CaseDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import PriorityQueuePage from './pages/PriorityQueuePage';
import AgentsPage from './pages/AgentsPage';
import PortfolioPage from './pages/PortfolioPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/new-request" element={<LoanRequestPage />} />
            <Route path="/submissions" element={<SubmissionsPage />} />
            <Route path="/cases" element={<SubmissionsPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/cases/:id/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="/priority-queue" element={<PriorityQueuePage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
