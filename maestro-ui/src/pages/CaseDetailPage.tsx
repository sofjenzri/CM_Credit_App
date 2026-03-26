import React, { useMemo, useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCaseDetail } from '../hooks/useCaseDetail';
import { useDocumentViewer } from '../hooks/useDocumentViewer';
import {
  isInProgressStageStatus,
  isAppTask,
  isCompletedTaskStatus,
  isCurrentAppTaskStatus,
  isCompletedExecutionStatus,
  isAllowedChronologyElementType,
  isDisplayableExecutionName,
  toTimestamp,
} from '../utils/caseFormatters';
import CaseDetailHeader from '../components/CaseDetail/CaseDetailHeader';
import CaseStagesPipeline from '../components/CaseDetail/CaseStagesPipeline';
import CaseClientInfo from '../components/CaseDetail/CaseClientInfo';
import CaseCreditInfo from '../components/CaseDetail/CaseCreditInfo';
import CaseAppTasksList from '../components/CaseDetail/CaseAppTasksList';
import CaseDocumentsTable from '../components/CaseDetail/CaseDocumentsTable';
import CaseChronology, { type ChronologyEvent } from '../components/CaseDetail/CaseChronology';
import DocumentViewer from '../components/CaseDetail/DocumentViewer';

const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const { detail, loading, refreshing, error } = useCaseDetail(id ? `${id}` : undefined, refreshKey);
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshKey((k) => k + 1);
  }, [refreshing]);
  const { openingDocId, viewerOpen, viewerBlobUrl, viewerFileName, viewerMimeType, openDocument, closeViewer, downloadFromViewer } = useDocumentViewer();

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

  const inProgressSecondaryStages = useMemo(
    () => orderedStages.slice(4).filter((stage) => isInProgressStageStatus(stage.status)),
    [orderedStages],
  );

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

  const currentAppTask = useMemo(
    () => visibleAppTasks.find((task) => isCurrentAppTaskStatus(task.status, task.taskState) && !isCompletedTaskStatus(task.status, task.taskState)) ?? null,
    [visibleAppTasks],
  );

  const completedAppTasks = useMemo(
    () => visibleAppTasks
      .filter((task) => isCompletedTaskStatus(task.status, task.taskState))
      .sort((a, b) => toTimestamp(b.completedTime || b.startedTime || b.dueDate) - toTimestamp(a.completedTime || a.startedTime || a.dueDate)),
    [visibleAppTasks],
  );

  const chronologyEvents = useMemo((): ChronologyEvent[] => {
    const events: ChronologyEvent[] = [];

    if (currentAppTask) {
      events.push({
        id: `current-${currentAppTask.id || 'task-activity'}`,
        title: currentAppTask.name || 'Activité en cours',
        time: currentAppTask.startedTime || currentAppTask.dueDate,
        status: currentAppTask.taskState || currentAppTask.status || 'Running',
        elementType: currentAppTask.type || 'AppTask',
        details: [
          currentAppTask.stageName ? `Étape: ${currentAppTask.stageName}` : '',
          currentAppTask.assignee ? `Assigné à ${currentAppTask.assignee}` : '',
        ].filter(Boolean).join(' • '),
        startedTime: currentAppTask.startedTime || currentAppTask.dueDate,
        priority: 1000,
        source: 'current',
      });
    }

    const rawExecutions = (detail?.executionHistory?.elementExecutions || []).map((item, rawIndex) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = item as any;
      return {
        rawIndex,
        elementType: String(i.elementType || i.type || ''),
        elementName: String(i.elementName || i.name || ''),
        status: String(i.status || i.state || ''),
        startedTimeUtc: String(i.startedTimeUtc || i.startedTime || ''),
        completedTimeUtc: String(i.completedTimeUtc || i.completedTime || ''),
        elementId: String(i.elementId || i.id || ''),
        externalLink: String(i.externalLink || ''),
      };
    });

    const bpmStartLinkByRawIndex = new Map<number, string>();
    let lastBpmProcessLink = '';
    rawExecutions.forEach((execution) => {
      const candidateLink = String(execution.externalLink || '').trim();
      if (candidateLink.includes('/maestro_/processes/')) {
        lastBpmProcessLink = candidateLink;
      }
      if (execution.elementName.trim().toLowerCase() === 'début du processus' && lastBpmProcessLink) {
        bpmStartLinkByRawIndex.set(execution.rawIndex, lastBpmProcessLink);
      }
    });

    const completedExecutions = rawExecutions
      .filter((item) => isCompletedExecutionStatus(item.status))
      .filter((item) => isAllowedChronologyElementType(item.elementType))
      .filter((item) => isDisplayableExecutionName(item.elementName))
      .sort((a, b) => toTimestamp(b.completedTimeUtc || b.startedTimeUtc) - toTimestamp(a.completedTimeUtc || a.startedTimeUtc));

    completedExecutions.forEach((item, index) => {
      const eventTime = item.completedTimeUtc || item.startedTimeUtc;
      if (!eventTime) return;
      const isStage = item.elementType.toLowerCase() === 'subprocess';
      const isBpmStartEvent = item.elementName.trim().toLowerCase() === 'début du processus';
      events.push({
        id: `activity-${item.elementId || index}`,
        title: isStage ? `Etape ${item.elementName || 'Activité terminée'}` : (item.elementName || 'Activité terminée'),
        time: eventTime,
        status: item.status,
        elementType: item.elementType,
        linkUrl: isBpmStartEvent ? (bpmStartLinkByRawIndex.get(item.rawIndex) || '') : '',
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

    const sorted = events.sort((a, b) => {
      const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return toTimestamp(b.time || b.completedTime || b.startedTime) - toTimestamp(a.time || a.completedTime || a.startedTime);
    });

    const deduped: ChronologyEvent[] = [];
    const seen = new Set<string>();
    sorted.forEach((event) => {
      const key = String(event.id || '').toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(event);
    });

    return deduped;
  }, [detail, currentAppTask, completedAppTasks]);

  if (loading && !detail) {
    return (
      <div className="detail-page">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-700 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin" />
          Chargement du dossier...
        </div>
      </div>
    );
  }

  if (!detail) {
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
      {error && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <CaseDetailHeader detail={detail} />
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-1.5 text-slate-700 shadow-sm hover:bg-slate-100"
          style={{ paddingLeft: '16px', paddingRight: '16px' }}
          title="Rafraîchir les données du dossier"
        >
          <Loader2 size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualisation...' : 'Rafraîchir'}
        </button>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          {!!orderedStages.length && (
            <CaseStagesPipeline primaryStages={primaryStages} inProgressSecondaryStages={inProgressSecondaryStages} />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <CaseClientInfo client={detail.client} />
            <CaseCreditInfo credit={detail.credit} />
          </div>
          <CaseAppTasksList caseId={detail.id} tasks={visibleAppTasks} />
          <CaseDocumentsTable documents={detail.documents} onOpenDocument={openDocument} openingDocId={openingDocId} />
        </div>

        <div className="w-80 xl:w-96 shrink-0 flex flex-col">
          <CaseChronology events={chronologyEvents} />
        </div>
      </div>

      <div className="text-sm text-slate-500">
        <Link to="/submissions" className="text-cyan-700 hover:text-cyan-600 font-semibold">
          Retourner à la liste des dossiers
        </Link>
      </div>

      <DocumentViewer
        isOpen={viewerOpen}
        blobUrl={viewerBlobUrl}
        fileName={viewerFileName}
        mimeType={viewerMimeType}
        onClose={closeViewer}
        onDownload={downloadFromViewer}
      />
    </div>
  );
};

export default CaseDetailPage;
