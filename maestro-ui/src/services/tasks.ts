const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const getAuthHeaders = (): HeadersInit => {
  const authToken = localStorage.getItem('auth_token');
  const uiPathToken = localStorage.getItem('uipath_access_token');
  const token = uiPathToken || authToken;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export interface TaskFormResponse {
  formLayout?: unknown;
  formLayoutId?: string | null;
  bulkFormLayoutId?: string | null;
  actionLabel?: string;
  status?: number;
  data?: Record<string, unknown>;
  action?: string | null;
  title?: string;
  type?: string;
  priority?: string;
  assignedToUser?: {
    displayName?: string;
    emailAddress?: string;
  } | null;
  creationTime?: string;
  completionTime?: string | null;
  id?: number;
}

export interface TaskDetailsResponse {
  Id?: number;
  Title?: string;
  Status?: string;
  Type?: string;
  Priority?: string;
  TaskAssigneeName?: string | null;
  CreationTime?: string;
  CompletionTime?: string | null;
}

export const tasksService = {
  getTask: (taskId: string) => fetchJson<TaskDetailsResponse>(`/tasks/${encodeURIComponent(taskId)}`),
  getTaskForm: (taskId: string) => fetchJson<TaskFormResponse>(`/tasks/${encodeURIComponent(taskId)}/form`),
  assignTaskToSelf: (taskId: string) =>
    fetchJson<void>(`/tasks/${encodeURIComponent(taskId)}/assign-self`, {
      method: 'POST',
    }),
  completeTask: (taskId: string, payload: { action: string; data: Record<string, unknown> }) =>
    fetchJson<unknown>(`/tasks/${encodeURIComponent(taskId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};
