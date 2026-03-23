import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Download, ExternalLink, FileText, Loader2, User, X } from 'lucide-react';
import { Shield } from 'lucide-react';
import { casesService, type CaseDetail, type CaseListItem } from '../services/cases';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const UIPATH_BASE_URL = (import.meta.env.VITE_UIPATH_BASE_URL || 'https://staging.uipath.com').replace(/\/+$/, '');
const UIPATH_ORG_NAME = import.meta.env.VITE_UIPATH_ORG_NAME || 'france';
const UIPATH_TENANT_NAME = import.meta.env.VITE_UIPATH_TENANT_NAME || 'DefaultTenant';

const getExtension = (fileName?: string) => {
  const value = String(fileName || '').toLowerCase();
  const index = value.lastIndexOf('.');
  if (index < 0) return '';
  return value.slice(index + 1);
};

const guessMimeTypeFromFileName = (fileName?: string) => {
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

const resolvePreviewMimeType = (rawMimeType: string, fileName?: string) => {
  const normalized = String(rawMimeType || '').split(';')[0].trim().toLowerCase();
  if (normalized && normalized !== 'application/octet-stream') return normalized;
  return guessMimeTypeFromFileName(fileName);
};

const canPreviewInViewer = (mimeType: string, fileName?: string) => {
  const extension = getExtension(fileName);
  if (mimeType.startsWith('image/')) return true;
  if (mimeType === 'application/pdf') return true;
  if (mimeType.startsWith('text/')) return true;
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'txt'].includes(extension);
};

const toAbsoluteDocumentUrl = (url?: string) => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) {
    const apiRoot = API_BASE.replace(/\/api$/, '');
    return `${apiRoot}${url}`;
  }
  return url;
};

const buildMaestroDetailUrl = (caseId?: string, folderKey?: string) => {
  if (!caseId) return '';
  const baseUrl = `${UIPATH_BASE_URL}/${encodeURIComponent(UIPATH_ORG_NAME)}/${encodeURIComponent(UIPATH_TENANT_NAME)}/maestro_/case-management/${encodeURIComponent(caseId)}/overview`;
  if (!folderKey) return baseUrl;
  return `${baseUrl}?folderKey=${encodeURIComponent(folderKey)}`;
};

const formatDate = (value?: string) => {
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

const formatAmount = (value?: string | number) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';
  return `${new Intl.NumberFormat('fr-FR').format(numericValue)} €`;
};

const translateStatus = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';

  const normalized = raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

const badgeClassForStatus = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('fault') || normalized.includes('error') || normalized.includes('fail')) {
    return 'bg-red-100 text-red-700';
  }
  if (normalized.includes('complete') || normalized.includes('cancel')) {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-cyan-100 text-cyan-700';
};

