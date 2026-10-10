export interface Me {
  id: string;
  name: string;
  email: string | null;
  email_verified?: boolean;
  avatar_url: string | null;
  is_admin?: boolean;
}

export interface ClassFeatures {
  upload_mb: number | null;
  read_only: boolean;
  featured: boolean;
  official: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  email_verified: boolean;
  avatar_url: string | null;
  banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  last_seen_at: string | null;
  created_at: string;
  classes?: number;
  homework?: number;
  sessions?: number;
}

export interface AdminMembership {
  id: string;
  name: string;
  role: 'owner' | 'member';
  members: number;
  homework: number;
  created_at: string;
}

export interface LoginEvent {
  id: string;
  user_id: string;
  ip: string | null;
  user_agent: string | null;
  accept_language: string | null;
  timezone: string | null;
  locale: string | null;
  screen: string | null;
  platform: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string | null;
}

export interface AdminClass {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string | null;
  invite_code: string;
  post_policy: 'everyone' | 'restricted';
  source_url: string | null;
  members: number;
  homework: number;
  subjects: number;
  created_at: string;
  features: ClassFeatures;
}

export interface AdminStats {
  users: number;
  verified: number;
  banned: number;
  classes: number;
  subjects: number;
  slots: number;
  homework: number;
  attachments: number;
  storageBytes: number;
  activeSessions: number;
  newUsers7: number;
  newUsers30: number;
  homework7: number;
  logins24: number;
  providers: { provider: string; n: number }[];
  topClasses: { id: string; name: string; owner: string; members: number; homework: number }[];
  recentUsers: { id: string; name: string; email: string | null; email_verified: number; banned_at: string | null; created_at: string; classes: number }[];
}

export interface ClassSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  invite_code: string;
  post_policy: 'everyone' | 'restricted';
  source_url: string | null;
  features?: ClassFeatures;
  created_at: string;
  can_manage?: boolean;
  member_count?: number;
  subject_count?: number;
  homework_count?: number;
}

export interface Member {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  teacher: string | null;
  permitted_user_ids: string[];
}

export interface Slot {
  id?: string;
  day: number;
  period: number;
  subject_id?: string | null;
  subject: string;
  color?: string | null;
  teacher: string;
  room: string;
  start: string;
  end: string;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string | null;
  size: number;
  url: string;
}

export interface Homework {
  id: string;
  title: string;
  body: string | null;
  due_date: string;
  due_period: number | null;
  created_at: string;
  updated_at: string;
  subject: { id: string; name: string; color: string } | null;
  author: { id: string; name: string; avatar_url: string | null } | null;
  attachments: Attachment[];
}

export interface ClassDetail {
  class: ClassSummary;
  members: Member[];
  subjects: Subject[];
  schedule: Slot[];
}

export interface Draft {
  name?: string;
  note?: string;
  sourceUrl?: string | null;
  slots: Slot[];
}

