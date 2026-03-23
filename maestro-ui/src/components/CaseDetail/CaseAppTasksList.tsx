import React from 'react';
import { User } from 'lucide-react';
import type { CaseTask } from '../../services/cases';
import {
  isCompletedTaskStatus,
  isRunningTaskStatus,
  isCurrentAppTaskStatus,
  formatDate,
  translateStatus,
  badgeClassForStatus,
  badgeClassForSla,
} from '../../utils/caseFormatters';

interface Props {
  tasks: CaseTask[];
}

const UIPATH_BASE_URL = import.meta.env.VITE_UIPATH_BASE_URL || 'https://staging.uipath.com';
const UIPATH_ORG_NAME = import.meta.env.VITE_UIPATH_ORG_NAME || 'france';
const UIPATH_TENANT_NAME = import.meta.env.VITE_UIPATH_TENANT_NAME || 'DefaultTenant';

const CaseAppTasksList: React.FC<Props> = ({ tasks }) => {
  const uipathActionUrl = `${UIPATH_BASE_URL}/${UIPATH_ORG_NAME}/${UIPATH_TENANT_NAME}/actions_/`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      {!tasks.length ? (
        <p className="text-slate-500 text-sm">Aucune activité disponible.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const isCompleted = isCompletedTaskStatus(task.status, task.taskState);
            const isRunning = isRunningTaskStatus(task.status, task.taskState) && !isCompleted;
            const isPending = isCurrentAppTaskStatus(task.status, task.taskState) && !isCompleted && !isRunning;
            const statusText = task.taskState || task.status || '-';
            const primaryDate = task.completedTime || task.startedTime || task.dueDate;
            const dateLabel = task.completedTime ? 'Terminé le' : task.startedTime ? 'Créé le' : 'Échéance';
            const cardClass = isRunning
              ? 'rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3'
              : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3';

            return (
              <div key={`${task.id}-${task.stageName || ''}-${index}`} className={cardClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-xs uppercase tracking-wide font-semibold mb-1 ${isRunning ? 'text-cyan-700' : 'text-slate-500'}`}>
                      {index === 0 ? 'Tâches à effectuer' : 'App Task'}
                    </p>
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
  );
};

export default CaseAppTasksList;
