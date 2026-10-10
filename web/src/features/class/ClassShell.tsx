import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays, ChevronDown, ListChecks, LogOut, NotebookPen, Plus, Settings, Ticket,
} from 'lucide-react';
import { Avatar, Button, PageSkeleton, cn } from '../../components/ui';
import { Logo } from '../../components/Brand';
import { LanguageControl, ThemeControl } from '../../components/Controls';
import { api, type ClassDetail, type Me } from '../../lib/api';
import { useClass, useClasses, useMe } from '../../lib/hooks';
import { m } from '../../paraglide/messages';

interface Ctx {
  detail: ClassDetail;
  classId: string;
  canManage: boolean;
  canPost: (subjectId: string | null) => boolean;
  subjectColor: (subjectId: string | null) => string;
}

const ClassContext = createContext<Ctx | null>(null);
export function useClassCtx() {
  const ctx = useContext(ClassContext);
  if (!ctx) throw new Error('useClassCtx outside ClassShell');
  return ctx;
}

function navItems() {
  return [
    { to: '', end: true, label: m.nav_today(), icon: NotebookPen },
    { to: 'week', end: false, label: m.nav_week(), icon: CalendarDays },
    { to: 'homework', end: false, label: m.nav_homework(), icon: ListChecks },
    { to: 'settings', end: false, label: m.nav_settings(), icon: Settings },
  ];
}

function ClassSwitcher({ currentId, currentName }: { currentId: string; currentName: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useClasses();
  const nav = useNavigate();
  const list = data?.classes ?? [];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left transition-colors hover:bg-surface2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{currentName}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-pop absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => { setOpen(false); nav(`/class/${c.id}`); }}
                className={cn('flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-surface2', c.id === currentId && 'bg-primary-soft/60 font-medium')}
              >
                <span className="truncate">{c.name}</span>
                {c.id === currentId && <span className="text-xs text-primary">●</span>}
              </button>
            ))}
            <div className="border-t border-line">
              <button onClick={() => { setOpen(false); nav('/onboarding?tab=create'); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink">
                <Plus className="h-4 w-4" /> {m.cp_create()}
              </button>
              <button onClick={() => { setOpen(false); nav('/onboarding?tab=join'); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink">
                <Ticket className="h-4 w-4" /> {m.cp_join()}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ShellLayout({ classId, name, user, children }: { classId: string; name: string; user: Me | null | undefined; children: ReactNode }) {
  const items = navItems();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1200px]">
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-4 border-r border-line px-4 py-5 lg:flex">
        <div className="flex items-center gap-2 px-1">
          <Logo size={30} />
          <span className="text-lg font-bold tracking-tight">Домашно</span>
        </div>

        <ClassSwitcher currentId={classId} currentName={name || '…'} />

        <nav className="mt-1 flex flex-1 flex-col gap-1">
          {items.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to || 'index'}
              to={to ? `/class/${classId}/${to}` : `/class/${classId}`}
              end={end}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface2 hover:text-ink')}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <Avatar name={user?.name ?? ''} src={user?.avatar_url} size={30} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{user?.name}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThemeControl />
              <LanguageControl />
            </div>
            <Button variant="ghost" size="icon" title={m.nav_signout()} onClick={async () => { await api.logout(); location.assign('/'); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo size={30} />
          <div className="min-w-0 flex-1">
            <ClassSwitcher currentId={classId} currentName={name || '…'} />
          </div>
          <ThemeControl />
          <LanguageControl />
        </header>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">{children}</main>
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
          {items.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to || 'index'}
              to={to ? `/class/${classId}/${to}` : `/class/${classId}`}
              end={end}
              className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors', isActive ? 'text-primary' : 'text-muted')}
            >
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-8 w-full place-items-center rounded-lg', isActive && 'bg-primary-soft')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function ClassShell() {
  const { classId = '' } = useParams();
  const me = useMe();
  const { data, isError } = useClass(classId);
  const classesQ = useClasses();
  const nav = useNavigate();
  const location = useLocation();

  const ctx = useMemo<Ctx | null>(() => {
    if (!data) return null;
    const isOwner = data.class.role === 'owner';
    const byId = new Map(data.subjects.map((s) => [s.id, s]));
    return {
      detail: data,
      classId,
      canManage: isOwner,
      canPost: (subjectId) => {
        if (isOwner) return true;
        if (data.class.post_policy === 'everyone') return true;
        if (subjectId && byId.get(subjectId)?.permitted_user_ids.includes(me.data?.user?.id ?? '')) return true;
        return false;
      },
      subjectColor: (subjectId) => (subjectId && byId.get(subjectId)?.color) || 'var(--muted)',
    };
  }, [data, classId, me.data?.user?.id]);

  if (isError) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-muted">{m.common_error()}</p>
          <Button className="mt-4" onClick={() => nav('/')}>{m.common_back()}</Button>
        </div>
      </div>
    );
  }

  const name = data?.class.name ?? (classesQ.data?.classes ?? []).find((c) => c.id === classId)?.name ?? '';

  return (
    <ClassContext.Provider value={ctx}>
      <ShellLayout classId={classId} name={name} user={me.data?.user}>
        {/* Keyed by path so every page animates in the same way. */}
        <div key={location.pathname} className="animate-rise">
          {ctx ? <Outlet /> : <PageSkeleton />}
        </div>
      </ShellLayout>
    </ClassContext.Provider>
  );
}
