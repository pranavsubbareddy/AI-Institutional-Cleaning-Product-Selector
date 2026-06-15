import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import RequirementForm from './pages/RequirementForm';
import Recommendations from './pages/Recommendations';
import Dashboard from './pages/Dashboard';
import DetailPage from './pages/DetailPage';
import NotFound from './pages/NotFound';
import EditInstitution from './pages/EditInstitution';
import ProfilePage from './pages/ProfilePage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import ProtectedRoute from './components/ProtectedRoute';
import usePageTracking from './hooks/usePageTracking';

export default function App() {
  usePageTracking();
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="recommendations/:id" element={<Recommendations />} />
        <Route element={<ProtectedRoute />}>
          <Route path="form" element={<RequirementForm />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="detail/:id" element={<DetailPage />} />
          <Route path="edit/:id" element={<EditInstitution />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
