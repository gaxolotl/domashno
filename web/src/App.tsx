import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from './components/ui';
import { api } from './lib/api';
import { useClasses, useMe } from './lib/hooks';
import LoginPage from './features/auth/LoginPage';
import OnboardingPage from './features/onboarding/OnboardingPage';
import ClassShell from './features/class/ClassShell';
import TodayPage from './features/today/TodayPage';
import WeekPage from './features/week/WeekPage';
import HomeworkPage from './features/homework/HomeworkPage';
import SchedulePage from './features/schedule/SchedulePage';
import SettingsPage from './features/settings/SettingsPage';
import AdminPage from './features/admin/AdminPage';

export default function App() {
  const me = useMe();
  const classes = useClasses(Boolean(me.data?.user));
  const userId = me.data?.user?.id;

  // Send client-side fingerprint bits once per login (for the admin panel).
  useEffect(() => {
    if (!userId) return;
    try {
      api
        .fingerprint({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          locale: navigator.language || '',
          screen: `${window.screen.width}x${window.screen.height}`,
          platform: (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '',
        })
        .catch(() => { /* not important */ });
    } catch { /* ignore */ }
  }, [userId]);

  if (me.isLoading) return <PageLoader />;

  const user = me.data?.user ?? null;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (classes.isLoading) return <PageLoader />;
  const list = classes.data?.classes ?? [];
  const first = list[0]?.id ?? null;
  const home = first ? `/class/${first}` : '/onboarding';

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={home} replace />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/class/:classId" element={<ClassShell />}>
        <Route index element={<TodayPage />} />
        <Route path="week" element={<WeekPage />} />
        <Route path="homework" element={<HomeworkPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
