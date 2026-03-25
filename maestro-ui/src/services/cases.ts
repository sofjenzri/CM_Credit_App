export interface CaseListItem {
  id: string;
  caseId: string;
  processKey?: string;
  processVersion?: string;
  status: string;
  currentStage?: string;
  clientName?: string;
  creditType?: string;
  requestedAmount?: number | string;
  dossierStatus?: string;
  currentActivityLabel?: string;
  currentActivityType?: string;
  createdTime?: string;
  slaStatus?: string;
}

export interface CaseTask {
  id: string;
  name?: string;
  status?: string;
  type?: string;
  assignee?: string;
  dueDate?: string;
  slaStatus?: string;
  taskState?: string;
  stageName?: string;
  stageId?: string;
  startedTime?: string;
  completedTime?: string;
  externalLink?: string;
}

export interface CaseStage {
  id: string;
  name?: string;
  status?: string;
  startedTime?: string;
  completedTime?: string;
  isCurrent?: boolean;
  sla?: { length?: number; duration?: string } | null;
  tasks?: CaseTask[];
}

export interface CaseActivity {
  id: string;
  title?: string;
  time?: string;
  actor?: string;
  status?: string;
  details?: string;
  source?: string;
}

export interface CaseElementExecution {
  elementId?: string;
  elementName?: string;
  elementType?: string;
  status?: string;
  startedTimeUtc?: string;
  completedTimeUtc?: string;
  externalLink?: string;
}

export interface CaseExecutionHistory {
  elementExecutions?: CaseElementExecution[];
}

export interface CaseDetail {
  id: string;
  caseId: string;
  folderKey?: string;
  adminUrl?: string;
  processKey?: string;
  processVersion?: string;
  status?: string;
  currentStage?: string;
  createdTime?: string;
  startedTime?: string;
  slaStatus?: string;
  stages?: CaseStage[];
  tasks?: CaseTask[];
  activity?: CaseActivity[];
  executionHistory?: CaseExecutionHistory;
  client?: {
    clientId?: string;
    name?: string;
    birthDate?: string;
    scoring?: string | number;
    debtRatio?: string;
    incomes?: string | number;
    expenses?: string | number;
  };
  credit?: {
    creditType?: string;
    requestedAmount?: string | number;
    duration?: string | number;
    finalDecision?: string;
    paymentDate?: string;
  };
  documents?: Array<{
    id: string;
    fileType?: string;
    fileName?: string;
    url?: string;
  }>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const getAuthHeaders = (): HeadersInit => {
  const authToken = localStorage.getItem('auth_token');
  const uiPathToken = localStorage.getItem('uipath_access_token');
  const token = uiPathToken || authToken;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const postFormData = async <T>(path: string, body: FormData): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const deleteRequest = async (path: string): Promise<void> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
};

export const casesService = {
  getCases: () => fetchJson<CaseListItem[]>('/cases'),
  getCaseById: (id: string) => fetchJson<CaseDetail>(`/cases/${encodeURIComponent(id)}`),
  uploadDocument: (caseId: string, file: File) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('fileName', file.name);
    formData.append('fileType', file.type || '');
    return postFormData<NonNullable<CaseDetail['documents']>[number]>(`/cases/${encodeURIComponent(caseId)}/documents`, formData);
  },
  deleteDocument: (recordId: string) => deleteRequest(`/documents/${encodeURIComponent(recordId)}`),
};
