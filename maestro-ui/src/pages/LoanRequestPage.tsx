import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Trash2, DollarSign, Calendar, User } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const LoanRequestPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState({
    clientCode: 'CLI-20419',
    fullName: 'Claire Martin',
    birthDate: '12/04/1990',
    address: '15 rue des Lilas',
    city: '69003 Lyon',
    email: 'claire.martin@example.com',
    phone: '+33612345678',
    requestedAmount: 25000,
    durationMonths: 60,
    creditType: 'Prêt personnel',
    loanPurpose: 'Home renovation',
    otherIncome: 0,
    debtRatio: 12,
    netIncome: 3500,
    monthlyCharges: 800,
    familyStatus: 'Divorcée, un enfant',
    housingStatus: 'Locataire',
    jobTitle: 'Cheffe de Projet IT',
    employer: 'TechNova Solutions SAS',
    contractType: 'CDI',
    seniority: '5 ans',
    bankName: 'Banque Populaire',
    iban: 'FR1420041010050500013M02606',
    acceptSolvabilityStudy: false,
  });

  const [documents, setDocuments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: e.target.checked,
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFiles = Array.from(files);
      setDocuments((previous) => {
        const next = [...previous];
        for (const file of selectedFiles) {
          const duplicate = next.some((existing) => (
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
          ));
          if (!duplicate) {
            next.push(file);
          }
        }
        return next;
      });
    }
    e.target.value = '';
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const missingFields: string[] = [];
      if (!String(formData.loanPurpose || '').trim()) missingFields.push('objet du prêt');
      if (!(Number(formData.requestedAmount) > 0)) missingFields.push('montant demandé');
      if (!formData.acceptSolvabilityStudy) missingFields.push('consentement de solvabilité');
      if (missingFields.length > 0) {
        throw new Error(`Champs à compléter : ${missingFields.join(', ')}.`);
      }

      const formDataObj = new FormData();
      formDataObj.append('payload', JSON.stringify(formData));
      documents.forEach((doc) => {
        formDataObj.append('documents', doc, doc.name || 'document.bin');
      });

      const token = localStorage.getItem('uipath_access_token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/loan-requests`, {
        method: 'POST',
        headers,
        body: formDataObj,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Erreur lors de la création de la demande de crédit.');
      }

      setSuccess(true);
      setDocuments([]);
      const uploadedCount = Array.isArray(data?.uploadedDocuments) ? data.uploadedDocuments.length : 0;
      const failedCount = Array.isArray(data?.failedDocuments) ? data.failedDocuments.length : 0;
      const caseId = data?.caseId || 'N/A';
      setError('');
      setSuccessMessage(`Dossier ${caseId} créé. Documents: ${uploadedCount} importé(s), ${failedCount} en échec.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="loan-form-page">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-slate-900">New Loan Application</h1>
        <p className="text-slate-600 text-lg">Complete the form below to submit your credit application</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-slide-in-up">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3 animate-slide-in-up">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-900">Success!</p>
            <p className="text-sm text-green-700">{successMessage || 'Application submitted.'}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="loan-form-main">
        {/* Personal Information */}
        <div className="loan-section">
          <div className="loan-section-header">
            <div className="w-11 h-11 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
              <User size={20} className="text-brand-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Personal Information</h2>
          </div>

          <div className="loan-grid">
            <InputField
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              required
            />
            <InputField
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <InputField
              label="Phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        {/* Loan Details */}
        <div className="loan-section">
          <div className="loan-section-header">
            <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Loan Details</h2>
          </div>

          <div className="loan-grid">
            <InputField
              label="Requested Amount (€)"
              type="number"
              name="requestedAmount"
              value={formData.requestedAmount}
              onChange={handleInputChange}
              required
            />
            <InputField
              label="Duration (months)"
              type="number"
              name="durationMonths"
              value={formData.durationMonths}
              onChange={handleInputChange}
              required
            />
            <SelectField
              label="Credit Type"
              name="creditType"
              value={formData.creditType}
              onChange={handleInputChange}
              options={['Prêt personnel', 'Prêt auto', 'Prêt immobilier']}
            />
            <InputField
              label="Purpose"
              name="loanPurpose"
              value={formData.loanPurpose}
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Financial Information */}
        <div className="loan-section">
          <div className="loan-section-header">
            <div className="w-11 h-11 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <Calendar size={20} className="text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Financial Information</h2>
          </div>

          <div className="loan-grid">
            <InputField
              label="Net Monthly Income (€)"
              type="number"
              name="netIncome"
              value={formData.netIncome}
              onChange={handleInputChange}
              required
            />
            <InputField
              label="Monthly Charges (€)"
              type="number"
              name="monthlyCharges"
              value={formData.monthlyCharges}
              onChange={handleInputChange}
              required
            />
            <InputField
              label="Bank Name"
              name="bankName"
              value={formData.bankName}
              onChange={handleInputChange}
            />
            <InputField
              label="IBAN"
              name="iban"
              value={formData.iban}
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Document Upload */}
        <div className="loan-section">
          <div className="loan-section-header">
            <div className="w-11 h-11 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
              <Upload size={20} className="text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Supporting Documents</h2>
          </div>

          <div className="loan-upload-box text-center hover:border-brand-500 transition-colors duration-250 hover:bg-brand-50">
            <Upload size={32} className="mx-auto text-slate-400 mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Upload Documents</h3>
            <p className="text-slate-600 mb-6">Drag and drop or click to select files</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            <button
              type="button"
              onClick={openFilePicker}
              className="px-6 py-2.5 bg-gradient-brand text-white rounded-lg cursor-pointer hover:shadow-lg transition-all duration-250 inline-block font-medium"
            >
              Select Files
            </button>
          </div>

          {/* Document List */}
          {documents.length > 0 && (
            <div className="mt-8 space-y-4">
              {documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors duration-250"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                      <FileText size={20} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">{(doc.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDocument(idx)}
                    className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-all duration-250"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Consent */}
        <div className="loan-section">
          <label className="flex items-start space-x-4 cursor-pointer group">
            <input
              type="checkbox"
              name="acceptSolvabilityStudy"
              checked={formData.acceptSolvabilityStudy}
              onChange={handleInputChange}
              className="w-5 h-5 mt-1 rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
              required
            />
            <span className="text-slate-700 group-hover:text-slate-900 leading-relaxed text-[15px]">
              I agree to the terms and conditions and authorize credit checks and financial verification
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-8 border-t border-slate-200">
          <button
            type="button"
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all duration-250 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.acceptSolvabilityStudy}
            className="px-8 py-3 bg-gradient-brand text-white rounded-lg hover:shadow-lg transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center space-x-2"
          >
            <span>{isSubmitting ? 'Submitting...' : 'Submit Application'}</span>
            <CheckCircle size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

// Helper Components
const InputField: React.FC<{
  label: string;
  type?: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}> = ({ label, type = 'text', name, value, onChange, required }) => (
  <div className="loan-field">
    <label className="loan-label">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="loan-input"
      required={required}
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}> = ({ label, name, value, onChange, options }) => (
  <div className="loan-field">
    <label className="loan-label">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="loan-select"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

export default LoanRequestPage;
