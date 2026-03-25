import React from 'react';
import { badgeClassForStatus, translateStatus, formatDate } from '../../utils/caseFormatters';
import { CheckCircle2 } from 'lucide-react';

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
      <div className="space-y-2">
        {events.map((event, index) => {
          const compactStatus = String(event.status || '').trim();
          const compactType = String(event.elementType || '').trim().toLowerCase();
          const isStageEvent = compactType === 'subprocess';
          const isStartEvent = compactType === 'startevent';
          const isUserTaskEvent = compactType === 'usertask';
          const isCurrentEvent = String(event.id || '').startsWith('current-');
          const isCompleted = compactStatus.toLowerCase().includes('complete') || compactStatus.toLowerCase().includes('termin');
          const isFirst = index === 0;
          const isLast = index === events.length - 1;

          // Bullet color logic
          let bulletClass = '';
          if (isCurrentEvent) {
            bulletClass = 'bg-emerald-500 rounded-full';
          } else if (isCompleted) {
            bulletClass = 'text-slate-400';
          } else if (isStageEvent) {
            bulletClass = 'bg-orange-500 rotate-45 rounded-[2px]';
          } else if (isStartEvent) {
            bulletClass = 'bg-emerald-500 rounded-full';
          } else if (isUserTaskEvent) {
            bulletClass = 'bg-violet-200 rounded-full';
          } else {
            bulletClass = 'bg-slate-800 rounded-full';
          }

          // Add horizontal separator before stage events (except first)
          const showStageSeparator = isStageEvent && index > 0;

          return (
            <React.Fragment key={event.id}>
              {showStageSeparator && (
                <div className="w-full border-t border-orange-300 my-2" />
              )}
              <div className="flex items-stretch gap-2 py-2">
                <div className="relative w-4 shrink-0 flex justify-center pt-1">
                  {/* Vertical line */}
                  {!isFirst || !isLast ? <span className="absolute top-0 bottom-0 w-[2px] bg-slate-300" /> : null}
                  {/* Bullet or check */}
                  {isCompleted && !isCurrentEvent ? (
                    <CheckCircle2 size={20} className={`z-10 bg-white rounded-full ${isStageEvent ? 'text-orange-500' : 'text-slate-400'}`} />
                  ) : (
                    <span className={`w-3 h-3 block z-10 ${bulletClass}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex flex-wrap items-center gap-1">
                      <p className={`text-sm leading-relaxed ${isStageEvent ? 'font-semibold' : 'font-normal'} text-slate-800`}>{event.title}</p>
                      {isCurrentEvent ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-100 text-cyan-700">
                          En cours
                        </span>
                      ) : null}
                      {/* Status badge, but hide if 'Terminé' or 'Completed' */}
                      {compactStatus && !isCompleted ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeClassForStatus(compactStatus)}`}>
                          {translateStatus(compactStatus)}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right text-slate-500 text-xs leading-tight whitespace-nowrap pt-0.5">
                      {formatDate(event.time)}
                    </div>
                  </div>
                  {event.details ? <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">{event.details}</p> : null}
                  {/* Espace réservé à la place de la date d'entrée */}
                  <div className="mt-1 mb-1 h-4" />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    )}
  </section>
);

export default CaseChronology;
