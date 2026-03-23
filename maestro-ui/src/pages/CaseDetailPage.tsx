import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCaseDetail } from '../hooks/useCaseDetail';
import { useDocumentViewer } from '../hooks/useDocumentViewer';
import {
  isInProgressStageStatus,
  isAppTask,
  isCompletedTaskStatus,
  isRunningTaskStatus,
  isCurrentAppTaskStatus,
  isCompletedExecutionStatus,
  isAllowedChronologyElementType,
  isDisplayableExecutionName,
  toTimestamp,
  buildMaestroDetailUrl,
} from '../utils/caseFormatters';
import CaseDetailHeader from '../components/CaseDetail/CaseDetailHeader';
import CaseGeneralInfo from '../components/CaseDetail/CaseGeneralInfo';
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

  const { detail, allCases, loading, error } = useCaseDetail(id);
  const { openingDocId, viewerOpen, viewerBlobUrl, viewerFileName, viewerMimeType, openDocument, closeViewer, downloadFromViewer } = useDocumentViewer();

  const currentIndex = useMemo(() => allCases.findIndex((item) => item.id === id), [allCases, id]);
  const prevCaseId = currentIndex > 0 ? allCases[currentIndex - 1]?.id : undefined;
  const nextCaseId = currentIndex >= 0 && currentIndex < allCases.length - 1 ? allCases[currentIndex + 1]?.id : undefined;

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

  const runningAppTask = useMemo(
    () => visibleAppTasks.find((task) => isRunningTaskStatus(task.status, task.taskState) && !isCompletedTaskStatus(task.status, task.taskState)) ?? null,
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
        ].filter(Boolean).join(' • '),
        startedTime: runningAppTask.startedTime || runningAppTask.dueDate,
        priority: 1000,
        source: 'current',
      });
    }

    const rawExecutions = (detail?.executionHistory?.elementExecutions || []).map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = item as any;
      return {
        elementType: String(i.elementType || i.type || ''),
        elementName: String(i.elementName || i.name || ''),
        status: String(i.status || i.state || ''),
        startedTimeUtc: String(i.startedTimeUtc || i.startedTime || ''),
        completedTimeUtc: String(i.completedTimeUtc || i.completedTime || ''),
        elementId: String(i.elementId || i.id || ''),
      };
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
      events.push({
        id: `activity-${item.elementId || index}`,
        title: isStage ? `Etape ${item.elementName || 'Activité terminée'}` : (item.elementName || 'Activité terminée'),
        time: eventTime,
        status: item.status,
        elementType: item.elementType,
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
  }, [detail, runningAppTask, completedAppTasks]);

  const openMaestroDetail = () => {
    const maestroUrl = buildMaestroDetailUrl(detail?.id, detail?.folderKey);
    if (!maestroUrl) return;
    window.open(maestroUrl, '_blank', 'noopener,noreferrer');
  };

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
      <CaseDetailHeader
        detail={detail}
        prevCaseId={prevCaseId}
        nextCaseId={nextCaseId}
        onOpenMaestroDetail={openMaestroDetail}
      />

      <div className="flex gap-6 items-start">
        <div className="flex flex-col gap-6 flex-1 min-w-0">
          <CaseGeneralInfo detail={detail} />
          {!!orderedStages.length && (
            <CaseStagesPipeline primaryStages={primaryStages} inProgressSecondaryStages={inProgressSecondaryStages} />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <CaseClientInfo client={detail.client} />
            <CaseCreditInfo credit={detail.credit} />
          </div>
          <CaseAppTasksList tasks={visibleAppTasks} />
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
