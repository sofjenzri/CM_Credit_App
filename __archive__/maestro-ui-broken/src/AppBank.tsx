import React, { useEffect, useMemo, useState } from 'react';
import { UiPath } from '@uipath/uipath-typescript/core';
import { CaseInstances, Cases } from '@uipath/uipath-typescript/cases';
import { Entities } from '@uipath/uipath-typescript/entities';
import CaseDetail from './components/CaseDetail';

type TabStatus = 'Running' | 'Completed' | 'Paused' | 'Faulted' | 'Cancelled' | 'All';

interface CaseProcess {
  processKey: string;
  name: string;
  runningCount?: number;
  completedCount?: number;
  pausedCount?: number;
  faultedCount?: number;
}

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
  caseId?: string;
  referenceId?: string;
  correlationTokens?: string[];
}

interface DataFabricEntity {
  id: string;
  name: string;
  displayName?: string;
}

type DataFabricRecord = Record<string, unknown>;

interface OpenDocumentResult {
  url: string;
  fileName: string;
  revokeOnClose: boolean;
}

interface JoinedCaseContext {
  caseId: string;
  mainCaseRecord?: DataFabricRecord;
  documentRecords: DataFabricRecord[];
  candidates: string[];
  mainCaseRecordCaseId?: string;
  mainCaseEntityId?: string;
  documentCaseIds: string[];
}

const extractItems = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) {
    return response as T[];
  }
  if (response && typeof response === 'object' && Array.isArray((response as { items?: unknown[] }).items)) {
    return (response as { items: T[] }).items;
  }
  return [];
};

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

const normalizeToken = (value: unknown) => String(value ?? '').trim().toLowerCase();

const normalizeFieldName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const collectDeepTokens = (value: unknown, keyHint: string, depth: number, tokens: Set<string>) => {
  if (depth > 3 || value === null || value === undefined) return;

  if (typeof value === 'string' || typeof value === 'number') {
    const normalizedKey = normalizeFieldName(keyHint);
    const isPotentialCaseField = normalizedKey.includes('caseid') || normalizedKey.includes('reference') || normalizedKey.includes('businesskey');
    if (isPotentialCaseField) {
      const normalized = normalizeToken(value);
      if (normalized) tokens.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectDeepTokens(item, keyHint, depth + 1, tokens);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      collectDeepTokens(childValue, childKey, depth + 1, tokens);
    }
  }
};

const buildCorrelationTokens = (item: Record<string, unknown>): string[] => {
  const preferredFields = ['instanceId', 'caseId', 'caseKey', 'referenceId', 'businessKey', 'caseTitle', 'instanceDisplayName', 'folderKey'];
  const tokens = new Set<string>();

  for (const field of preferredFields) {
    const value = item[field];
    if (value !== undefined && value !== null) {
      const normalized = normalizeToken(value);
      if (normalized) tokens.add(normalized);
    }
  }

  for (const [key, value] of Object.entries(item)) {
    const normalizedKey = normalizeFieldName(key);
    const isPotentialCaseField = normalizedKey.includes('caseid') || normalizedKey.includes('reference') || normalizedKey.includes('businesskey');
    if (!isPotentialCaseField) continue;
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;

    const normalized = normalizeToken(value);
    if (normalized) tokens.add(normalized);

    collectDeepTokens(value, key, 0, tokens);
  }

  for (const [key, value] of Object.entries(item)) {
    if (typeof value === 'object' && value !== null) {
      collectDeepTokens(value, key, 0, tokens);
    }
  }

  return [...tokens];
};

