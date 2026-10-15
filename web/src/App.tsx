import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PageLoader } from './components/ui';
import { api } from './lib/api';
import { qk, useBootstrap, useClasses } from './lib/hooks';
// Login is the first paint: keep it in the entry chunk. Everything else is
// split into route chunks so the sign-in page downloads far less JavaScript.
import LoginPage from './features/auth/LoginPage';
const LegalPage = lazy(() => import('./features/legal/LegalPage'));
const OnboardingPage = lazy(() => import('./features/onboarding/OnboardingPage'));
const ClassShell = lazy(() => import('./features/class/ClassShell'));
const TodayPage = lazy(() => import('./features/today/TodayPage'));
const WeekPage = lazy(() => import('./features/week/WeekPage'));
const HomeworkPage = lazy(() => import('./features/homework/HomeworkPage'));
const SchedulePage = lazy(() => import('./features/schedule/SchedulePage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));

export default function App() {
  const boot = useBootstrap();
  const qc = useQueryClient();
  // Seed the individual caches so useMe/useConfig/useProviders elsewhere
  // never refetch what bootstrap already returned.
  useEffect(() => {
    if (!boot.data) return;
    qc.setQueryData(qk.me, { user: boot.data.user });
    qc.setQueryData(qk.config, boot.data.config);
    qc.setQueryData(qk.providers, boot.data.providers);
  }, [boot.data, qc]);
  const classes = useClasses(Boolean(boot.data?.user));
  const userId = boot.data?.user?.id;

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

  if (boot.isLoading) return <PageLoader />;

  const user = boot.data?.user ?? null;
  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/terms" element={<LegalPage doc="terms" />} />
          <Route path="/privacy" element={<LegalPage doc="privacy" />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (classes.isLoading) return <PageLoader />;
  const list = classes.data?.classes ?? [];
  const first = list[0]?.id ?? null;
  const home = first ? `/class/${first}` : '/onboarding';

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Navigate to={home} replace />} />
        <Route path="/terms" element={<LegalPage doc="terms" />} />
        <Route path="/privacy" element={<LegalPage doc="privacy" />} />
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
    </Suspense>
  );
}
