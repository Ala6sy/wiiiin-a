/** طلبات زوار مختبرات الأكواد — محلي + API */

export type LabSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface VisitorLabProject {
  localId: string;
  serverId?: string;
  title: string;
  desc: string;
  codeHtml: string;
  codeCss: string;
  codeJs: string;
  category: string;
  visitorName?: string;
  visitorContact?: string;
  status: LabSubmissionStatus;
  adminNote?: string;
  submittedAt: string;
  approvedSnippetId?: string;
}

export interface LabSubmissionRow {
  id: string;
  clientId: string;
  visitorName: string;
  visitorContact: string;
  title: string;
  desc: string;
  codeHtml: string;
  codeCss: string;
  codeJs: string;
  category: string;
  status: LabSubmissionStatus;
  adminNote: string;
  approvedSnippetId: string;
  createdAt: string;
  reviewedAt: string;
}

const CLIENT_KEY = 'labClientId_v1';
const PROJECTS_KEY = 'labVisitorProjects_v1';

function apiBase(): string {
  if (typeof window !== 'undefined' && window.location.pathname.includes('/api/')) {
    return './lab_submissions.php';
  }
  return '/api/lab_submissions.php';
}

export function newLabLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `lab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getLabClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = newLabLocalId();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return 'guest';
  }
}

export function loadVisitorLabProjects(): VisitorLabProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VisitorLabProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVisitorLabProjects(projects: VisitorLabProject[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch { /* storage full */ }
}

export function upsertVisitorLabProject(project: VisitorLabProject): VisitorLabProject[] {
  const list = loadVisitorLabProjects();
  const idx = list.findIndex((p) => p.localId === project.localId);
  const next = [...list];
  if (idx >= 0) next[idx] = project;
  else next.unshift(project);
  saveVisitorLabProjects(next);
  return next;
}

export function removeVisitorLabProject(localId: string): VisitorLabProject[] {
  const next = loadVisitorLabProjects().filter((p) => p.localId !== localId);
  saveVisitorLabProjects(next);
  return next;
}

/** دمج حالة الطلبات من السيرفر مع النسخة المحلية */
export function mergeVisitorStatusFromServer(
  local: VisitorLabProject[],
  serverItems: LabSubmissionRow[],
  publishedSnippetIds: Set<string>,
): VisitorLabProject[] {
  const byServer = new Map(serverItems.map((s) => [s.id, s]));
  const next: VisitorLabProject[] = [];

  for (const p of local) {
    const sid = p.serverId || p.localId;
    const srv = byServer.get(sid);
    if (!srv) {
      next.push(p);
      continue;
    }
    const merged: VisitorLabProject = {
      ...p,
      serverId: srv.id,
      status: srv.status,
      adminNote: srv.adminNote || undefined,
      approvedSnippetId: srv.approvedSnippetId || undefined,
    };
    // إذا نُشر على الموقع ولم يعد الزائر يحتاج النسخة المحلية
    if (
      merged.status === 'approved' &&
      merged.approvedSnippetId &&
      publishedSnippetIds.has(merged.approvedSnippetId)
    ) {
      continue;
    }
    next.push(merged);
  }
  saveVisitorLabProjects(next);
  return next;
}

export async function submitVisitorLabProject(project: VisitorLabProject): Promise<{
  ok: boolean;
  serverId?: string;
  error?: string;
}> {
  const clientId = getLabClientId();
  const submissionId = project.serverId || project.localId;
  try {
    const res = await fetch(apiBase(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit',
        clientId,
        submission: {
          id: submissionId,
          title: project.title,
          desc: project.desc,
          codeHtml: project.codeHtml,
          codeCss: project.codeCss,
          codeJs: project.codeJs,
          category: project.category,
          visitorName: project.visitorName || '',
          visitorContact: project.visitorContact || '',
        },
      }),
    });
    const data = await res.json() as { ok?: boolean; id?: string; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, serverId: data.id || submissionId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export async function fetchVisitorLabStatuses(): Promise<LabSubmissionRow[]> {
  const clientId = getLabClientId();
  try {
    const res = await fetch(`${apiBase()}?action=status&clientId=${encodeURIComponent(clientId)}`);
    const data = await res.json() as { ok?: boolean; items?: LabSubmissionRow[] };
    if (!res.ok || !data.ok || !Array.isArray(data.items)) return [];
    return data.items;
  } catch {
    return [];
  }
}

export async function syncVisitorLabProjects(publishedSnippetIds: string[]): Promise<VisitorLabProject[]> {
  const local = loadVisitorLabProjects();
  const serverItems = await fetchVisitorLabStatuses();
  return mergeVisitorStatusFromServer(local, serverItems, new Set(publishedSnippetIds));
}

export async function fetchPendingLabSubmissions(token: string): Promise<LabSubmissionRow[]> {
  try {
    const res = await fetch(`${apiBase()}?action=list&status=pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json() as { ok?: boolean; items?: LabSubmissionRow[] };
    if (!res.ok || !data.ok || !Array.isArray(data.items)) return [];
    return data.items;
  } catch {
    return [];
  }
}

export async function approveLabSubmission(
  token: string,
  id: string,
  adminNote = '',
): Promise<{ ok: boolean; snippet?: SoftwareSnippetFromApi; error?: string }> {
  try {
    const res = await fetch(apiBase(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'approve', id, adminNote }),
    });
    const data = await res.json() as { ok?: boolean; snippet?: SoftwareSnippetFromApi; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, snippet: data.snippet };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export async function rejectLabSubmission(
  token: string,
  id: string,
  adminNote = '',
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(apiBase(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'reject', id, adminNote }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export interface SoftwareSnippetFromApi {
  id: string;
  title: string;
  desc: string;
  codeHtml: string;
  codeCss: string;
  codeJs: string;
  category: string;
}

export type LabGridItem =
  | { kind: 'published'; snippet: import('./appData').SoftwareSnippet; index: number }
  | { kind: 'visitor'; project: VisitorLabProject };