const badgeClassForSla = (slaStatus?: string) => {
  const normalized = String(slaStatus || '').toLowerCase();
  if (normalized.includes('risk') || normalized.includes('warning')) return 'bg-amber-100 text-amber-800';
  if (normalized.includes('breach') || normalized.includes('overdue') || normalized.includes('late')) return 'bg-red-100 text-red-700';
  if (normalized.includes('track') || normalized.includes('ok') || normalized.includes('green')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
};

const isCompletedTaskStatus = (status?: string, taskState?: string) => {
  const normalized = `${String(status || '')} ${String(taskState || '')}`.toLowerCase();
  return normalized.includes('complete') || normalized.includes('done') || normalized.includes('executed') || normalized.includes('closed') || normalized.includes('finish');
};

const isRunningTaskStatus = (status?: string, taskState?: string) => {
  const normalized = `${String(status || '')} ${String(taskState || '')}`.toLowerCase();
  return normalized.includes('running');
};

const isCurrentAppTaskStatus = (status?: string, taskState?: string) => {
  const normalized = `${String(status || '')} ${String(taskState || '')}`.toLowerCase();
  return normalized.includes('running')
    || normalized.includes('progress')
    || normalized.includes('active')
    || normalized.includes('open')
    || normalized.includes('assigned')
    || normalized.includes('unassigned')
    || normalized.includes('pending');
};

const isCompletedExecutionStatus = (status?: string) => String(status || '').toLowerCase().includes('complete');

const isDisplayableExecutionName = (name?: string) => {
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

const isAllowedChronologyElementType = (elementType?: string) => {
  const normalized = String(elementType || '').toLowerCase().trim();
  return normalized === 'startevent'
    || normalized === 'servicetask'
    || normalized === 'usertask'
    || normalized === 'subprocess';
};

const isAppTask = (type?: string) => {
  const normalized = String(type || '').toLowerCase();
  return normalized.includes('apptask') || normalized === 'apptask' || normalized.includes('app');
};

const isInProgressStageStatus = (status?: string) => {
  const normalized = String(status || '').toLowerCase().trim();
  if (!normalized) return false;
  if (normalized.includes('not started')) return false;
  return normalized.includes('inprogress') || normalized.includes('in progress') || normalized.includes('progress') || normalized.includes('active') || normalized.includes('running');
};

const toDateOrNull = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toTimestamp = (value?: string) => {
  const parsed = toDateOrNull(value);
  return parsed ? parsed.getTime() : 0;
};

const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Récupération des variables d'environnement pour le lien Admin
  const UIPATH_BASE_URL = import.meta.env.VITE_UIPATH_BASE_URL;
  const UIPATH_ORG_NAME = import.meta.env.VITE_UIPATH_ORG_NAME;
  const UIPATH_TENANT_NAME = import.meta.env.VITE_UIPATH_TENANT_NAME;
  const UIPATH_FOLDER_KEY = import.meta.env.VITE_UIPATH_FOLDER_KEY;
  const TARGET_CASE_MODEL_ID = import.meta.env.VITE_TARGET_CASE_MODEL_ID;
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [allCases, setAllCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState('document');
  const [viewerMimeType, setViewerMimeType] = useState('application/octet-stream');
  const [viewerBlob, setViewerBlob] = useState<Blob | null>(null);

  const openDocument = async (url: string, fileName: string, docId: string) => {
    const absoluteUrl = toAbsoluteDocumentUrl(url);
    if (!absoluteUrl || absoluteUrl === '#') return;
    setOpeningDocId(docId);
    try {
      const token = localStorage.getItem('uipath_access_token') || localStorage.getItem('auth_token') || '';
      const response = await fetch(absoluteUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const text = await response.text();
        alert(`Erreur ouverture document: ${text}`);
        return;
      }
      const blob = await response.blob();
      const previewMimeType = resolvePreviewMimeType(response.headers.get('content-type') || '', fileName);
      const previewBlob = new Blob([blob], { type: previewMimeType });
      const blobUrl = URL.createObjectURL(previewBlob);
      if (viewerBlobUrl) {
        URL.revokeObjectURL(viewerBlobUrl);
      }
      setViewerBlob(blob);
      setViewerBlobUrl(blobUrl);
      setViewerFileName(fileName || 'document');
      setViewerMimeType(previewMimeType);
      setViewerOpen(true);
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOpeningDocId(null);
    }
  };

  const closeViewer = () => {
    setViewerOpen(false);
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl);
    }
    setViewerBlobUrl(null);
    setViewerBlob(null);
  };

  const downloadFromViewer = () => {
    if (!viewerBlob) return;
    const url = URL.createObjectURL(viewerBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = viewerFileName || 'document';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const openMaestroDetail = () => {
    const maestroUrl = buildMaestroDetailUrl(detail?.id, detail?.folderKey);
    if (!maestroUrl) return;
    window.open(maestroUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [detailResponse, listResponse] = await Promise.all([
          casesService.getCaseById(id),
          casesService.getCases(),
        ]);

        if (isCancelled) return;
        setDetail(detailResponse);
        setAllCases(listResponse);
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : 'Erreur de chargement du dossier';
        setError(message);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (viewerBlobUrl) {
        URL.revokeObjectURL(viewerBlobUrl);
      }
    };
  }, [viewerBlobUrl]);

  const currentIndex = useMemo(() => allCases.findIndex((item) => item.id === id), [allCases, id]);
  const prevCaseId = currentIndex > 0 ? allCases[currentIndex - 1]?.id : null;
  const nextCaseId = currentIndex >= 0 && currentIndex < allCases.length - 1 ? allCases[currentIndex + 1]?.id : null;

  const flattenedTasks = useMemo(() => {
    const fromStages = (detail?.stages || []).flatMap((stage) =>
      (stage.tasks || []).map((task) => ({ ...task, stageName: task.stageName || stage.name, stageId: task.stageId || stage.id }))
    );
    const merged = [...(detail?.tasks || []), ...fromStages];
    const seen = new Set<string>();
    return merged.filter((task) => {
      const key = `${task.id || ''}:${task.name || ''}:${task.stageName || ''}:${task.dueDate || ''}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [detail]);

  const orderedStages = useMemo(() => {
    const currentStageLabel = String(detail?.currentStage || '').toLowerCase().trim();
    return (detail?.stages || []).map((stage) => {
      const stageName = String(stage.name || '').toLowerCase().trim();
      return {
        ...stage,
        isCurrent: Boolean(stage.isCurrent) || Boolean(currentStageLabel && stageName && currentStageLabel === stageName),
      };
    });
  }, [detail]);

  const primaryStages = useMemo(() => orderedStages.slice(0, 4), [orderedStages]);

  const inProgressSecondaryStages = useMemo(() => {
    return orderedStages
      .slice(4)
      .filter((stage) => isInProgressStageStatus(stage.status));
  }, [orderedStages]);

  const appTasks = useMemo(
    () => flattenedTasks.filter((task) => isAppTask(task.type)),
    [flattenedTasks],
  );

  const visibleAppTasks = useMemo(() => {
    return appTasks
      .filter((task) => isCompletedTaskStatus(task.status, task.taskState) || isCurrentAppTaskStatus(task.status, task.taskState))
      .sort((a, b) => {
      const right = toTimestamp(b.completedTime || b.startedTime || b.dueDate);
      const left = toTimestamp(a.completedTime || a.startedTime || a.dueDate);
      return right - left;
    });
  }, [appTasks]);

  const runningAppTask = useMemo(() => {
    return visibleAppTasks.find((task) => isRunningTaskStatus(task.status, task.taskState) && !isCompletedTaskStatus(task.status, task.taskState)) || null;
  }, [visibleAppTasks]);

  const completedAppTasks = useMemo(() => {
    return visibleAppTasks
      .filter((task) => isCompletedTaskStatus(task.status, task.taskState))
      .sort((a, b) => toTimestamp(b.completedTime || b.startedTime || b.dueDate) - toTimestamp(a.completedTime || a.startedTime || a.dueDate));
  }, [visibleAppTasks]);

  const chronologyEvents = useMemo(() => {
    const events: Array<{
      id: string;
      title: string;
      time?: string;
      status?: string;
      elementType?: string;
      details?: string;
      startedTime?: string;
      completedTime?: string;
      priority?: number;
      source?: 'current' | 'activity';
    }> = [];

    if (runningAppTask) {
      events.push({
        id: `current-${runningAppTask.id || 'task-activity'}`,
        title: runningAppTask.name || 'Activité en cours',
        time: runningAppTask.startedTime || runningAppTask.dueDate,
        status: runningAppTask.taskState || runningAppTask.status || 'Running',
        elementType: runningAppTask.type || 'AppTask',
        details: [
          runningAppTask.stageName ? `Étape: ${runningAppTask.stageName}` : '',
          runningAppTask.assignee ? `Assigné à ${runningAppTask.assignee}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        startedTime: runningAppTask.startedTime || runningAppTask.dueDate,
        priority: 1000,
        source: 'current',
      });
    }

    const rawExecutions = (detail?.executionHistory?.elementExecutions || []).map((item) => {
      const elementType = String((item as { elementType?: string; type?: string }).elementType || (item as { type?: string }).type || '');
      const elementName = String((item as { elementName?: string; name?: string }).elementName || (item as { name?: string }).name || '');
      const status = String((item as { status?: string; state?: string }).status || (item as { state?: string }).state || '');
      const startedTimeUtc = String((item as { startedTimeUtc?: string; startedTime?: string }).startedTimeUtc || (item as { startedTime?: string }).startedTime || '');
      const completedTimeUtc = String((item as { completedTimeUtc?: string; completedTime?: string }).completedTimeUtc || (item as { completedTime?: string }).completedTime || '');
      const elementId = String((item as { elementId?: string; id?: string }).elementId || (item as { id?: string }).id || '');
      return {
        elementType,
        elementName,
        status,
        startedTimeUtc,
        completedTimeUtc,
        elementId,
      };
    });

    const completedExecutions = rawExecutions
      .filter((item) => isCompletedExecutionStatus(item.status))
      .filter((item) => isAllowedChronologyElementType(item.elementType))
      .filter((item) => isDisplayableExecutionName(item.elementName))
      .sort((a, b) => {
        const right = toTimestamp(b.completedTimeUtc || b.startedTimeUtc);
        const left = toTimestamp(a.completedTimeUtc || a.startedTimeUtc);
        return right - left;
      });

    completedExecutions.forEach((item, index) => {
      const eventTime = item.completedTimeUtc || item.startedTimeUtc;
      if (!eventTime) return;
      const isStage = String(item.elementType || '').toLowerCase() === 'subprocess';
      events.push({
        id: `activity-${item.elementId || index}`,
        title: isStage ? `Etape ${item.elementName || 'Activité terminée'}` : (item.elementName || 'Activité terminée'),
        time: eventTime,
        status: item.status,
        elementType: item.elementType,
        details: '',
        startedTime: item.startedTimeUtc,
        completedTime: item.completedTimeUtc || eventTime,
        priority: 10,
        source: 'activity',
      });
    });

    if (!completedExecutions.length) {
      completedAppTasks.forEach((task, index) => {
        const eventTime = task.completedTime || task.startedTime || task.dueDate;
        if (!eventTime) return;
        events.push({
          id: `fallback-task-${task.id || index}`,
          title: task.name || 'Activité terminée',
          time: eventTime,
          status: task.taskState || task.status || 'Completed',
          elementType: task.type || 'AppTask',
          details: task.assignee ? `Assigné à ${task.assignee}` : '',
          startedTime: task.startedTime || eventTime,
          completedTime: task.completedTime || eventTime,
          priority: 10,
          source: 'activity',
        });
      });
    }

    const sorted = events
      .sort((a, b) => {
        const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        const right = b.time || b.completedTime || b.startedTime;
        const left = a.time || a.completedTime || a.startedTime;
        return toTimestamp(right) - toTimestamp(left);
      });

    const deduped: typeof sorted = [];
    const seen = new Set<string>();
    sorted.forEach((event) => {
      const key = String(event.id || '').toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(event);
    });

    return deduped;
  }, [detail, runningAppTask, completedAppTasks]);

  if (loading) {
    return (
      <div className="detail-page">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-700 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin" />
          Chargement du dossier...
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="detail-page">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700">{error || 'Dossier introuvable'}</div>
        <button
          onClick={() => navigate('/submissions')}
          className="w-fit px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className="detail-page">
      {/* Header nav: pleine largeur */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/submissions')}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Retour liste
          </button>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Détail dossier {detail.caseId || detail.id}
            <button
              type="button"
              title="Ouvrir la fiche Admin UiPath"
              className="ml-2 px-2 py-1 rounded-lg border border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-1 text-xs font-semibold"
              onClick={() => {
                const url = `${UIPATH_BASE_URL}/${UIPATH_ORG_NAME}/${UIPATH_TENANT_NAME}/maestro_/cases/${TARGET_CASE_MODEL_ID}/instances/${detail.id}?folderkey=${UIPATH_FOLDER_KEY}`;
                window.open(url, 'admin_popup', 'width=1200,height=900,noopener');
              }}
            >
              <Shield size={14} className="inline" />
              Admin
            </button>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openMaestroDetail}
            className="px-7 py-1.5 rounded-xl border border-teal-700 bg-teal-700 text-white hover:bg-teal-800 transition-colors flex items-center gap-2"
            style={{ paddingLeft: '26px', paddingRight: '26px' }}
          >
            <ExternalLink size={15} />
            Detail
          </button>
          <button
            onClick={() => prevCaseId && navigate(`/cases/${prevCaseId}`)}
            disabled={!prevCaseId}
            className="px-8 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ paddingLeft: '26px', paddingRight: '26px' }}
          >
            Précédent
          </button>
          <button
            onClick={() => nextCaseId && navigate(`/cases/${nextCaseId}`)}
            disabled={!nextCaseId}
            className="px-8 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ paddingLeft: '26px', paddingRight: '26px' }}
          >
            Suivant
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Layout deux colonnes: gauche = cartes, droite = chronologie */}
      <div className="flex gap-6 items-start">
        {/* Colonne gauche */}
        <div className="flex flex-col gap-6 flex-1 min-w-0">

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900 leading-tight">Informations générales</h2>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(detail.status)}`}>
            {translateStatus(detail.status)}
          </span>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForSla(detail.slaStatus)}`}>
            SLA: {translateStatus(detail.slaStatus || 'N/A')}
          </span>
        </div>

        <div className="compact-info-grid compact-info-content grid grid-cols-1 md:grid-cols-2 text-sm text-slate-700">
          <div><span className="font-semibold">ID instance:</span> {detail.id}</div>
          <div><span className="font-semibold">Case ID:</span> {detail.caseId || '-'}</div>
          <div><span className="font-semibold">Stage courant:</span> {translateStatus(detail.currentStage || '-')}</div>
          <div><span className="font-semibold">Créé le:</span> {formatDate(detail.createdTime || detail.startedTime)}</div>
        </div>
      </section>

      {!!orderedStages.length && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="overflow-x-auto">
            <div className="flex items-center gap-8 min-w-max pr-4">
            {primaryStages.map((stage, index) => {
              const normalizedStatus = String(stage.status || '').toLowerCase();
              const isDone = normalizedStatus.includes('complete');
              const isCurrent = Boolean(stage.isCurrent) || normalizedStatus.includes('progress') || normalizedStatus.includes('active') || normalizedStatus.includes('running');
              const dotClass = isDone
                ? 'bg-emerald-600 text-white'
                : isCurrent
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-300 text-slate-700';

              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${dotClass}`}>
                      {isDone ? '✓' : ''}
                    </span>
                    <div className="max-w-[90px]">
                      <p className="text-slate-900 font-semibold text-xs leading-tight">{stage.name || `Stage ${index + 1}`}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{translateStatus(stage.status || (isCurrent ? 'Active' : 'Pending'))}</p>
                    </div>
                  </div>
                  {index < primaryStages.length - 1 ? <span className="w-6 h-[2px] bg-slate-300 rounded" /> : null}
                </div>
              );
            })}
            </div>
          </div>

          {!!inProgressSecondaryStages.length && (
            <div className="mt-3 space-y-2">
              {inProgressSecondaryStages.map((stage) => (
                <div key={stage.id} className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-slate-900 font-semibold text-xs leading-tight">{stage.name || '-'}</p>
                    <p className="text-[11px] text-slate-500 leading-tight">{translateStatus(stage.status || 'InProgress')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="compact-info-title font-semibold text-slate-900">Client</h3>
          <div className="compact-info-grid grid grid-cols-1 md:grid-cols-2 text-sm text-slate-700">
            <div><span className="font-semibold">Nom:</span> {detail.client?.name || '-'}</div>
            <div><span className="font-semibold">Date naissance:</span> {detail.client?.birthDate || '-'}</div>
            <div><span className="font-semibold">Taux endettement:</span> {detail.client?.debtRatio || '-'}</div>
            <div><span className="font-semibold">Scoring:</span> {detail.client?.scoring || '-'}</div>
            <div><span className="font-semibold">Revenus:</span> {formatAmount(detail.client?.incomes)}</div>
            <div><span className="font-semibold">Charges:</span> {formatAmount(detail.client?.expenses)}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="compact-info-title font-semibold text-slate-900">Crédit</h3>
          <div className="compact-info-grid grid grid-cols-1 md:grid-cols-2 text-sm text-slate-700">
            <div><span className="font-semibold">Type:</span> {detail.credit?.creditType || '-'}</div>
            <div><span className="font-semibold">Montant:</span> {formatAmount(detail.credit?.requestedAmount)}</div>
            <div><span className="font-semibold">Durée:</span> {detail.credit?.duration || '-'} mois</div>
            <div><span className="font-semibold">Décision:</span> {detail.credit?.finalDecision || '-'}</div>
            <div><span className="font-semibold">Décaissement:</span> {detail.credit?.paymentDate || '-'}</div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        {!visibleAppTasks.length ? (
          <p className="text-slate-500 text-sm">Aucune activité disponible.</p>
        ) : (
          <div className="space-y-3">
            {visibleAppTasks.map((task, index) => {
              const isCompleted = isCompletedTaskStatus(task.status, task.taskState);
              const isRunning = isRunningTaskStatus(task.status, task.taskState) && !isCompleted;
              const isPending = isCurrentAppTaskStatus(task.status, task.taskState) && !isCompleted && !isRunning;
              const statusText = task.taskState || task.status || '-';
              const primaryDate = task.completedTime || task.startedTime || task.dueDate;
              const dateLabel = task.completedTime ? 'Terminé le' : task.startedTime ? 'Créé le' : 'Échéance';
              const cardClass = isRunning
                ? 'rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3'
                : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3';

              // Lien UiPath pour les tâches pending
              const uipathActionUrl = `${UIPATH_BASE_URL}/${UIPATH_ORG_NAME}/${UIPATH_TENANT_NAME}/actions_/`;

              return (
                <div key={`${task.id}-${task.stageName || ''}-${index}`} className={cardClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-xs uppercase tracking-wide font-semibold mb-1 ${isRunning ? 'text-cyan-700' : 'text-slate-500'}`}>
                        {index === 0 ? 'Tâches à effectuer' : 'App Task'}
                      </p>
                      {/* Affichage du nom de la tâche selon l'état */}
                      {isCompleted ? (
                        <span className="text-slate-500 line-through font-bold">{task.name || '-'}</span>
                      ) : isPending ? (
                        <a
                          href={uipathActionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-700 underline font-bold hover:text-cyan-900"
                        >
                          {task.name || '-'}
                        </a>
                      ) : isRunning ? (
                        <a
                          href={task.externalLink || uipathActionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-700 underline font-bold hover:text-cyan-900"
                        >
                          {task.name || '-'}
                          <svg xmlns="http://www.w3.org/2000/svg" className="inline ml-0.5" width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m3-3h5m0 0v5m0-5L10 14"/></svg>
                        </a>
                      ) : (
                        <span className="text-slate-900 font-bold">{task.name || '-'}</span>
                      )}
                      <div className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <User size={14} />
                          {task.assignee || 'Non assigné'}
                        </span>
                        <span>{dateLabel}: {formatDate(primaryDate)}</span>
                        {task.stageName ? <span>Stage: {task.stageName}</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`inline-flex px-2.5 py-1 rounded-full font-semibold ${badgeClassForStatus(statusText)}`}>
                        {translateStatus(statusText)}
                      </span>
                      <span className={`inline-flex px-2.5 py-1 rounded-full font-semibold ${badgeClassForSla(task.slaStatus || task.status)}`}>
                        SLA: {translateStatus(task.slaStatus || 'N/A')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Documents</h3>
        {!detail.documents?.length ? (
          <p className="text-slate-500 text-sm">Aucun document rattaché.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Nom</th>
                    <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {detail.documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 pr-4">{doc.fileType || '-'}</td>
                    <td className="py-3 pr-4">{doc.fileName || '-'}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => openDocument(doc.url || '', doc.fileName || 'document', doc.id)}
                        disabled={openingDocId === doc.id}
                        className="inline-flex items-center gap-2 text-cyan-700 hover:text-cyan-600 font-semibold disabled:opacity-50"
                      >
                        <FileText size={14} />
                        {openingDocId === doc.id ? 'Chargement...' : 'Ouvrir'}
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

        </div>{/* fin colonne gauche */}

        {/* Colonne droite : Chronologie */}
        <div className="w-80 xl:w-96 shrink-0 flex flex-col">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col flex-1">
        <h3 className="font-semibold text-slate-900 mb-4">Chronologie</h3>
        {!chronologyEvents.length ? (
          <p className="text-slate-500 text-sm">Aucun historique de tâche disponible.</p>
        ) : (
          <div className="space-y-0">
            {chronologyEvents.map((event, index) => {
              const compactStatus = String(event.status || '').trim();
              const compactType = String(event.elementType || '').trim().toLowerCase();
              const isStageEvent = compactType === 'subprocess';
              const isStartEvent = compactType === 'startevent';
              const isUserTaskEvent = compactType === 'usertask';
              const isCurrentEvent = String(event.id || '').startsWith('current-');
              const entryLabel = event.time ? formatDate(event.time) : '-';
              const isFirst = index === 0;
              const isLast = index === chronologyEvents.length - 1;

              const bulletClass = isCurrentEvent
                ? 'bg-cyan-600 rounded-full'
                : isStageEvent
                  ? 'bg-orange-500 rotate-45 rounded-[2px]'
                  : isStartEvent
                    ? 'bg-emerald-500 rounded-full'
                    : isUserTaskEvent
                      ? 'bg-violet-500 rounded-full'
                      : 'bg-slate-800 rounded-full';

              return (
                <div key={event.id} className="flex items-stretch gap-2 py-0.5">
                  <div className="relative w-3 shrink-0 flex justify-center pt-1">
                    {!isFirst || !isLast ? <span className="absolute top-0 bottom-0 w-[2px] bg-slate-300" /> : null}
                    <span className={`w-2.5 h-2.5 block z-10 ${bulletClass}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex flex-wrap items-center gap-1">
                        <p className="text-sm leading-tight font-semibold text-slate-800">{event.title}</p>
                        {isCurrentEvent ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-100 text-cyan-700">
                            En cours
                          </span>
                        ) : null}
                        {compactStatus ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeClassForStatus(compactStatus)}`}>
                            {translateStatus(compactStatus)}
                          </span>
                        ) : null}
                      </div>

                      <div className="text-right text-slate-500 text-xs leading-tight whitespace-nowrap pt-0.5">
                        {formatDate(event.time)}
                      </div>
                    </div>

                    {event.details ? <p className="text-slate-500 text-[11px] leading-tight mt-0.5">{event.details}</p> : null}
                    {event.time ? (
                      <p className="text-slate-500 text-[11px] leading-tight mt-0.5">
                        Entrée: {entryLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
        </div>{/* fin colonne droite */}
      </div>{/* fin layout deux colonnes */}

      <div className="text-sm text-slate-500">
        <Link to="/submissions" className="text-cyan-700 hover:text-cyan-600 font-semibold">
          Retourner à la liste des dossiers
        </Link>
      </div>

      {viewerOpen && viewerBlobUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-[88vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{viewerFileName}</p>
                <p className="text-xs text-slate-500 truncate">{viewerMimeType}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadFromViewer}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                >
                  <Download size={14} />
                  Télécharger
                </button>
                <button
                  onClick={closeViewer}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                >
                  <X size={14} />
                  Fermer
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100">
              {canPreviewInViewer(viewerMimeType, viewerFileName) ? (
                viewerMimeType.startsWith('image/') ? (
                  <div className="h-full w-full flex items-center justify-center bg-slate-900/5 p-4">
                    <img src={viewerBlobUrl} alt={viewerFileName} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : viewerMimeType === 'application/pdf' ? (
                  <object data={viewerBlobUrl} type="application/pdf" className="w-full h-full">
                    <iframe src={viewerBlobUrl} title={viewerFileName} className="w-full h-full border-0" />
                  </object>
                ) : (
                  <iframe
                    src={viewerBlobUrl}
                    title={viewerFileName}
                    className="w-full h-full border-0"
                  />
                )
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-600 p-6 text-center">
                  <p className="text-base font-semibold text-slate-800">Prévisualisation non disponible pour ce type de fichier.</p>
                  <p className="text-sm">Utilise le bouton Télécharger pour ouvrir ce document localement.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetailPage;
