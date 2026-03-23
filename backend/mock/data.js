export const cases = [
  {
    id: 'd9470e73-341f-4593-a231-b00ebff27125',
    processKey: 'CM_Credit_Case',
    status: 'Running',
    client: { clientId: 'CL-0001', name: 'Jean Dupont', birthDate: '1988-04-12', scoring: 74, debtRatio: '31%', incomes: 4200, expenses: 1300 },
    credit: { creditType: 'Immobilier', requestedAmount: 185000, duration: 240, finalDecision: 'En étude', paymentDate: '2026-03-20' },
    documents: [{ id: 'doc-1', fileType: 'PDF', fileName: 'Justificatif_Revenus.pdf', url: 'https://example.org/docs/justificatif-revenus.pdf' }],
  },
  {
    id: '45fd966b-f123-4b27-b18f-a02eb6a1a344',
    processKey: 'CM_Credit_Case',
    status: 'Completed',
    client: { clientId: 'CL-0002', name: 'Sophie Martin', birthDate: '1991-11-02', scoring: 81, debtRatio: '24%', incomes: 5100, expenses: 1500 },
    credit: { creditType: 'Consommation', requestedAmount: 22000, duration: 60, finalDecision: 'Accepté', paymentDate: '2026-02-05' },
    documents: [{ id: 'doc-2', fileType: 'PDF', fileName: 'Piece_Identite.pdf', url: 'https://example.org/docs/piece-identite.pdf' }],
  },
  {
    id: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
    processKey: 'CM_Credit_Case',
    status: 'Error',
    client: { clientId: 'CL-0003', name: 'Marc Blanc', birthDate: '1985-07-15', scoring: 45, debtRatio: '68%', incomes: 2800, expenses: 1900 },
    credit: { creditType: 'Auto', requestedAmount: 35000, duration: 84, finalDecision: 'Rejeté', paymentDate: null },
    documents: [],
  },
];

export const getMockList = () => cases.map((item) => ({
  id: item.id,
  caseId: `CRD-${String(item.id).substring(0, 8).toUpperCase()}`,
  processKey: item.processKey,
  status: item.status,
  dossierStatus: item.status,
  currentStage: 'Mock Stage',
  clientName: item.client.name,
  creditType: item.credit.creditType,
  requestedAmount: item.credit.requestedAmount,
  createdTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  slaStatus: 'OK',
}));