const getCaseIdFromRecord = (record: DataFabricRecord): string => {
  const visited = new Set<unknown>();

  const visit = (value: unknown, keyHint: string): string => {
    if (value === null || value === undefined) return '';
    if (visited.has(value)) return '';

    if (typeof value === 'string' || typeof value === 'number') {
      const normalizedKey = normalizeFieldName(keyHint);
      const isCaseIdentifierField =
        normalizedKey.includes('caseid') ||
        normalizedKey.includes('referenceid') ||
        normalizedKey.includes('businesskey');

      if (isCaseIdentifierField) {
        return String(value).trim();
      }
      return '';
    }

    if (Array.isArray(value)) {
      visited.add(value);
      for (const item of value) {
        const found = visit(item, keyHint);
        if (found) return found;
      }
      return '';
    }

    if (typeof value === 'object') {
      visited.add(value);
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        const found = visit(childValue, childKey);
        if (found) return found;
      }
    }

    return '';
  };

  return visit(record, '');
};

const getEntityRecordId = (record: DataFabricRecord): string => {
  const possibleFields = ['id', 'Id', 'ID', '_id', 'recordId', 'RecordId', 'entityId', 'EntityId'];
  for (const field of possibleFields) {
    if (field in record && record[field] !== null && record[field] !== undefined) {
      const value = String(record[field]).trim();
      if (value) return value;
    }
  }
  return '';
};

const getMainCaseReferenceIdFromDocument = (record: DataFabricRecord): string => {
  const keys = Object.keys(record);
  const matchingKey = keys.find((key) => {
    const normalized = normalizeFieldName(key);
    return (
      normalized.includes('maincaseid') ||
      normalized.includes('maincaseentityid') ||
      normalized.includes('maincase') && normalized.includes('id') ||
      normalized.includes('creditmaincaseid')
    );
  });

  if (!matchingKey) return '';
  const value = record[matchingKey];
  return value === null || value === undefined ? '' : String(value).trim();
};

const extractMainCaseReferenceIdsFromDocument = (record: DataFabricRecord): string[] => {
  const results = new Set<string>();
  const visited = new Set<unknown>();

  const walk = (value: unknown, keyHint: string) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'object') {
      if (visited.has(value)) return;
      visited.add(value);
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const normalizedKey = normalizeFieldName(keyHint);
      const isMainCaseLinkField =
        normalizedKey.includes('maincaseid') ||
        normalizedKey.includes('maincaseentityid') ||
        (normalizedKey.includes('maincase') && normalizedKey.includes('id')) ||
        normalizedKey.includes('creditmaincaseid') ||
        normalizedKey.includes('parentid');

      if (isMainCaseLinkField) {
        const token = String(value).trim();
        if (token) results.add(token);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, keyHint);
      }
      return;
    }

    if (typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        walk(childValue, childKey);
      }
    }
  };

  walk(record, '');

  const single = getMainCaseReferenceIdFromDocument(record);
  if (single) results.add(single);

  return [...results];
};

const recordContainsAnyCandidate = (record: DataFabricRecord, candidates: string[]) => {
  if (candidates.length === 0) return false;
  return Object.values(record).some((value) => {
    if (value === null || value === undefined) return false;
    const normalized = normalizeToken(value);
    return candidates.some((candidate) => candidate && (normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized)));
  });
};

const buildCaseMap = (records: DataFabricRecord[]) => {
  const map = new Map<string, DataFabricRecord>();
  for (const record of records) {
    const caseId = getCaseIdFromRecord(record);
    if (caseId) {
      map.set(normalizeToken(caseId), record);
    }
  }
  return map;
};

const buildCaseDocumentsMap = (records: DataFabricRecord[]) => {
  const map = new Map<string, DataFabricRecord[]>();
  for (const record of records) {
    const caseId = getCaseIdFromRecord(record);
    if (!caseId) continue;
    const key = normalizeToken(caseId);
    const existing = map.get(key) || [];
    existing.push(record);
    map.set(key, existing);
  }
  return map;
};

