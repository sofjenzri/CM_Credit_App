import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { formatDate, resolvePreviewMimeType, toAbsoluteDocumentUrl } from '../utils/caseFormatters';
import { casesService, type CaseDetail } from '../services/cases';
import { useDocumentViewer } from '../hooks/useDocumentViewer';
import DocumentViewer from '../components/CaseDetail/DocumentViewer';
import ReadOnlyField from '../components/ReadOnlyField';
import type { TaskDataProps } from '../hooks/useTaskData';

// ---------------------------------------------------------------------------
// DocumentPreviewCard
// ---------------------------------------------------------------------------

interface DocumentPreviewCardProps {
  document: NonNullable<CaseDetail['documents']>[number];
  onOpenDocument: (url: string, fileName: string, docId: string) => void;
  openingDocId: string | null;
  onDeleteDocument: (documentId: string) => void;
  deletingDocId: string | null;
}

const DocumentPreviewCard: React.FC<DocumentPreviewCardProps> = ({
  document,
  onOpenDocument,
  openingDocId,
  onDeleteDocument,
  deletingDocId,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      const absoluteUrl = toAbsoluteDocumentUrl(document.url);
      if (!absoluteUrl || absoluteUrl === '#') return;

      const token = localStorage.getItem('uipath_access_token') || localStorage.getItem('auth_token') || '';
      try {
        const response = await fetch(absoluteUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const blob = await response.blob();
        const mimeType = resolvePreviewMimeType(response.headers.get('content-type') || document.fileType || '', document.fileName);
        const previewBlob = new Blob([blob], { type: mimeType });
        objectUrl = URL.createObjectURL(previewBlob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewUrl(objectUrl);
        setPreviewMimeType(mimeType);
      } catch (_error) {
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.fileName, document.fileType, document.url]);

  const isImage = previewMimeType.startsWith('image/');
  const isPdf = previewMimeType === 'application/pdf';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ padding: '10px 0 14px 12px' }}>{document.fileType || 'Document'}</p>
      <div className="h-56 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {previewUrl && isImage ? (
          <img src={previewUrl} alt={document.fileName || 'document'} className="h-full w-full object-cover" />
        ) : previewUrl && isPdf ? (
          <object data={previewUrl} type="application/pdf" className="h-full w-full">
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-500">
              <FileText size={44} />
            </div>
          </object>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-100 text-slate-500">
            <FileText size={44} />
            <span className="text-sm font-medium">{document.fileName || 'Document'}</span>
          </div>
        )}
      </div>
      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900" style={{ padding: '10px 0 4px 12px' }}>{document.fileName || '-'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2" style={{ paddingTop: '10px' }}>
          <button
            type="button"
            onClick={() => onOpenDocument(document.url || '', document.fileName || 'document', document.id)}
            disabled={openingDocId === document.id}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="Ouvrir dans le viewer"
          >
            {openingDocId === document.id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            onClick={() => onDeleteDocument(document.id)}
            disabled={deletingDocId === document.id}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            title="Supprimer le document"
          >
            {deletingDocId === document.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------------
// CompletenessTaskPage
// ---------------------------------------------------------------------------

const CompletenessTaskPage: React.FC<TaskDataProps> = ({
  caseId,
  taskId,
  task,
  taskForm,
  caseDetail,
  setCaseDetail,
  submitting,
  error,
  setError,
  businessCaseId,
  handleReturnToCase,
  handleComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const { openingDocId, viewerOpen, viewerBlobUrl, viewerFileName, viewerMimeType, openDocument, closeViewer, downloadFromViewer } = useDocumentViewer();

  const agentAnalysis = taskForm?.data?.AgentAnalysis;

  const handleUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!businessCaseId) return;
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setUploading(true);
    setError(null);
    try {
      const createdDocuments: NonNullable<CaseDetail['documents']> = [];
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const createdDocument = await casesService.uploadDocument(businessCaseId, file);
        createdDocuments.push(createdDocument);
      }
      setCaseDetail((current) => current ? {
        ...current,
        documents: [...(current.documents || []), ...createdDocuments],
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de téléverser le document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    setDeletingDocId(documentId);
    setError(null);
    try {
      await casesService.deleteDocument(documentId);
      setCaseDetail((current) => current ? {
        ...current,
        documents: (current.documents || []).filter((document) => document.id !== documentId),
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer le document');
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <div className="detail-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{taskForm?.title || task?.Title || `Tâche ${taskId}`}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Dossier: {businessCaseId || caseId || '-'}</span>
            <span>Créée le {formatDate(task?.CreationTime || taskForm?.creationTime)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReturnToCase}
          className="inline-flex min-h-12 min-w-[170px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Retour au dossier
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Documents du dossier</h2>
            </div>
            <label className="inline-flex min-h-12 min-w-[220px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Téléversement...' : 'Uploader des documents'}
              <input type="file" multiple className="hidden" onChange={handleUploadDocument} disabled={uploading} />
            </label>
          </div>

          {!caseDetail?.documents?.length ? (
            <p className="text-sm text-slate-500" style={{ marginTop: '40px' }}>Aucun document disponible pour ce dossier.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" style={{ marginTop: '40px' }}>
              {caseDetail.documents.map((document) => (
                <DocumentPreviewCard
                  key={document.id}
                  document={document}
                  onOpenDocument={openDocument}
                  openingDocId={openingDocId}
                  onDeleteDocument={handleDeleteDocument}
                  deletingDocId={deletingDocId}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 h-fit">
          {agentAnalysis ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50" style={{ padding: '8px' }}>
                <div className="flex h-12 items-center">
                  <h2 className="text-lg font-semibold text-cyan-700">Conclusions de l'Agent IA</h2>
                </div>
                <div className="h-2" aria-hidden="true" />
                <div>
                  <ReadOnlyField label="" value={agentAnalysis} />
                </div>
              </div>
              <div className="h-[200px]" aria-hidden="true" />
            </>
          ) : null}

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handleComplete('AnalyzeCompleteness')}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #ee7728 0%, #f19250 100%)', padding: '10px 20px', width: '220px' }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Réévaluer le dossier
            </button>
            <button
              type="button"
              onClick={() => handleComplete('NotifyClient')}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ padding: '10px 20px', width: '220px' }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Notifier le client
            </button>
            <button
              type="button"
              onClick={() => handleComplete('RejectCase')}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-700 bg-rose-700 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ padding: '10px 20px', width: '220px' }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Rejeter le dossier
            </button>
          </div>
        </section>
      </div>

      <DocumentViewer
        isOpen={viewerOpen}
        blobUrl={viewerBlobUrl}
        fileName={viewerFileName}
        mimeType={viewerMimeType}
        onClose={closeViewer}
        onDownload={downloadFromViewer}
      />
    </div>
  );
};

export default CompletenessTaskPage;
