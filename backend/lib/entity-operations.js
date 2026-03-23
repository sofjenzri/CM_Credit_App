import { uiPathConfig } from '../config/uipath.js';
import { uiPathJsonRequest, uiPathJsonRequestWithoutFolderContext, uiPathRequest } from './uipath-client.js';
import {
  normalizeToken,
  normalizeField,
  getStringField,
  normalizeSlaStatus,
  scanObjectForTokens,
  extractItems,
  getFirstObjectFromResponse,
  getEntityRecordId,
} from './data-mappers.js';

export const readEntityRecordsWithFallback = async (token, entityId, readQuery) => {
  try {
    const scopedResponse = await uiPathJsonRequest(token, `datafabric_/api/EntityService/entity/${entityId}/read`, readQuery);
    const scopedItems = extractItems(scopedResponse);
    if (scopedItems.length > 0) return scopedItems;
  } catch (_error) { /* fall through to unscoped */ }

  const unscopedResponse = await uiPathJsonRequestWithoutFolderContext(token, `datafabric_/api/EntityService/entity/${entityId}/read`, readQuery);
  return extractItems(unscopedResponse);
};

export const createEntityRecord = async (token, entityId, payload) => {
  const candidateCalls = [
    { path: `datafabric_/api/EntityService/entity/${entityId}/insert`, body: payload },
    { path: `datafabric_/api/EntityService/entity/${entityId}/insert`, body: { item: payload } },
    { path: `datafabric_/api/EntityService/entity/${entityId}/insert`, body: { items: [payload] } },
    { path: `datafabric_/api/EntityService/entity/${entityId}/create`, body: { items: [payload] } },
    { path: `datafabric_/api/EntityService/entity/${entityId}/create`, body: payload },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsert`, body: { items: [payload] } },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsert`, body: payload },
  ];

  const errors = [];

  for (const candidate of candidateCalls) {
    const response = await uiPathRequest(token, candidate.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate.body),
    });

    if (response.ok) {
      const createdRecord = getFirstObjectFromResponse(response.json || {});
      const createdRecordId = getEntityRecordId(createdRecord || {});
      if (createdRecordId) return { record: createdRecord, recordId: createdRecordId };
      if (createdRecord && typeof createdRecord === 'object') {
        return { record: createdRecord, recordId: getStringField(createdRecord, ['Id', 'id', 'ID']) };
      }
      return { record: createdRecord, recordId: '' };
    }

    errors.push(`${candidate.path} -> ${response.status}: ${response.text}`);
  }

  throw new Error(`Impossible de créer un enregistrement DataFabric pour l'entité ${entityId}. Détails: ${errors.join(' | ')}`);
};

