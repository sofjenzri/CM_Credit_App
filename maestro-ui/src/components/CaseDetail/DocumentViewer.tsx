import React from 'react';
import { Download, X } from 'lucide-react';
import { canPreviewInViewer } from '../../utils/caseFormatters';

interface Props {
  isOpen: boolean;
  blobUrl: string | null;
  fileName: string;
  mimeType: string;
  onClose: () => void;
  onDownload: () => void;
}

const DocumentViewer: React.FC<Props> = ({ isOpen, blobUrl, fileName, mimeType, onClose, onDownload }) => {
  if (!isOpen || !blobUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[88vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{fileName}</p>
            <p className="text-xs text-slate-500 truncate">{mimeType}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
            >
              <Download size={14} />
              Télécharger
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
            >
              <X size={14} />
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100">
          {canPreviewInViewer(mimeType, fileName) ? (
            mimeType.startsWith('image/') ? (
              <div className="h-full w-full flex items-center justify-center bg-slate-900/5 p-4">
                <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
              </div>
            ) : mimeType === 'application/pdf' ? (
              <object data={blobUrl} type="application/pdf" className="w-full h-full">
                <iframe src={blobUrl} title={fileName} className="w-full h-full border-0" />
              </object>
            ) : (
              <iframe src={blobUrl} title={fileName} className="w-full h-full border-0" />
            )
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-600 p-6 text-center">
              <p className="text-base font-semibold text-slate-800">Prévisualisation non disponible pour ce type de fichier.</p>
              <p className="text-sm">Utilise le bouton Télécharger pour ouvrir ce document localement.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
