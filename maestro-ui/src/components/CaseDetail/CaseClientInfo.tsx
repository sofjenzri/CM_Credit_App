import React from 'react';
import type { CaseDetail } from '../../services/cases';
import { formatAmount } from '../../utils/caseFormatters';

interface Props {
  client?: CaseDetail['client'];
}

const CaseClientInfo: React.FC<Props> = ({ client }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6">
    <h3 className="compact-info-title font-semibold text-slate-900">Client</h3>
    <div className="compact-info-grid grid grid-cols-1 md:grid-cols-2 text-sm text-slate-700">
      <div><span className="font-semibold">Nom:</span> {client?.name || '-'}</div>
      <div><span className="font-semibold">Date naissance:</span> {client?.birthDate || '-'}</div>
      <div><span className="font-semibold">Taux endettement:</span> {client?.debtRatio || '-'}</div>
      <div><span className="font-semibold">Scoring:</span> {client?.scoring || '-'}</div>
      <div><span className="font-semibold">Revenus:</span> {formatAmount(client?.incomes)}</div>
      <div><span className="font-semibold">Charges:</span> {formatAmount(client?.expenses)}</div>
    </div>
  </section>
);

export default CaseClientInfo;