export const insertThenUpdateCaseId = async (token, entityId, payload, caseIdValue) => {
  const caseIdPayload = {
    CaseID: caseIdValue, caseID: caseIdValue, caseId: caseIdValue,
    oCaseID: caseIdValue, ReferenceID: caseIdValue, BusinessKey: caseIdValue,
  };
  const incomingChannelPayload = {
    IncomingChannel: 'WEB', incomingChannel: 'WEB', Incoming_Channel: 'WEB',
    Channel: 'WEB', SourceChannel: 'WEB',
  };
  const insertPayload = { ...(payload || {}), ...caseIdPayload, ...incomingChannelPayload };

  const insertCandidates = [
    { path: `datafabric_/api/EntityService/entity/${entityId}/insert`, body: insertPayload },
    { path: `datafabric_/api/EntityService/entity/${entityId}/insert`, body: { item: insertPayload } },
    { path: `datafabric_/api/EntityService/entity/${entityId}/insert`, body: { items: [insertPayload] } },
    { path: `datafabric_/api/EntityService/entity/${entityId}/insertRecordsById`, body: { items: [insertPayload] } },
    { path: `datafabric_/api/EntityService/entity/${entityId}/create`, body: { items: [insertPayload] } },
  ];

  const insertErrors = [];
  let insertedRecord = null;
  let insertedRecordId = '';

  for (const candidate of insertCandidates) {
    const response = await uiPathRequest(token, candidate.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate.body),
    });

    if (!response.ok) {
      insertErrors.push(`${candidate.path} -> ${response.status}: ${response.text}`);
      continue;
    }

    insertedRecord = getFirstObjectFromResponse(response.json || {});
    insertedRecordId = getEntityRecordId(insertedRecord || {}) || getStringField(insertedRecord || {}, ['Id', 'id', 'ID']);
    if (insertedRecordId) break;
  }

  if (!insertedRecordId) {
    throw new Error(`Insert record échoué (recordId introuvable) pour l'entité ${entityId}. Détails: ${insertErrors.join(' | ')}`);
  }

  const updateCandidates = [
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsertRecordsById`, body: { items: [{ Id: insertedRecordId, ...insertPayload }] }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsertRecordsById`, body: { items: [{ id: insertedRecordId, ...insertPayload }] }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsert`, body: { items: [{ Id: insertedRecordId, ...insertPayload }] }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsert`, body: { Id: insertedRecordId, ...insertPayload }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/record/${insertedRecordId}`, body: insertPayload, method: 'PATCH' },
  ];

  const updateErrors = [];
  for (const candidate of updateCandidates) {
    const response = await uiPathRequest(token, candidate.path, {
      method: candidate.method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate.body),
    });
    if (response.ok) {
      return { record: insertedRecord, recordId: insertedRecordId, updatePath: candidate.path, updateWarning: '' };
    }
    updateErrors.push(`${candidate.path} -> ${response.status}: ${response.text}`);
  }

  return {
    record: insertedRecord,
    recordId: insertedRecordId,
    updatePath: '',
    updateWarning: `Update post-insert indisponible dans ce tenant. Détails: ${updateErrors.join(' | ')}`,
  };
};

export const updateDocumentFieldsByRecordId = async (token, entityId, recordId, payload) => {
  const candidates = [
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsertRecordsById`, body: { items: [{ Id: recordId, ...(payload || {}) }] }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsertRecordsById`, body: { items: [{ id: recordId, ...(payload || {}) }] }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsert`, body: { items: [{ Id: recordId, ...(payload || {}) }] }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/upsert`, body: { Id: recordId, ...(payload || {}) }, method: 'POST' },
    { path: `datafabric_/api/EntityService/entity/${entityId}/record/${recordId}`, body: payload || {}, method: 'PATCH' },
  ];

  const errors = [];
  for (const candidate of candidates) {
    const response = await uiPathRequest(token, candidate.path, {
      method: candidate.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate.body),
    });
    if (response.ok) return;
    errors.push(`${candidate.path} -> ${response.status}: ${response.text}`);
  }

  throw new Error(`Impossible de mettre à jour les champs document pour ${recordId}. Détails: ${errors.join(' | ')}`);
};

export const uploadEntityAttachment = async (token, entityName, recordId, fieldName, file) => {
  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' });
  formData.append('file', blob, file.originalname || 'document.bin');

  const errors = [];
  for (const method of ['POST', 'PUT']) {
    const response = await uiPathRequest(token, `datafabric_/api/Attachment/${entityName}/${recordId}/${fieldName}`, { method, body: formData });
    if (response.ok) return;
    errors.push(`${method} -> ${response.status}: ${response.text}`);
  }

  throw new Error(`Impossible d'uploader la pièce jointe sur ${entityName}/${recordId}/${fieldName}. ${errors.join(' | ')}`);
};

export const getEntitySampleRecord = async (token, entityId) => {
  const response = await uiPathJsonRequest(token, `datafabric_/api/EntityService/entity/${entityId}/read`, {
    limit: 1, start: 0, expansionLevel: 2,
  });
  const items = extractItems(response);
  return items[0] && typeof items[0] === 'object' ? items[0] : {};
};

export const mapValuesToEntityColumns = (sourceValues, sampleRecord) => {
  const sampleKeys = Object.keys(sampleRecord || {}).filter((key) => !['id', 'Id', 'ID', '_id'].includes(key));
  const normalizedKeyMap = new Map(sampleKeys.map((key) => [normalizeField(key), key]));
  const forcedEntityKeys = { incomingChannel: 'IncomingChannel' };

  const resolveEntityKey = (aliases = [], allowFuzzy = true) => {
    const normalizedAliases = aliases.map(normalizeField).filter(Boolean);
    for (const alias of normalizedAliases) {
      if (normalizedKeyMap.has(alias)) return normalizedKeyMap.get(alias);
    }
    if (!allowFuzzy) return '';
    for (const alias of normalizedAliases) {
      const fuzzyMatch = sampleKeys.find((key) => normalizeField(key).includes(alias));
      if (fuzzyMatch) return fuzzyMatch;
    }
    return '';
  };

  const mapped = {};
  const fieldDefs = [
    { valueKey: 'caseId', aliases: ['CaseID', 'caseID', 'caseId', 'oCaseID', 'ReferenceID', 'BusinessKey'] },
    { valueKey: 'clientCode', aliases: ['ClientID', 'ClientId', 'clientId', 'ClientCode', 'ClientRef', 'ReferenceClient'] },
    { valueKey: 'incomingChannel', aliases: ['IncomingChannel', 'Incoming_Channel', 'Channel', 'SourceChannel'] },
    { valueKey: 'name', aliases: ['Name', 'FullName', 'ClientName'], allowFuzzy: false },
    { valueKey: 'birthDate', aliases: ['BirthDate'] },
    { valueKey: 'creditType', aliases: ['CreditType', 'TypeCredit'] },
    { valueKey: 'requestedAmount', aliases: ['RequestedAmount', 'AmountRequested', 'LoanAmount'] },
    { valueKey: 'duration', aliases: ['Duration', 'DurationMonths'] },
    { valueKey: 'loanPurpose', aliases: ['LoanPurpose'] },
    { valueKey: 'caseStatus', aliases: ['CaseStatus', 'Status', 'DossierStatus'] },
    { valueKey: 'incomes', aliases: ['Incomes', 'Income'] },
    { valueKey: 'expenses', aliases: ['Expenses', 'Expense'] },
    { valueKey: 'otherIncome', aliases: ['OtherIncome'] },
    { valueKey: 'debtRatio', aliases: ['DebtRatio'] },
    { valueKey: 'iban', aliases: ['IBAN', 'Iban'] },
    { valueKey: 'bankName', aliases: ['BankName'], allowFuzzy: false },
    { valueKey: 'address', aliases: ['Address'] },
    { valueKey: 'city', aliases: ['City'] },
    { valueKey: 'phone', aliases: ['Phone'] },
    { valueKey: 'email', aliases: ['Email'] },
    { valueKey: 'familyStatus', aliases: ['FamilyStatus'] },
    { valueKey: 'housingStatus', aliases: ['HousingStatus'] },
    { valueKey: 'profession', aliases: ['Profession', 'JobTitle'] },
    { valueKey: 'employer', aliases: ['Employer'] },
    { valueKey: 'contractType', aliases: ['ContractType'] },
    { valueKey: 'seniority', aliases: ['Seniority'] },
    { valueKey: 'consent', aliases: ['Consent'] },
    { valueKey: 'createTime', aliases: ['CreateTime', 'CreatedAt'] },
  ];

  for (const def of fieldDefs) {
    const entityKey = forcedEntityKeys[def.valueKey] || resolveEntityKey(def.aliases, def.allowFuzzy !== false);
    if (!entityKey) continue;
    const value = sourceValues[def.valueKey];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    mapped[entityKey] = value;
  }

  return mapped;
};

