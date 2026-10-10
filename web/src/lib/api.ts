export interface Me {
  id: string;
  name: string;
  email: string | null;
  email_verified?: boolean;
  avatar_url: string | null;
}

export interface ClassSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  invite_code: string;
  post_policy: 'everyone' | 'restricted';
  source_url: string | null;
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
  createHomework: (classId: string, body: { subject_id: string | null; title: string; body: string; due_date: string }) =>
    request<{ homework: Homework }>(`/classes/${classId}/homework`, json(body)),
  updateHomework: (id: string, body: Partial<{ subject_id: string | null; title: string; body: string; due_date: string }>) =>
    request<{ homework: Homework }>(`/homework/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteHomework: (id: string) => request<{ ok: true }>(`/homework/${id}`, { method: 'DELETE' }),
  uploadFiles: (homeworkId: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return request<{ attachments: Attachment[] }>(`/homework/${homeworkId}/attachments`, { method: 'POST', body: fd });
  },
  deleteAttachment: (id: string) => request<{ ok: true }>(`/attachments/${id}`, { method: 'DELETE' }),
};
