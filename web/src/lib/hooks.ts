import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, type Slot } from './api';

export const qk = {
  me: ['me'] as const,
  providers: ['providers'] as const,
  classes: ['classes'] as const,
  config: ['config'] as const,
  bootstrap: ['bootstrap'] as const,
  class: (id: string) => ['class', id] as const,
  homework: (id: string, filter: string) => ['homework', id, filter] as const,
};

function invalidateClass(qc: QueryClient, classId: string) {
  qc.invalidateQueries({ queryKey: qk.class(classId) });
  qc.invalidateQueries({ queryKey: qk.classes });
  qc.invalidateQueries({ queryKey: ['homework', classId] });
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: api.me, staleTime: 30_000 });
}

export function useProviders() {
  return useQuery({ queryKey: qk.providers, queryFn: api.providers, staleTime: Infinity });
}

export function useConfig() {
  return useQuery({ queryKey: qk.config, queryFn: api.config, staleTime: Infinity });
}

/**
 * Auth state + public config + login providers in one round trip (first
 * paint needs all three). Safe to cache forever: every sign-in/out is a full
 * page reload, so the data is always fresh per page load.
 */
export function useBootstrap() {
  return useQuery({ queryKey: qk.bootstrap, queryFn: api.bootstrap, staleTime: Infinity });
}

export function useClasses(enabled = true) {
  return useQuery({ queryKey: qk.classes, queryFn: api.classes, enabled });
}

export function useClass(id: string | undefined) {
  return useQuery({
    queryKey: qk.class(id || 'none'),
    queryFn: () => api.class(id!),
    enabled: Boolean(id),
  });
}

export function useHomework(classId: string | undefined, filter: { from?: string; to?: string; subject?: string } = {}) {
  const filterKey = JSON.stringify(filter);
  return useQuery({
    queryKey: qk.homework(classId || 'none', filterKey),
    queryFn: () => api.homework(classId!, filter),
    enabled: Boolean(classId),
  });
}

export function useSaveSchedule(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slots, sourceUrl }: { slots: Slot[]; sourceUrl?: string | null }) =>
      api.saveSchedule(classId, slots, sourceUrl),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useImportSample(classId: string) {
  return useMutation({ mutationFn: () => api.importSample(classId) });
}

export function useImportPdf(classId: string) {
  return useMutation({ mutationFn: (file: File) => api.importPdf(classId, file) });
}

export function useCreateHomework(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { subject_id: string | null; title: string; body: string; due_date: string }) =>
      api.createHomework(classId, body),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useUpdateHomework(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.updateHomework(id, body as never),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useDeleteHomework(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteHomework(id),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useUploadFiles(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ homeworkId, files }: { homeworkId: string; files: File[] }) =>
      api.uploadFiles(homeworkId, files),
    onSuccess: () => invalidateClass(qc, classId),
  });
}

export function useDeleteAttachment(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAttachment(id),
    onSuccess: () => invalidateClass(qc, classId),
  });
}
