const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const UIPATH_BASE_URL = (import.meta.env.VITE_UIPATH_BASE_URL || 'https://staging.uipath.com').replace(/\/+$/, '');
const UIPATH_ORG_NAME = import.meta.env.VITE_UIPATH_ORG_NAME || 'france';
const UIPATH_TENANT_NAME = import.meta.env.VITE_UIPATH_TENANT_NAME || 'DefaultTenant';

export const getExtension = (fileName?: string) => {
  const value = String(fileName || '').toLowerCase();
  const index = value.lastIndexOf('.');
  if (index < 0) return '';
  return value.slice(index + 1);
};

export const guessMimeTypeFromFileName = (fileName?: string) => {
  const extension = getExtension(fileName);
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'txt') return 'text/plain';
  return 'application/octet-stream';
};

export const resolvePreviewMimeType = (rawMimeType: string, fileName?: string) => {
  const normalized = String(rawMimeType || '').split(';')[0].trim().toLowerCase();
  if (normalized && normalized !== 'application/octet-stream') return normalized;
  return guessMimeTypeFromFileName(fileName);
};

export const canPreviewInViewer = (mimeType: string, fileName?: string) => {
  const extension = getExtension(fileName);
  if (mimeType.startsWith('image/')) return true;
  if (mimeType === 'application/pdf') return true;
  if (mimeType.startsWith('text/')) return true;
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt'].includes(extension);
};

export const toAbsoluteDocumentUrl = (url?: string) => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) {
    const apiRoot = API_BASE.replace(/\/api$/, '');
    return `${apiRoot}${url}`;
  }
  return url;
};

export const buildMaestroDetailUrl = (caseId?: string, folderKey?: string) => {
  if (!caseId) return '';
  const baseUrl = `${UIPATH_BASE_URL}/${encodeURIComponent(UIPATH_ORG_NAME)}/${encodeURIComponent(UIPATH_TENANT_NAME)}/maestro_/case-management/${encodeURIComponent(caseId)}/overview`;
  if (!folderKey) return baseUrl;
  return `${baseUrl}?folderKey=${encodeURIComponent(folderKey)}`;
};

export const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatAmount = (value?: string | number) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';
  return `${new Intl.NumberFormat('fr-FR').format(numericValue)} €`;
};

export const translateStatus = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.includes('not started')) return 'Non démarré';
  if (normalized.includes('at risk')) return 'À risque';
  if (normalized.includes('on track')) return 'Dans les temps';
  if (normalized.includes('in progress') || normalized.includes('inprogress')) return 'En cours';
  if (normalized.includes('completed') || normalized.includes('complete')) return 'Terminé';
  if (normalized.includes('cancel')) return 'Annulé';
  if (normalized.includes('overdue') || normalized.includes('late')) return 'En retard';
  if (normalized.includes('breach')) return 'Dépassé';
  if (normalized.includes('pending')) return 'En attente';
  if (normalized.includes('assigned')) return 'Assigné';
  if (normalized.includes('active')) return 'Actif';
  if (normalized.includes('running')) return 'En cours';
  if (normalized.includes('open')) return 'Ouvert';
  if (normalized.includes('closed')) return 'Clôturé';
  if (normalized.includes('error') || normalized.includes('fail') || normalized.includes('fault')) return 'En échec';
  if (normalized === 'unknown') return 'Inconnu';
  return raw;
};

export const badgeClassForStatus = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('fault') || normalized.includes('error') || normalized.includes('fail')) {
    return 'bg-red-100 text-red-700';
  }
  if (normalized.includes('complete') || normalized.includes('cancel')) {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-cyan-100 text-cyan-700';
};

export const badgeClassForSla = (slaStatus?: string) => {
  const normalized = String(slaStatus || '').toLowerCase();
  if (normalized.includes('risk') || normalized.includes('warning')) return 'bg-amber-100 text-amber-800';
  if (normalized.includes('breach') || normalized.includes('overdue') || normalized.includes('late')) return 'bg-red-100 text-red-700';
  if (normalized.includes('track') || normalized.includes('ok') || normalized.includes('green')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
};

export const isCompletedTaskStatus = (status?: string, taskState?: string) => {
  const normalized = `${String(status || '')} ${String(taskState || '')}`.toLowerCase();
  return normalized.includes('complete') || normalized.includes('done') || normalized.includes('executed') || normalized.includes('closed') || normalized.includes('finish');
};

export const isRunningTaskStatus = (status?: string, taskState?: string) => {
  const normalized = `${String(status || '')} ${String(taskState || '')}`.toLowerCase();
  return normalized.includes('running');
};

export const isCurrentAppTaskStatus = (status?: string, taskState?: string) => {
  const normalized = `${String(status || '')} ${String(taskState || '')}`.toLowerCase();
  return normalized.includes('running')
    || normalized.includes('progress')
    || normalized.includes('active')
    || normalized.includes('open')
    || normalized.includes('assigned')
    || normalized.includes('unassigned')
    || normalized.includes('pending');
};

export const isCompletedExecutionStatus = (status?: string) =>
  String(status || '').toLowerCase().includes('complete');

export const isDisplayableExecutionName = (name?: string) => {
  const value = String(name || '').trim();
  if (!value || value === '-') return false;
  const normalized = value.toLowerCase();
  return !normalized.includes('increment re-entry')
    && !normalized.includes('reset variables')
    && !normalized.includes('update variable')
    && !normalized.includes('gateway_')
    && !normalized.startsWith('startevent')
    && !normalized.startsWith('endevent');
};

export const isAllowedChronologyElementType = (elementType?: string) => {
  const normalized = String(elementType || '').toLowerCase().trim();
  return normalized === 'startevent'
    || normalized === 'servicetask'
    || normalized === 'usertask'
    || normalized === 'subprocess';
};

export const isAppTask = (type?: string) => {
  const normalized = String(type || '').toLowerCase();
  return normalized.includes('apptask') || normalized === 'apptask' || normalized.includes('app');
};

export const isInProgressStageStatus = (status?: string) => {
  const normalized = String(status || '').toLowerCase().trim();
  if (!normalized) return false;
  if (normalized.includes('not started')) return false;
  return normalized.includes('inprogress') || normalized.includes('in progress') || normalized.includes('progress') || normalized.includes('active') || normalized.includes('running');
};

export const toDateOrNull = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const toTimestamp = (value?: string) => {
  const parsed = toDateOrNull(value);
  return parsed ? parsed.getTime() : 0;
};
