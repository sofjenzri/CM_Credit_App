import React from 'react';
import type { CaseStage } from '../../services/cases';
import { translateStatus } from '../../utils/caseFormatters';

interface Props {
  primaryStages: CaseStage[];
  inProgressSecondaryStages: CaseStage[];
}

const CaseStagesPipeline: React.FC<Props> = ({ primaryStages, inProgressSecondaryStages }) => (
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
);

export default CaseStagesPipeline;
