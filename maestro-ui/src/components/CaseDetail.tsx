import React, { useMemo } from 'react';

interface CaseInstanceRow {
  instanceId: string;
  processKey: string;
  status: string;
  startedTime?: string;
  completedTime?: string;
  caseTitle?: string;
  instanceDisplayName?: string;
  folderKey?: string;
  startedByUser?: string;
}

type DataFabricRecord = Record<string, unknown>;

interface CaseDetailProps {
  instance: CaseInstanceRow;
  matchedCaseId?: string;
  mainCaseRecord?: DataFabricRecord;
  documentRecords: DataFabricRecord[];
  matchCandidates?: string[];
  mainCaseRecordCaseId?: string;
  mainCaseEntityId?: string;
  documentCaseIds?: string[];
  onOpenDocument?: (record: DataFabricRecord) => Promise<{ url: string; fileName: string; revokeOnClose: boolean }>;
  onBack: () => void;
}

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const formatRecordValue = (key: string, value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const normalizedKey = key.toLowerCase();
  const dateLikeKey = normalizedKey.includes('date') || normalizedKey.includes('time') || normalizedKey.includes('updated') || normalizedKey.includes('created');
  const looksLikeIsoDate = /^\d{4}-\d{2}-\d{2}[t\s]/i.test(raw);

  if (dateLikeKey || looksLikeIsoDate) {
    const formatted = formatDateTime(raw);
    return formatted === '-' ? raw : formatted;
  }

  return raw;
};

const normalizeFieldToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const findRecordValueByKey = (record: DataFabricRecord, key: string, aliases: string[] = []) => {
  const expectedKeys = [key, ...aliases].map(normalizeFieldToken);
  const actualEntry = Object.entries(record).find(([actualKey]) => expectedKeys.includes(normalizeFieldToken(actualKey)));
  if (!actualEntry) return '-';
  return formatRecordValue(actualEntry[0], actualEntry[1]);
};

const formatDuration = (started?: string, completed?: string) => {
  if (!started) return '-';
  const start = new Date(started).getTime();
  const end = completed ? new Date(completed).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '-';

  const totalSeconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

const statusColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('run')) return { bg: '#dcfce7', fg: '#166534' };
  if (normalized.includes('complete')) return { bg: '#dbeafe', fg: '#1e40af' };
  if (normalized.includes('pause')) return { bg: '#fef3c7', fg: '#92400e' };
  if (normalized.includes('fault') || normalized.includes('fail')) return { bg: '#fee2e2', fg: '#991b1b' };
  if (normalized.includes('cancel')) return { bg: '#f3f4f6', fg: '#374151' };
  return { bg: '#e5e7eb', fg: '#111827' };
};

const extractDocumentFileName = (doc: DataFabricRecord): string => {
  const possibleFields = ['FileName', 'fileName', 'file_name', 'DocumentName', 'documentName', 'name', 'Name', 'Nom', 'nom'];
  for (const field of possibleFields) {
    if (field in doc && doc[field]) {
      const value = String(doc[field]).trim();
      if (value) return value;
    }
  }
  return 'Document sans nom';
};

const extractDocumentFileType = (doc: DataFabricRecord): string => {
  const possibleFields = ['FileType', 'fileType', 'file_type', 'DocumentType', 'documentType', 'type', 'Type', 'TypeDocument', 'document_type'];
  for (const field of possibleFields) {
    if (field in doc && doc[field]) {
      const value = String(doc[field]).trim();
      if (value) return value;
    }
  }
  return 'Non spécifié';
};

