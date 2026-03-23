import React from 'react';
import { badgeClassForStatus, translateStatus, formatDate } from '../../utils/caseFormatters';

export interface ChronologyEvent {
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
}

interface Props {
  events: ChronologyEvent[];
}

const CaseChronology: React.FC<Props> = ({ events }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col flex-1">
    <h3 className="font-semibold text-slate-900 mb-4">Chronologie</h3>
    {!events.length ? (
      <p className="text-slate-500 text-sm">Aucun historique de tâche disponible.</p>
    ) : (
      <div className="space-y-0">
        {events.map((event, index) => {
          const compactStatus = String(event.status || '').trim();
          const compactType = String(event.elementType || '').trim().toLowerCase();
          const isStageEvent = compactType === 'subprocess';
          const isStartEvent = compactType === 'startevent';
          const isUserTaskEvent = compactType === 'usertask';
          const isCurrentEvent = String(event.id || '').startsWith('current-');
          const entryLabel = event.time ? formatDate(event.time) : '-';
          const isFirst = index === 0;
          const isLast = index === events.length - 1;

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
                  <p className="text-slate-500 text-[11px] leading-tight mt-0.5">Entrée: {entryLabel}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </section>
);

export default CaseChronology;
