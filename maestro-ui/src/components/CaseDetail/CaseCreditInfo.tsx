import React from 'react';
import type { CaseDetail } from '../../services/cases';
import { formatAmount } from '../../utils/caseFormatters';

interface Props {
  credit?: CaseDetail['credit'];
}

const CaseCreditInfo: React.FC<Props> = ({ credit }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6">
    <h3 className="compact-info-title font-semibold text-slate-900">Crédit</h3>
    <div className="compact-info-grid grid grid-cols-1 md:grid-cols-2 text-sm text-slate-700">
      <div><span className="font-semibold">Type:</span> {credit?.creditType || '-'}</div>
      <div><span className="font-semibold">Montant:</span> {formatAmount(credit?.requestedAmount)}</div>
      <div><span className="font-semibold">Durée:</span> {credit?.duration || '-'} mois</div>
      <div><span className="font-semibold">Décision:</span> {credit?.finalDecision || '-'}</div>
      <div><span className="font-semibold">Décaissement:</span> {credit?.paymentDate || '-'}</div>
    </div>
  </section>
);

export default CaseCreditInfo;
