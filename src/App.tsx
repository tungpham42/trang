import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import LecturePage from './pages/Lecture';
import Login from './pages/Login';
import NewLecture from './pages/NewLecture';
import Settings from './pages/Settings';
import Study from './pages/Study';
import Transcribe from './pages/Transcribe';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="new" element={<NewLecture />} />
          <Route path="lectures/:lectureId" element={<LecturePage />} />
          <Route path="study" element={<Study />} />
          <Route path="study/:lectureId" element={<Study />} />
          <Route path="transcribe" element={<Transcribe />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
