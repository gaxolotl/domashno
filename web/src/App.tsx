import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from './components/ui';
import { useClasses, useMe } from './lib/hooks';
import LoginPage from './features/auth/LoginPage';
import OnboardingPage from './features/onboarding/OnboardingPage';
import ClassShell from './features/class/ClassShell';
import TodayPage from './features/today/TodayPage';
import WeekPage from './features/week/WeekPage';
import HomeworkPage from './features/homework/HomeworkPage';
import SchedulePage from './features/schedule/SchedulePage';
import SettingsPage from './features/settings/SettingsPage';

export default function App() {
  const me = useMe();
  const classes = useClasses(Boolean(me.data?.user));

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
