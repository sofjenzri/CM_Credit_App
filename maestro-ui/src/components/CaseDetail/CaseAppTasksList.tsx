import React from 'react';
import { Clock3, ExternalLink, User } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  caseId: string;
  tasks: CaseTask[];
}

const CaseAppTasksList: React.FC<Props> = ({ caseId, tasks }) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-semibold text-slate-900 mb-4">Tâches à effectuer</h3>
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
              ? 'rounded-xl border border-cyan-200 bg-cyan-50/70 p-4'
              : 'rounded-xl border border-slate-200 bg-slate-50/70 p-4';

            return (
              <div key={`${task.id}-${task.stageName || ''}-${index}`} className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs uppercase tracking-wide font-semibold mb-1 ${isRunning ? 'text-cyan-700' : 'text-slate-500'}`}>
                      {index === 0 ? 'Priorité courante' : `Tâche ${index + 1}`}
                    </p>
                    {isCompleted ? (
                      <span className="text-slate-500 line-through text-sm font-semibold">{task.name || '-'}</span>
                    ) : isPending ? (
                      <Link
                        to={`/cases/${caseId}/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 text-cyan-700 text-sm font-semibold underline hover:text-cyan-900"
                      >
                        {task.name || '-'}
                        <ExternalLink size={14} />
                      </Link>
                    ) : isRunning ? (
                      <Link
                        to={`/cases/${caseId}/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 text-cyan-700 text-sm font-semibold underline hover:text-cyan-900"
                      >
                        {task.name || '-'}
                        <ExternalLink size={14} />
                      </Link>
                    ) : (
                      <span className="text-slate-900 text-sm font-semibold">{task.name || '-'}</span>
                    )}
                    <div className="mt-2 text-sm text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="inline-flex items-center gap-1.5">
                        <User size={14} />
                        {task.assignee || 'Non assigné'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={14} />
                        {dateLabel}: {formatDate(primaryDate)}
                      </span>
                      {task.stageName ? <span>Étape: {task.stageName}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
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