export const mapDocumentValuesToEntityColumns = (sourceValues, sampleRecord) => {
  const sampleKeys = Object.keys(sampleRecord || {}).filter((key) => !['id', 'Id', 'ID', '_id'].includes(key));
  const normalizedKeyMap = new Map(sampleKeys.map((key) => [normalizeField(key), key]));
  const fallbackKeys = { caseId: 'OCaseID', fileName: 'FileName', fileType: 'FileType' };

  const resolveEntityKey = (aliases = []) => {
    const normalizedAliases = aliases.map(normalizeField).filter(Boolean);
    for (const alias of normalizedAliases) {
      if (normalizedKeyMap.has(alias)) return normalizedKeyMap.get(alias);
    }
    for (const alias of normalizedAliases) {
      const fuzzyMatch = sampleKeys.find((key) => normalizeField(key).includes(alias));
      if (fuzzyMatch) return fuzzyMatch;
    }
    return '';
  };

  const mapped = {};
  const fieldDefs = [
    { valueKey: 'caseId', aliases: ['OCaseID', 'OCaseId', 'oCaseID', 'oCaseId', 'CaseID'] },
    { valueKey: 'fileName', aliases: ['FileName', 'Filename', 'filename', 'Name'] },
    { valueKey: 'fileType', aliases: ['FileType', 'fileType'] },
  ];

  for (const def of fieldDefs) {
    const value = sourceValues[def.valueKey];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '' && def.valueKey !== 'fileType') continue;
    const entityKey = resolveEntityKey(def.aliases) || fallbackKeys[def.valueKey];
    mapped[entityKey] = value;
  }

  return mapped;
};

export const matchesTargetCaseModel = (instance) => {
  const targetModelId = normalizeToken(uiPathConfig.targetCaseModelId);
  if (!targetModelId) return true;
  const candidates = [
    getStringField(instance, ['packageId']),
    getStringField(instance, ['processKey', 'processDefinitionKey']),
    getStringField(instance, ['caseType']),
    getStringField(instance?.caseAppConfig || {}, ['id', 'Id', 'key', 'Key']),
    getStringField(instance, ['packageKey']),
  ].map(normalizeToken).filter(Boolean);
  return candidates.includes(targetModelId);
};

export const matchesTargetProcessKey = (instance) => {
  const targetProcessKey = normalizeToken(uiPathConfig.targetProcessKey);
  if (!targetProcessKey) return true;
  const candidates = [
    getStringField(instance, ['processKey', 'processDefinitionKey', 'caseType', 'packageKey']),
    getStringField(instance?.caseAppConfig || {}, ['key', 'Key']),
  ].map(normalizeToken).filter(Boolean);
  if (candidates.includes(targetProcessKey)) return true;
  return scanObjectForTokens(instance, [targetProcessKey]);
};

export const matchesTargetFolder = (instance) => {
  const targetFolderKey = normalizeToken(uiPathConfig.folderKey);
  if (!targetFolderKey) return true;
  const candidates = [
    getStringField(instance, ['folderKey', 'folderId', 'organizationUnitId']),
    getStringField(instance?.folder || {}, ['key', 'id']),
  ].map(normalizeToken).filter(Boolean);
  if (candidates.includes(targetFolderKey)) return true;
  return scanObjectForTokens(instance, [targetFolderKey]);
};
