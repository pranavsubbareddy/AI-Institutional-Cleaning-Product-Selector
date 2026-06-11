import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import RequirementForm from './pages/RequirementForm';
import Recommendations from './pages/Recommendations';
import Dashboard from './pages/Dashboard';
import DetailPage from './pages/DetailPage';
import Workflow from './pages/Workflow';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="form" element={<RequirementForm />} />
        <Route path="recommendations/:id" element={<Recommendations />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="detail/:id" element={<DetailPage />} />
        <Route path="workflow" element={<Workflow />} />
      </Route>
    </Routes>
  );
}