const summarizeMainCase = (record?: DataFabricRecord): string => {
  if (!record) return '-';
  const entries = Object.entries(record)
    .filter(([key, value]) => normalizeFieldName(key) !== 'caseid' && value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length > 0 ? entries.join(' · ') : '-';
};

const getRecordStringField = (record: DataFabricRecord, possibleFields: string[]) => {
  for (const field of possibleFields) {
    if (field in record && record[field] !== null && record[field] !== undefined) {
      const value = String(record[field]).trim();
      if (value) return value;
    }
  }
  return '';
};

const getAttachmentFieldCandidates = (record: DataFabricRecord): string[] => {
  const preferred = ['File', 'file', 'Document', 'document', 'Documents', 'documents', 'Attachment', 'attachment', 'Attachments', 'attachments'];
  const recordKeys = Object.keys(record);

  const dynamic = recordKeys.filter((key) => {
    const normalized = normalizeFieldName(key);
    return normalized.includes('file') || normalized.includes('document') || normalized.includes('attachment');
  });

  return [...new Set([...preferred, ...dynamic])];
};

const AppBank: React.FC = () => {
  console.log('[AppBank] Component rendering...');
  const [sdk, setSdk] = useState<UiPath | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [caseProcess, setCaseProcess] = useState<CaseProcess | null>(null);
  const [instances, setInstances] = useState<CaseInstanceRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<TabStatus>('All');
  const [dataFabricError, setDataFabricError] = useState<string | null>(null);
  const [mainCaseRecords, setMainCaseRecords] = useState<DataFabricRecord[]>([]);
  const [caseDocumentsRecords, setCaseDocumentsRecords] = useState<DataFabricRecord[]>([]);
  const [caseDocumentsEntityNames, setCaseDocumentsEntityNames] = useState<string[]>([]);
  const [mainCaseRecordsMap, setMainCaseRecordsMap] = useState<Map<string, DataFabricRecord>>(new Map());
  const [caseDocumentsMap, setCaseDocumentsMap] = useState<Map<string, DataFabricRecord[]>>(new Map());
  
  // Routing state
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const config = useMemo(() => {
    const baseUrl = (import.meta.env.VITE_UIPATH_BASE_URL || '').replace(/\/+$/, '');
    const clientId = import.meta.env.VITE_UIPATH_CLIENT_ID;
    const orgName = import.meta.env.VITE_UIPATH_ORG_NAME;
    const tenantName = import.meta.env.VITE_UIPATH_TENANT_NAME;
    const scope = import.meta.env.VITE_UIPATH_SCOPE;
    const redirectUri = (import.meta.env.VITE_UIPATH_REDIRECT_URI || window.location.origin).trim();
    const targetProcessKey = import.meta.env.VITE_TARGET_CASE_PROCESS_KEY || 'CM_Credit_MainProcess';
    const mainCaseEntityName = import.meta.env.VITE_MAINCASE_ENTITY_NAME || 'CM_Credit_MainCase';
    const caseDocumentsEntityName = import.meta.env.VITE_CASEDOCUMENTS_ENTITY_NAME || 'CM_Credit_CaseDocuments';

    return {
      baseUrl,
      clientId,
      orgName,
      tenantName,
      scope,
      redirectUri,
      targetProcessKey,
      mainCaseEntityName,
      caseDocumentsEntityName,
    };
  }, []);

  const buildSdk = () =>
    new UiPath({
      baseUrl: config.baseUrl,
      clientId: config.clientId,
      orgName: config.orgName,
      tenantName: config.tenantName,
      redirectUri: config.redirectUri,
      scope: config.scope,
    });

  const loadCreditCases = async (uiPathSdk: UiPath) => {
    const casesApi = new Cases(uiPathSdk);
    const caseInstancesApi = new CaseInstances(uiPathSdk);

    const allCasesResponse = await casesApi.getAll();
    const allCases = extractItems<CaseProcess>(allCasesResponse);

    const selectedCase =
      allCases.find((item) => item.processKey === config.targetProcessKey) ||
      allCases.find((item) => item.name === config.targetProcessKey) ||
      null;

    setCaseProcess(selectedCase);

    const processKeyToUse = selectedCase?.processKey || config.targetProcessKey;
    const instancesResponse = await caseInstancesApi.getAll({ processKey: processKeyToUse });
    const rawInstances = extractItems<any>(instancesResponse);

    const normalized = rawInstances.map((item) => ({
      instanceId: item.instanceId,
      processKey: item.processKey,
      status: item.latestRunStatus,
      startedTime: item.startedTime,
      completedTime: item.completedTime,
      caseTitle: item.caseTitle,
      instanceDisplayName: item.instanceDisplayName,
      folderKey: item.folderKey,
      startedByUser: item.startedByUser,
      caseId: item.caseId,
      referenceId: item.referenceId || item.businessKey,
      correlationTokens: buildCorrelationTokens(item),
    })) as CaseInstanceRow[];

    setInstances(normalized);
  };

  const loadDataFabric = async (uiPathSdk: UiPath) => {
    try {
      setDataFabricError(null);
      const entitiesApi = new Entities(uiPathSdk);
      const entitiesResponse = await entitiesApi.getAll();
      const entities = extractItems<DataFabricEntity>(entitiesResponse);

      const mainCaseEntity = entities.find((item) => item.name === config.mainCaseEntityName || item.displayName === config.mainCaseEntityName);
      const documentsEntity = entities.find((item) => item.name === config.caseDocumentsEntityName || item.displayName === config.caseDocumentsEntityName);

      if (mainCaseEntity?.id) {
        const mainCaseResponse = await entitiesApi.getAllRecords(mainCaseEntity.id, { expansionLevel: 2 });
        const mainCaseRecords = extractItems<DataFabricRecord>(mainCaseResponse);
        setMainCaseRecords(mainCaseRecords);
        setMainCaseRecordsMap(buildCaseMap(mainCaseRecords));
      } else {
        setMainCaseRecords([]);
        setMainCaseRecordsMap(new Map());
      }

      if (documentsEntity?.id) {
        const resolvedNames = [documentsEntity.name, documentsEntity.displayName, config.caseDocumentsEntityName]
          .filter((value): value is string => Boolean(value && value.trim()))
          .map((value) => value.trim());
        setCaseDocumentsEntityNames([...new Set(resolvedNames)]);

        const documentsResponse = await entitiesApi.getAllRecords(documentsEntity.id, { expansionLevel: 2 });
        const documentsRecords = extractItems<DataFabricRecord>(documentsResponse);
        setCaseDocumentsRecords(documentsRecords);
        setCaseDocumentsMap(buildCaseDocumentsMap(documentsRecords));
      } else {
        setCaseDocumentsEntityNames([]);
        setCaseDocumentsRecords([]);
        setCaseDocumentsMap(new Map());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDataFabricError(`Data Fabric indisponible: ${message}`);
      setCaseDocumentsEntityNames([]);
      setMainCaseRecords([]);
      setCaseDocumentsRecords([]);
      setMainCaseRecordsMap(new Map());
      setCaseDocumentsMap(new Map());
    }
  };

  const authenticateAndLoad = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      const uiPathSdk = buildSdk();
      await uiPathSdk.initialize();
      setSdk(uiPathSdk);
      await loadCreditCases(uiPathSdk);
      await loadDataFabric(uiPathSdk);

      setIsAuthenticated(true);
      setSuccess('Connexion réussie. Dossiers de crédit chargés.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Erreur de connexion UiPath: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const hasOAuthParams =
      window.location.search.includes('code=') ||
      window.location.search.includes('state=') ||
      window.location.search.includes('error=');

    if (!hasOAuthParams) return;
    authenticateAndLoad();
  }, []);

  useEffect(() => {
    if (!sdk || !isAuthenticated) return;

    const timer = setInterval(() => {
      loadCreditCases(sdk).catch(() => undefined);
      loadDataFabric(sdk).catch(() => undefined);
    }, 15000);

    return () => clearInterval(timer);
  }, [sdk, isAuthenticated]);

  const onRefresh = async () => {
    if (!sdk) return;
    try {
      setIsLoading(true);
      await loadCreditCases(sdk);
      await loadDataFabric(sdk);
    } finally {
      setIsLoading(false);
    }
  };

  const openCaseDocument = async (record: DataFabricRecord): Promise<OpenDocumentResult> => {
    const fileName = getRecordStringField(record, ['FileName', 'fileName', 'file_name', 'DocumentName', 'documentName']) || 'document.pdf';
    const fileType = getRecordStringField(record, ['FileType', 'fileType', 'file_type', 'DocumentType', 'documentType']).toLowerCase();

    if (!sdk) {
      throw new Error('Session UiPath indisponible.');
    }

    const recordId = getRecordStringField(record, ['id', 'Id', 'ID', '_id', 'recordId', 'RecordId']);
    if (!recordId) {
      throw new Error('Record ID introuvable pour le document.');
    }

    const entitiesApi = new Entities(sdk);
    const attachmentFields = getAttachmentFieldCandidates(record);
    const entityNameCandidates = [
      ...caseDocumentsEntityNames,
      config.caseDocumentsEntityName,
    ].filter((value, index, array) => Boolean(value && value.trim()) && array.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);

    let blob: Blob | null = null;
    let lastError: unknown = null;

    for (const entityName of entityNameCandidates) {
      for (const fieldName of attachmentFields) {
        try {
          blob = await entitiesApi.downloadAttachment({
            entityName,
            recordId,
            fieldName,
          });
          if (blob) break;
        } catch (error) {
          lastError = error;
        }
      }
      if (blob) break;
    }

    if (!blob) {
      const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'Erreur inconnue');
      throw new Error(`Ouverture impossible (record: ${recordId}). Détail: ${message}`);
    }

    const looksLikePdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
    const normalizedBlob = looksLikePdf && blob.type !== 'application/pdf'
      ? new Blob([blob], { type: 'application/pdf' })
      : blob;

    const objectUrl = URL.createObjectURL(normalizedBlob);
    return {
      url: objectUrl,
      fileName,
      revokeOnClose: true,
    };
  };

  const onLogout = async () => {
    try {
      if (sdk) {
        await sdk.logout();
      }
    } catch {
      // no-op
    } finally {
      setSdk(null);
      setIsAuthenticated(false);
      setCaseProcess(null);
      setInstances([]);
      setDataFabricError(null);
      setCaseDocumentsEntityNames([]);
      setMainCaseRecords([]);
      setCaseDocumentsRecords([]);
      setMainCaseRecordsMap(new Map());
      setCaseDocumentsMap(new Map());
      setSuccess(null);
      setError(null);
      setSelectedCaseId(null);
    }
  };

  const filteredInstances = instances.filter((item) => {
    if (statusFilter === 'All') return true;
    const normalized = item.status?.toLowerCase() || '';
    return normalized.includes(statusFilter.toLowerCase());
  });

  const runningCount = instances.filter((item) => item.status?.toLowerCase().includes('run')).length;

  const getJoinedCaseContext = (instance: CaseInstanceRow): JoinedCaseContext => {
    const candidates = [
      ...(instance.correlationTokens || []),
      normalizeToken(instance.instanceId),
      normalizeToken(instance.caseId),
      normalizeToken(instance.referenceId),
      normalizeToken(instance.caseTitle),
      normalizeToken(instance.instanceDisplayName),
    ].filter(Boolean);

    let matchedKey = candidates.find((candidate) => mainCaseRecordsMap.has(candidate) || caseDocumentsMap.has(candidate)) || '';

    if (!matchedKey) {
      const allKeys = new Set<string>([...mainCaseRecordsMap.keys(), ...caseDocumentsMap.keys()]);
      matchedKey =
        [...allKeys].find((key) =>
          candidates.some((candidate) => candidate.length >= 6 && (key.includes(candidate) || candidate.includes(key)))
        ) ||
        '';
    }

    if (!matchedKey) {
      const matchedMainCaseRecord = mainCaseRecords.find((record) => recordContainsAnyCandidate(record, candidates));
      const matchedDocRecord = caseDocumentsRecords.find((record) => recordContainsAnyCandidate(record, candidates));
      const fallbackCaseId = getCaseIdFromRecord(matchedMainCaseRecord || matchedDocRecord || {});
      if (fallbackCaseId) {
        matchedKey = normalizeToken(fallbackCaseId);
      }
    }

    const mappedMainCaseRecord = matchedKey ? mainCaseRecordsMap.get(matchedKey) : undefined;
    const mappedDocumentRecords = matchedKey ? caseDocumentsMap.get(matchedKey) || [] : [];

    const fallbackMainCaseRecord = mappedMainCaseRecord || mainCaseRecords.find((record) => recordContainsAnyCandidate(record, candidates));
    const mainCaseEntityId = getEntityRecordId(fallbackMainCaseRecord || {});
    const mainCaseRecordCaseId = getCaseIdFromRecord(fallbackMainCaseRecord || {});
    const enrichedCandidates = [...new Set([...candidates, normalizeToken(mainCaseEntityId), normalizeToken(mainCaseRecordCaseId)].filter(Boolean))];

    const documentsByMainCaseEntityId = mainCaseEntityId
      ? caseDocumentsRecords.filter((record) =>
          extractMainCaseReferenceIdsFromDocument(record).some((referenceId) => normalizeToken(referenceId) === normalizeToken(mainCaseEntityId))
        )
      : [];

    const fallbackDocumentRecords =
      documentsByMainCaseEntityId.length > 0
        ? documentsByMainCaseEntityId
        : mappedDocumentRecords.length > 0
          ? mappedDocumentRecords
          : caseDocumentsRecords.filter((record) => recordContainsAnyCandidate(record, enrichedCandidates));

    const resolvedCaseId =
      matchedKey ||
      normalizeToken(getCaseIdFromRecord(fallbackMainCaseRecord || {})) ||
      normalizeToken(getCaseIdFromRecord(fallbackDocumentRecords[0] || {})) ||
      '-';

    return {
      caseId: resolvedCaseId,
      mainCaseRecord: fallbackMainCaseRecord,
      documentRecords: fallbackDocumentRecords,
      candidates,
      mainCaseRecordCaseId,
      mainCaseEntityId,
      documentCaseIds: [...new Set(fallbackDocumentRecords.map((record) => getCaseIdFromRecord(record)).filter(Boolean))],
    };
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '2rem', maxWidth: '30rem', width: '100%' }}>
          <h1 style={{ fontSize: '1.8rem', margin: 0, color: '#111827' }}>Gestionnaire Crédit</h1>
          <p style={{ marginTop: '0.6rem', color: '#4b5563' }}>Connexion UiPath pour suivre les dossiers de crédit en cours.</p>
          {error && <div style={{ marginTop: '1rem', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.75rem' }}>{error}</div>}
          <button onClick={authenticateAndLoad} disabled={isLoading} style={{ marginTop: '1rem', width: '100%', border: 'none', borderRadius: '0.5rem', background: '#2563eb', color: 'white', padding: '0.8rem 1rem', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}>
            {isLoading ? 'Connexion en cours...' : 'Se connecter à UiPath'}
          </button>
          <p style={{ marginTop: '0.9rem', fontSize: '0.8rem', color: '#6b7280' }}>Case cible : <strong>{config.targetProcessKey}</strong></p>
        </div>
      </div>
    );
  }

  // Show detail view if a case is selected
  if (selectedCaseId) {
    const selectedInstance = instances.find((i) => i.instanceId === selectedCaseId);
    if (selectedInstance) {
      const joinedContext = getJoinedCaseContext(selectedInstance);
      return (
        <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <CaseDetail
            instance={selectedInstance}
            matchedCaseId={joinedContext.caseId}
            mainCaseRecord={joinedContext.mainCaseRecord}
            documentRecords={joinedContext.documentRecords}
            matchCandidates={joinedContext.candidates}
            mainCaseRecordCaseId={joinedContext.mainCaseRecordCaseId}
            mainCaseEntityId={joinedContext.mainCaseEntityId}
            documentCaseIds={joinedContext.documentCaseIds}
            onOpenDocument={openCaseDocument}
            onBack={() => setSelectedCaseId(null)}
          />
        </div>
      );
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#111827' }}>Portefeuille crédits - {caseProcess?.name || config.targetProcessKey}</h2>
            <p style={{ margin: '0.4rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
              Running: <strong>{runningCount}</strong> · Total dossiers: <strong>{instances.length}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onRefresh} disabled={isLoading} style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', background: 'white', color: '#111827', padding: '0.55rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>Actualiser</button>
            <button onClick={onLogout} style={{ border: 'none', borderRadius: '0.5rem', background: '#dc2626', color: 'white', padding: '0.55rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>Déconnexion</button>
          </div>
        </div>

        {success && <div style={{ marginTop: '0.9rem', background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '0.5rem', color: '#065f46', padding: '0.7rem 0.9rem' }}>{success}</div>}
        {error && <div style={{ marginTop: '0.9rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#991b1b', padding: '0.7rem 0.9rem' }}>{error}</div>}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['All', 'Running', 'Completed', 'Paused', 'Faulted', 'Cancelled'] as TabStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                border: statusFilter === status ? '1px solid #2563eb' : '1px solid #d1d5db',
                background: statusFilter === status ? '#dbeafe' : 'white',
                color: statusFilter === status ? '#1e40af' : '#374151',
                borderRadius: '999px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {dataFabricError && (
          <div style={{ marginTop: '1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#991b1b', padding: '0.7rem 0.9rem' }}>
            {dataFabricError}
          </div>
        )}

        <div style={{ marginTop: '1rem', background: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>Dossier</th>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>Case ID</th>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>État</th>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>En cours depuis</th>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>Démarré le</th>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>Conseiller</th>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>Métadonnées MainCase</th>
                <th style={{ textAlign: 'left', padding: '0.8rem', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase' }}>Documents liés</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstances.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1.3rem', color: '#6b7280', textAlign: 'center' }}>
                    Aucun dossier trouvé pour ce filtre.
                  </td>
                </tr>
              ) : (
                filteredInstances.map((item) => {
                  const color = statusColor(item.status || 'Unknown');
                  const joinedContext = getJoinedCaseContext(item);
                  return (
                    <tr
                      key={item.instanceId}
                      onClick={() => setSelectedCaseId(item.instanceId)}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: '0.8rem', color: '#111827', fontWeight: 600 }}>{item.caseTitle || item.instanceDisplayName || 'Dossier crédit'}</td>
                      <td style={{ padding: '0.8rem', color: '#374151', fontFamily: 'monospace' }}>{item.instanceId}</td>
                      <td style={{ padding: '0.8rem' }}>
                        <span style={{ background: color.bg, color: color.fg, borderRadius: '999px', fontSize: '0.76rem', fontWeight: 700, padding: '0.25rem 0.55rem' }}>
                          {item.status || 'Unknown'}
                        </span>
                      </td>
                      <td style={{ padding: '0.8rem', color: '#374151' }}>{formatDuration(item.startedTime, item.completedTime)}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{formatDateTime(item.startedTime)}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280' }}>{item.startedByUser || '-'}</td>
                      <td style={{ padding: '0.8rem', color: '#374151', fontSize: '0.83rem' }}>{summarizeMainCase(joinedContext.mainCaseRecord)}</td>
                      <td style={{ padding: '0.8rem', color: '#374151' }}>
                        <span style={{ background: '#eef2ff', color: '#3730a3', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 700 }}>
                          {joinedContext.documentRecords.length}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AppBank;
