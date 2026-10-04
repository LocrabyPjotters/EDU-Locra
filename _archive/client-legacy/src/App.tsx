
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import './i18n';
import SetupWizard from './pages/SetupWizard';
import Login from './pages/Login';
import AdminLayout from './pages/AdminLayout';
import ChatLayout from './pages/chat/ChatLayout';
import SharedChatView from './pages/chat/SharedChatView';
import TeacherLayout from './pages/teacher/TeacherLayout';
import StudentLayout from './pages/student/StudentLayout';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcademyLayout from './pages/academy/AcademyLayout';
import TeacherAcademyLayout from './pages/teacher-academy/TeacherAcademyLayout';
import CodeMatchLayout from './pages/codematch/CodeMatchLayout';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useOrgStore } from './store/orgStore';
import { ToastProvider } from './components/ToastProvider';

function App() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    if (token) {
      fetch('/api/organization/customization', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          useOrgStore.getState().setOrgCustomization({ aiName: data.aiName, name: data.name });
          if (data.primaryColor) document.documentElement.style.setProperty('--primary', data.primaryColor);
          if (data.secondaryColor) document.documentElement.style.setProperty('--secondary', data.secondaryColor);
          if (data.accentColor) document.documentElement.style.setProperty('--accent', data.accentColor);
          if (data.faviconUrl) {
            const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = data.faviconUrl;
            document.getElementsByTagName('head')[0].appendChild(link);
          }
        }
      })
      .catch(e => console.error(e));
    }
  }, [token]);

  useEffect(() => {
    // Apply user preference for dark mode (assuming true = dark, false = light)
    if (user && user.darkMode === false) {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [user?.darkMode]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup/*" element={<SetupWizard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/teacher/*" element={<TeacherLayout />} />
          <Route path="/student/*" element={<StudentLayout />} />
          <Route path="/academy/*" element={<AcademyLayout />} />
          <Route path="/teacher-academy/*" element={<TeacherAcademyLayout />} />
          <Route path="/codematch/*" element={<CodeMatchLayout />} />
          <Route path="/chat/shared/:token" element={<SharedChatView />} />
          <Route path="/chat/*" element={<ChatLayout />} />
          <Route path="/*" element={<Navigate to="/setup" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
