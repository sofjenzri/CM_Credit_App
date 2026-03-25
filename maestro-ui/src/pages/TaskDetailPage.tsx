import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, resolvePreviewMimeType, toAbsoluteDocumentUrl } from '../utils/caseFormatters';
import { tasksService, type TaskDetailsResponse, type TaskFormResponse } from '../services/tasks';
import { casesService, type CaseDetail } from '../services/cases';
import { useDocumentViewer } from '../hooks/useDocumentViewer';
import DocumentViewer from '../components/CaseDetail/DocumentViewer';

const looksLikeHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const fieldLabels: Record<string, string> = {
  CustomerOfferCompliant: 'Assurance cliente est valide (Y/N)',
  CommercialOfferMoreAdvantageous: 'Offre UiBank est meilleure (Y/N)',
};

const unlabeledFields = new Set(['RemediationAgentAnalysisResult', 'CommercialArgument']);
const completenessTaskName = 'vérification complétude dossier crédit';

const renderPrimitive = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return String(value);
  return String(value);
};

const ReadOnlyField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  if (Array.isArray(value)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-2 space-y-2">
          {value.length ? value.map((item, index) => (
            <div key={`${label}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <ReadOnlyField label={`${label} ${index + 1}`} value={item} />
            </div>
          )) : <p className="text-sm text-slate-500">Aucune valeur.</p>}
        </div>
      </div>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {Object.entries(value).map(([key, nestedValue]) => (
            <ReadOnlyField key={`${label}-${key}`} label={key} value={nestedValue} />
          ))}
        </div>
      </div>
    );
  }

  const textValue = renderPrimitive(value);
  const isHtml = typeof value === 'string' && looksLikeHtml(value);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      {label ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p> : null}
      {isHtml ? (
        <div
          className={`prose prose-sm max-w-none text-slate-700 prose-p:my-2 prose-ul:my-2 prose-li:my-1 ${label ? 'mt-2' : ''}`}
          dangerouslySetInnerHTML={{ __html: textValue }}
        />
      ) : (
        <p className={`${label ? 'mt-2' : ''} whitespace-pre-wrap break-words text-sm text-slate-700`}>{textValue}</p>
      )}
    </div>
  );
};

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
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{document.fileType || 'Document'}</p>
      <div className="mt-3 h-56 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
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
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{document.fileName || '-'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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

const TaskDetailPage: React.FC = () => {
  const { id: caseId, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskDetailsResponse | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormResponse | null>(null);
  const [comment, setComment] = useState('');
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openingDocId, viewerOpen, viewerBlobUrl, viewerFileName, viewerMimeType, openDocument, closeViewer, downloadFromViewer } = useDocumentViewer();

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await tasksService.assignTaskToSelf(taskId);
        const [taskResponse, formResponse] = await Promise.all([
          tasksService.getTask(taskId),
          tasksService.getTaskForm(taskId),
        ]);
        if (cancelled) return;
        setTask(taskResponse);
        setTaskForm(formResponse);
        if (caseId) {
          const detailResponse = await casesService.getCaseById(caseId);
          if (cancelled) return;
          setCaseDetail(detailResponse);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Impossible de charger la tâche');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const inputEntries = useMemo(
    () => Object.entries(taskForm?.data || {}),
    [taskForm],
  );
  const normalizedTaskTitle = String(taskForm?.title || task?.Title || '').trim().toLowerCase();
  const isCompletenessTask = normalizedTaskTitle === completenessTaskName;
  const businessCaseId = String(caseDetail?.caseId || '').trim();

  const handleReturnToCase = () => {
    navigate(caseId ? `/cases/${caseId}` : '/cases');
  };

  const handleComplete = async (action = 'Submit') => {
    if (!taskId) return;

    setSubmitting(true);
    setError(null);

    const existingData = taskForm?.data || {};
    const payload = {
      action,
      data: existingData,
    };

    try {
      await tasksService.completeTask(taskId, payload);
      handleReturnToCase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de compléter la tâche');
      setSubmitting(false);
    }
  };

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

  if (loading) {
    return (
      <div className="detail-page">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-700 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin" />
          Chargement de la tâche...
        </div>
      </div>
    );
  }

  if (error && !taskForm && !task) {
    return (
      <div className="detail-page">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
        <button
          type="button"
          onClick={handleReturnToCase}
          className="w-fit px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50"
        >
          Retour au dossier
        </button>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">AppTask</p>
          <h1 className="text-2xl font-bold text-slate-900">{taskForm?.title || task?.Title || `Tâche ${taskId}`}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {task?.Status || 'Statut inconnu'}
            </span>
            {task?.Priority ? (
              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                Priorité {task.Priority}
              </span>
            ) : null}
            <span>Dossier: {caseId || '-'}</span>
            <span>Créée le {formatDate(task?.CreationTime || taskForm?.creationTime)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReturnToCase}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
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

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {isCompletenessTask ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Documents du dossier</p>
                  <h2 className="text-lg font-semibold text-slate-900">Pièces rattachées</h2>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? 'Téléversement...' : 'Uploader des documents'}
                  <input type="file" multiple className="hidden" onChange={handleUploadDocument} disabled={uploading} />
                </label>
              </div>

              {!caseDetail?.documents?.length ? (
                <p className="mt-4 text-sm text-slate-500">Aucun document disponible pour ce dossier.</p>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
            </>
          ) : !inputEntries.length ? (
            <p className="text-sm text-slate-500">Aucune donnée disponible pour cette tâche.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {inputEntries.map(([key, value]) => (
                <ReadOnlyField
                  key={key}
                  label={unlabeledFields.has(key) ? '' : (fieldLabels[key] || key)}
                  value={value}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 h-fit">
          <h2 className="text-lg font-semibold text-slate-900">Décision</h2>
          {isCompletenessTask ? (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Cette action permet de traiter la complétude du dossier et de déclencher l&apos;action UiPath appropriée.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => handleComplete('AnalyzeCompleteness')}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-700 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Réévaluer le dossier
                </button>
                <button
                  type="button"
                  onClick={() => handleComplete('NotifyClient')}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-600 bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Notifier le client
                </button>
                <button
                  type="button"
                  onClick={() => handleComplete('RejectCase')}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-700 bg-rose-700 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Clôturer le cas
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Les données d&apos;entrée sont affichées en lecture seule. Le commentaire est conservé à l&apos;écran pour la saisie, mais n&apos;est pas encore transmis à UiPath tant qu&apos;une route de commentaire dédiée n&apos;est pas branchée.
              </p>

              <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="task-comment">
                Commentaire
              </label>
              <textarea
                id="task-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Saisir un commentaire de décision"
              />

              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={handleReturnToCase}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Mise en attente nouvelle assurance client
                </button>
                <button
                  type="button"
                  onClick={() => handleComplete('Submit')}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-700 bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Offre UiBank acceptée
                </button>
              </div>
            </>
          )}
          <div className="mt-4">
            <Link to={caseId ? `/cases/${caseId}` : '/cases'} className="text-sm font-medium text-cyan-700 hover:text-cyan-900">
              Retour au dossier
            </Link>
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

export default TaskDetailPage;