export interface Providers {
  google: boolean;
  github: boolean;
  dev: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.error || res.statusText || 'Request failed', res.status);
  return data as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  config: () => request<{ maxUploadMb: number; subjectColors: string[] }>('/config'),
  // auth
  providers: () => request<Providers>('/auth/providers'),
  me: () => request<{ user: Me | null }>('/me'),
  rename: (name: string) => request<{ user: Me }>('/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
  devLogin: (name: string, email: string) => request<{ user: Me }>('/auth/dev', json({ name, email })),
  emailStart: (email: string, name: string, locale: string) =>
    request<{ ok: true; email: string; provider: string; expiresInMin: number; devCode?: string; devLink?: string }>(
      '/auth/email/start',
      json({ email, name, locale }),
    ),
  emailVerify: (email: string, code: string) => request<{ user: Me }>('/auth/email/verify', json({ email, code })),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  // classes
  classes: () => request<{ classes: ClassSummary[] }>('/classes'),
  createClass: (name: string) => request<{ class: ClassSummary }>('/classes', json({ name })),
  joinClass: (code: string) => request<{ class: ClassSummary }>('/classes/join', json({ code })),
  class: (id: string) => request<ClassDetail>(`/classes/${id}`),
  updateClass: (id: string, patch: Partial<Pick<ClassSummary, 'name' | 'post_policy' | 'source_url'>>) =>
    request<{ class: ClassSummary }>(`/classes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteClass: (id: string) => request<{ ok: true }>(`/classes/${id}`, { method: 'DELETE' }),
  newInvite: (id: string) => request<{ invite_code: string }>(`/classes/${id}/invite`, { method: 'POST' }),
  setMemberRole: (id: string, userId: string, role: 'owner' | 'member') =>
    request<{ members: Member[] }>(`/classes/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (id: string, userId: string) =>
    request<{ members: Member[] }>(`/classes/${id}/members/${userId}`, { method: 'DELETE' }),

  // subjects
  createSubject: (classId: string, body: { name: string; color?: string; teacher?: string }) =>
    request<{ subject: Subject }>(`/classes/${classId}/subjects`, json(body)),
  updateSubject: (id: string, body: { name?: string; color?: string; teacher?: string }) =>
    request<{ subject: Subject }>(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSubject: (id: string) => request<{ ok: true }>(`/subjects/${id}`, { method: 'DELETE' }),
  setSubjectPermissions: (id: string, userIds: string[]) =>
    request<{ subject: Subject }>(`/subjects/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ userIds }) }),

  // schedule
  saveSchedule: (classId: string, slots: Slot[], sourceUrl?: string | null) =>
    request<{ saved: number; schedule: Slot[]; subjects: Subject[]; class: ClassSummary }>(
      `/classes/${classId}/schedule`,
      { method: 'PUT', body: JSON.stringify({ slots, source_url: sourceUrl }) },
    ),
  importSample: (classId: string) =>
    request<{ draft: Draft }>(`/classes/${classId}/import/sample`, { method: 'POST' }),
  importPdf: (classId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ draft: Draft }>(`/classes/${classId}/import/pdf`, { method: 'POST', body: fd });
  },

  // homework
  homework: (classId: string, params: { from?: string; to?: string; subject?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.subject) q.set('subject', params.subject);
    const qs = q.toString();
    return request<{ homework: Homework[] }>(`/classes/${classId}/homework${qs ? `?${qs}` : ''}`);
  },
  createHomework: (classId: string, body: { subject_id: string | null; title: string; body: string; due_date: string; due_period?: number | null }) =>
    request<{ homework: Homework }>(`/classes/${classId}/homework`, json(body)),
  updateHomework: (id: string, body: Partial<{ subject_id: string | null; title: string; body: string; due_date: string; due_period: number | null }>) =>
    request<{ homework: Homework }>(`/homework/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteHomework: (id: string) => request<{ ok: true }>(`/homework/${id}`, { method: 'DELETE' }),
  uploadFiles: (homeworkId: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return request<{ attachments: Attachment[] }>(`/homework/${homeworkId}/attachments`, { method: 'POST', body: fd });
  },
  deleteAttachment: (id: string) => request<{ ok: true }>(`/attachments/${id}`, { method: 'DELETE' }),

  /** Client-side fingerprint bits for the admin panel. */
  fingerprint: (payload: { timezone: string; locale: string; screen: string; platform: string }) =>
    request<{ ok: true }>('/me/fingerprint', json(payload)),

  // ---- admin ----
  adminStats: () => request<{ stats: AdminStats; adminEmails: string[] }>('/admin/stats'),
  adminUsers: (params: { q?: string; filter?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.filter) qs.set('filter', params.filter);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const s = qs.toString();
    return request<{ users: AdminUser[]; total: number }>(`/admin/users${s ? `?${s}` : ''}`);
  },
  adminUser: (id: string) =>
    request<{ user: AdminUser; memberships: AdminMembership[]; logins: LoginEvent[]; ips: { ip: string; n: number; last: string }[] }>(`/admin/users/${id}`),
  adminUpdateUser: (id: string, patch: Partial<{ name: string; email: string | null; email_verified: boolean; banned: boolean; ban_reason: string | null }>) =>
    request<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  adminRevokeSessions: (id: string) => request<{ revoked: number }>(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }),
  adminDeleteUser: (id: string, force = false) =>
    request<{ ok: true }>(`/admin/users/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' }),
  adminClasses: (q = '') => request<{ classes: AdminClass[] }>(`/admin/classes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminUpdateClass: (id: string, patch: Partial<{ name: string; post_policy: 'everyone' | 'restricted'; new_invite: boolean; features: Partial<ClassFeatures> }>) =>
    request<{ class: AdminClass }>(`/admin/classes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  adminDeleteClass: (id: string) => request<{ ok: true }>(`/admin/classes/${id}`, { method: 'DELETE' }),
  adminLogins: (limit = 60) => request<{ logins: LoginEvent[] }>(`/admin/logins?limit=${limit}`),
};