const CaseDetail: React.FC<CaseDetailProps> = ({
  instance,
  matchedCaseId,
  mainCaseRecord,
  documentRecords,
  matchCandidates,
  mainCaseRecordCaseId,
  mainCaseEntityId,
  documentCaseIds,
  onOpenDocument,
  onBack,
}) => {
  const openDocumentInTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const mainCaseData = useMemo(() => {
    if (!mainCaseRecord) {
      return {
        caseStatus: '-',
        clientId: '-',
        name: '-',
        birthDate: '-',
        scoring: '-',
        debtRatio: '-',
        incomes: '-',
        expenses: '-',
        creditType: '-',
        requestedAmount: '-',
        duration: '-',
        finalDecision: '-',
        paymentDate: '-',
      };
    }

    return {
      caseStatus: findRecordValueByKey(mainCaseRecord, 'CaseStatus'),
      clientId: findRecordValueByKey(mainCaseRecord, 'ClientID', ['ClientId', 'Client_ID']),
      name: findRecordValueByKey(mainCaseRecord, 'Name'),
      birthDate: findRecordValueByKey(mainCaseRecord, 'BirthDate'),
      scoring: findRecordValueByKey(mainCaseRecord, 'Scoring'),
      debtRatio: findRecordValueByKey(mainCaseRecord, 'DebtRatio'),
      incomes: findRecordValueByKey(mainCaseRecord, 'Incomes'),
      expenses: findRecordValueByKey(mainCaseRecord, 'Expenses'),
      creditType: findRecordValueByKey(mainCaseRecord, 'CreditType'),
      requestedAmount: findRecordValueByKey(mainCaseRecord, 'RequestedAmount'),
      duration: findRecordValueByKey(mainCaseRecord, 'Duration'),
      finalDecision: findRecordValueByKey(mainCaseRecord, 'FinalDecision'),
      paymentDate: findRecordValueByKey(mainCaseRecord, 'PaymentDate'),
    };
  }, [mainCaseRecord]);

  const statusColorData = statusColor(instance.status || 'Unknown');

  return (
    <div style={{ padding: '0' }}>
      {/* En-tête avec bouton retour */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '1rem' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563eb',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 500,
            padding: '0.5rem 0',
            textDecoration: 'underline',
          }}
        >
          ← Retour à la liste
        </button>
      </div>

      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
            {instance.caseTitle || instance.instanceDisplayName || 'Dossier crédit'}
          </h1>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '999px',
                padding: '0.2rem 0.55rem',
                fontSize: '0.78rem',
                color: '#334155',
                background: '#f8fafc',
                cursor: 'help',
              }}
              title='Debug corrélation'
              className='debug-trigger'
            >
              debug
            </div>
            <div
              className='debug-popup'
              style={{
                position: 'absolute',
                top: '2rem',
                right: 0,
                width: '600px',
                maxWidth: '95vw',
                maxHeight: '80vh',
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '0.6rem',
                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                padding: '0.75rem 0.85rem',
                fontSize: '0.75rem',
                color: '#334155',
                zIndex: 20,
                display: 'none',
                overflowY: 'auto',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Debug corrélation</div>
              <div>Case_ID corrélé: <span style={{ fontFamily: 'monospace' }}>{matchedCaseId || '-'}</span></div>
              <div>Case_ID MainCase: <span style={{ fontFamily: 'monospace' }}>{mainCaseRecordCaseId || '-'}</span></div>
              <div>ID record MainCase: <span style={{ fontFamily: 'monospace' }}>{mainCaseEntityId || '-'}</span></div>
              <div>Case_ID Documents: <span style={{ fontFamily: 'monospace' }}>{(documentCaseIds || []).join(' | ') || '-'}</span></div>
              <div style={{ marginTop: '0.25rem' }}>Tokens: <span style={{ fontFamily: 'monospace' }}>{(matchCandidates || []).slice(0, 5).join(' | ') || '-'}</span></div>
              
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>MainCase Record:</div>
                {mainCaseRecord ? (
                  <div style={{ fontSize: '0.7rem', background: '#f9fafb', padding: '0.4rem', borderRadius: '0.3rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {Object.entries(mainCaseRecord)
                      .filter(([, val]) => val !== null && val !== undefined)
                      .map(([key, val]) => (
                        <div key={key} style={{ marginBottom: '0.2rem', wordBreak: 'break-word' }}>
                          <strong>{key}:</strong> {String(val).substring(0, 100)}{String(val).length > 100 ? '...' : ''}
                        </div>
                      ))}
                  </div>
                ) : (
                  <span style={{ color: '#9ca3af' }}>❌ Aucun MainCase trouvé</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>
          ID: <span style={{ fontFamily: 'monospace', color: '#374151' }}>{instance.instanceId}</span>
        </p>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '-1.3rem', marginBottom: '2rem' }}>
          Case_ID corrélé: <span style={{ fontFamily: 'monospace', color: '#374151' }}>{matchedCaseId || '-'}</span>
        </p>
        <style>{`
          .debug-trigger:hover + .debug-popup,
          .debug-popup:hover {
            display: block !important;
          }
        `}</style>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
              Processus
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.9rem 1.1rem' }}>
              <ProcessItem label="État" value={instance.status || 'Unknown'} color={statusColorData} />
              <ProcessItem label="Statut dossier" value={mainCaseData.caseStatus} />
              <ProcessItem label="Processus" value={instance.processKey || '-'} />
              <ProcessItem label="Conseiller" value={instance.startedByUser || '-'} />
              <ProcessItem label="Démarré le" value={formatDateTime(instance.startedTime)} />
              <ProcessItem label="Durée" value={formatDuration(instance.startedTime, instance.completedTime)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
              Client
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <InfoRow label="Code Client" value={mainCaseData.clientId} />
              <InfoRow label="Nom" value={mainCaseData.name} />
              <InfoRow label="Date Naissance" value={mainCaseData.birthDate} />
              <InfoRow label="Score risque" value={mainCaseData.scoring} />
              <InfoRow label="Taux endettement" value={mainCaseData.debtRatio} />
              <InfoRow label="Revenus" value={mainCaseData.incomes} />
              <InfoRow label="Charges" value={mainCaseData.expenses} />
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
              Information crédit
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <InfoRow label="Type Crédit" value={mainCaseData.creditType} />
              <InfoRow label="Montant" value={mainCaseData.requestedAmount} />
              <InfoRow label="Durée (Mois)" value={mainCaseData.duration} />
              <InfoRow label="Décision finale" value={mainCaseData.finalDecision} />
              <InfoRow label="Date de decaissement" value={mainCaseData.paymentDate} />
            </div>
          </div>
        </div>

        {/* Section Documents */}
        <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
            Documents du dossier (CM_Credit_CaseDocuments) ({documentRecords.length})
          </h2>

          {documentRecords.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Aucun document associé à ce dossier.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontSize: '0.78rem', textTransform: 'uppercase' }}>FileType</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontSize: '0.78rem', textTransform: 'uppercase' }}>FileName</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem', color: '#6b7280', fontSize: '0.78rem', textTransform: 'uppercase' }}>Fichier</th>
                  </tr>
                </thead>
                <tbody>
                  {documentRecords.map((doc, index) => (
                    <DocumentRow
                      key={index}
                      document={doc}
                      onOpenDocument={onOpenDocument}
                      onOpenInTab={openDocumentInTab}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string; color?: { bg: string; fg: string } }> = ({
  label,
  value,
  color,
}) => (
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.9rem' }}>
    <span style={{ fontWeight: 600, color: '#6b7280', minWidth: '120px' }}>{label}:</span>
    {color ? (
      <span style={{ background: color.bg, color: color.fg, borderRadius: '999px', padding: '0.25rem 0.55rem', fontSize: '0.85rem', fontWeight: 700 }}>
        {value}
      </span>
    ) : (
      <span style={{ color: '#374151' }}>{value}</span>
    )}
  </div>
);

const ProcessItem: React.FC<{ label: string; value: string; color?: { bg: string; fg: string } }> = ({ label, value, color }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.2rem', textTransform: 'uppercase' }}>{label}</div>
    {color ? (
      <span style={{ background: color.bg, color: color.fg, borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '0.82rem', fontWeight: 700 }}>
        {value}
      </span>
    ) : (
      <div style={{ color: '#111827', fontSize: '0.92rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    )}
  </div>
);

const DocumentRow: React.FC<{
  document: DataFabricRecord;
  onOpenDocument?: (record: DataFabricRecord) => Promise<{ url: string; fileName: string; revokeOnClose: boolean }>;
  onOpenInTab: (url: string) => void;
}> = ({ document, onOpenDocument, onOpenInTab }) => {
  const fileName = extractDocumentFileName(document);
  const fileType = extractDocumentFileType(document);

  const handleOpenInTab = async () => {
    try {
      if (!onOpenDocument) throw new Error('Ouverture indisponible');
      const opened = await onOpenDocument(document);
      onOpenInTab(opened.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(`Échec de l'ouverture: ${message}`);
    }
  };

  return (
    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
      <td style={{ padding: '0.75rem', color: '#111827', fontWeight: 600 }}>{fileType}</td>
      <td style={{ padding: '0.75rem', color: '#111827', fontWeight: 600 }}>{fileName}</td>
      <td style={{ padding: '0.75rem' }}>
        <button
          onClick={handleOpenInTab}
          style={{ border: 'none', background: 'transparent', color: '#2563eb', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          Ouvrir
        </button>
      </td>
    </tr>
  );
};

export default CaseDetail;
