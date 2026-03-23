import { useEffect, useState } from 'react';
import { resolvePreviewMimeType, toAbsoluteDocumentUrl } from '../utils/caseFormatters';

export function useDocumentViewer() {
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState('document');
  const [viewerMimeType, setViewerMimeType] = useState('application/octet-stream');
  const [viewerBlob, setViewerBlob] = useState<Blob | null>(null);

  useEffect(() => {
    return () => {
      if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
    };
  }, [viewerBlobUrl]);

  const openDocument = async (url: string, fileName: string, docId: string) => {
    const absoluteUrl = toAbsoluteDocumentUrl(url);
    if (!absoluteUrl || absoluteUrl === '#') return;
    setOpeningDocId(docId);
    try {
      const token = localStorage.getItem('uipath_access_token') || localStorage.getItem('auth_token') || '';
      const response = await fetch(absoluteUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const text = await response.text();
        alert(`Erreur ouverture document: ${text}`);
        return;
      }
      const blob = await response.blob();
      const previewMimeType = resolvePreviewMimeType(response.headers.get('content-type') || '', fileName);
      const previewBlob = new Blob([blob], { type: previewMimeType });
      const blobUrl = URL.createObjectURL(previewBlob);
      if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
      setViewerBlob(blob);
      setViewerBlobUrl(blobUrl);
      setViewerFileName(fileName || 'document');
      setViewerMimeType(previewMimeType);
      setViewerOpen(true);
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOpeningDocId(null);
    }
  };

  const closeViewer = () => {
    setViewerOpen(false);
    if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
    setViewerBlobUrl(null);
    setViewerBlob(null);
  };

  const downloadFromViewer = () => {
    if (!viewerBlob) return;
    const url = URL.createObjectURL(viewerBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = viewerFileName || 'document';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return {
    openingDocId,
    viewerOpen,
    viewerBlobUrl,
    viewerFileName,
    viewerMimeType,
    openDocument,
    closeViewer,
    downloadFromViewer,
  };
}
