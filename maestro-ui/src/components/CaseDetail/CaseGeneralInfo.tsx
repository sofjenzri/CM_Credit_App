import React from 'react';
import type { CaseDetail } from '../../services/cases';
import { badgeClassForStatus, badgeClassForSla, translateStatus, formatDate } from '../../utils/caseFormatters';

interface Props {
  detail: CaseDetail;
}

const CaseGeneralInfo: React.FC<Props> = ({ detail }) => (
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
);

export default CaseGeneralInfo;
