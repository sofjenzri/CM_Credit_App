export const normalizeToken = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const normalizeField = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const getStringField = (record, fields) => {
  if (!record || typeof record !== 'object') return '';
  for (const field of fields) {
    if (field in record && record[field] !== null && record[field] !== undefined) {
      const value = String(record[field]).trim();
      if (value) return value;
    }
  }
  return '';
};

export const cleanPlaceholder = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const lowered = normalized.toLowerCase();
  if (lowered === 'unknown' || normalized === '-') return '';
  return normalized;
};

export const normalizeSlaStatus = (value) => {
  const raw = cleanPlaceholder(value);
  if (!raw) return '';
  const normalized = normalizeField(raw);
  if (normalized.includes('atrisk') || (normalized.includes('at') && normalized.includes('risk'))) return 'At Risk';
  if (normalized.includes('ontrack') || normalized.includes('ok') || normalized.includes('green') || normalized.includes('respect')) return 'On Track';
  if (normalized.includes('breach') || normalized.includes('overdue') || normalized.includes('violat') || normalized.includes('miss')) return 'Breached';
  if (normalized.includes('warning') || normalized.includes('attention') || normalized.includes('amber') || normalized.includes('orange')) return 'Warning';
  return raw;
};

export const normalizeProgressStatus = (value) => normalizeField(String(value || ''));

export const isActiveProgressStatus = (value) => {
  const normalized = normalizeProgressStatus(value);
  return normalized.includes('active')
    || normalized.includes('inprogress')
    || normalized.includes('running')
    || normalized.includes('started')
    || normalized.includes('pending');
};

export const findValueByKeyTokens = (record, keyTokens = []) => {
  if (!record || typeof record !== 'object' || !Array.isArray(keyTokens) || !keyTokens.length) return '';
  const normalizedTokens = keyTokens.map((token) => normalizeField(token)).filter(Boolean);
  const visited = new Set();

  const visit = (value) => {
    if (value === null || value === undefined) return '';
    if (visited.has(value)) return '';

    if (Array.isArray(value)) {
      visited.add(value);
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return '';
    }

    if (typeof value === 'object') {
      visited.add(value);
      for (const [key, child] of Object.entries(value)) {
        const normalizedKey = normalizeField(key);
        const keyMatches = normalizedTokens.some((token) => normalizedKey.includes(token));
        if (keyMatches) {
          if (typeof child === 'string' || typeof child === 'number') {
            const direct = String(child).trim();
            if (direct) return direct;
          }
          const deepFromMatchedKey = visit(child);
          if (deepFromMatchedKey) return deepFromMatchedKey;
        }
      }
      for (const child of Object.values(value)) {
        const found = visit(child);
        if (found) return found;
      }
    }

    return '';
  };

  return visit(record);
};

export const getTaskTime = (task, aliases = []) => {
  const direct = getStringField(task, aliases);
  if (direct) return direct;
  return findValueByKeyTokens(task, aliases);
};

export const mapTaskLikeObject = (task, index = 0, fallback = {}) => {
  const stageName =
    getStringField(task, ['stageName', 'stage', 'stageDisplayName'])
    || getStringField(task?.stage || {}, ['name', 'stageName'])
    || fallback.stageName
    || '';
  const stageId =
    getStringField(task, ['stageId', 'currentStageId'])
    || getStringField(task?.stage || {}, ['id', 'stageId'])
    || fallback.stageId
    || '';

  const startedTime = getTaskTime(task, ['startedTime', 'startTime', 'startedAt', 'createdTime', 'createdAt', 'startDate', 'startDateTime']);
  const completedTime = getTaskTime(task, ['completedTime', 'endTime', 'completedAt', 'finishedTime', 'updatedAt', 'endDate', 'completedDateTime']);

  return {
    id: getStringField(task, ['id', 'taskId', 'TaskId', 'key']) || `task-${index + 1}`,
    name: getStringField(task, ['name', 'taskName', 'displayName', 'title']) || '',
    status: getStringField(task, ['status', 'state', 'taskState']) || '',
    type: getStringField(task, ['type', 'taskType', 'kind']) || '',
    assignee: getStringField(task, ['assignee', 'assignedTo', 'assigneeName', 'assignedUser', 'owner']) || 'Unassigned',
    dueDate: getTaskTime(task, ['dueDate', 'dueAt', 'dueTime', 'deadline', 'targetDate', 'targetTime']),
    slaStatus: normalizeSlaStatus(
      getStringField(task, ['slaStatus', 'SlaStatus', 'slaState'])
      || findValueByKeyTokens(task, ['sla', 'deadline'])
    ) || 'Unknown',
    taskState: getStringField(task, ['taskState', 'state', 'status']) || '',
    stageName,
    stageId,
    startedTime,
    completedTime,
  };
};

export const buildTaskDedupeKey = (task) => {
  const id = getStringField(task, ['id', 'taskId', 'TaskId', 'key']);
  if (id) return `id:${id}`;
  const name = getStringField(task, ['name', 'taskName', 'displayName', 'title']);
  const stageName = getStringField(task, ['stageName', 'stage', 'stageDisplayName']);
  const dueDate = getTaskTime(task, ['dueDate', 'dueAt', 'dueTime', 'deadline']);
  return `fallback:${normalizeField(name)}:${normalizeField(stageName)}:${normalizeField(dueDate)}`;
};

export const mapActivityItem = (item, index = 0) => {
  const time =
    getStringField(item, ['timestamp', 'time', 'eventTime', 'createdTime', 'createdAt', 'startTime', 'startedTime', 'completedTime', 'updatedAt'])
    || findValueByKeyTokens(item, ['time', 'date', 'timestamp']);
  const title =
    getStringField(item, ['title', 'name', 'eventName', 'displayName', 'action', 'message'])
    || findValueByKeyTokens(item, ['event', 'activity', 'action'])
    || 'Activity';
  const actor =
    getStringField(item, ['actor', 'performedBy', 'user', 'username', 'email', 'initiatedBy'])
    || getStringField(item?.actor || {}, ['name', 'displayName', 'email'])
    || '';
  const status = getStringField(item, ['status', 'state', 'result']) || '';
  const details =
    getStringField(item, ['details', 'description', 'reason', 'comment'])
    || findValueByKeyTokens(item, ['reason', 'error', 'message']);

  return {
    id: getStringField(item, ['id', 'eventId', 'historyId']) || `activity-${index + 1}`,
    title,
    time,
    actor,
    status,
    details,
    source: getStringField(item, ['source', 'type', 'category']) || '',
  };
};

export const findCaseIdPattern = (record) => {
  if (!record || typeof record !== 'object') return '';
  const visited = new Set();
  const pattern = /\b[A-Z]{2,8}-\d{4,}\b/i;

  const visit = (value) => {
    if (value === null || value === undefined) return '';
    if (visited.has(value)) return '';

    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      const match = text.match(pattern);
      return match ? match[0] : '';
    }

    if (Array.isArray(value)) {
      visited.add(value);
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return '';
    }

    if (typeof value === 'object') {
      visited.add(value);
      for (const child of Object.values(value)) {
        const found = visit(child);
        if (found) return found;
      }
    }

    return '';
  };

  return visit(record);
};

export const findRecordValueByKey = (record, key, aliases = []) => {
  if (!record || typeof record !== 'object') return '-';
  const expected = [key, ...aliases].map(normalizeField);
  const found = Object.entries(record).find(([recordKey]) => expected.includes(normalizeField(recordKey)));
  if (!found) return '-';
  const value = String(found[1] ?? '').trim();
  return value || '-';
};

export const scanObjectForTokens = (value, candidates, visited = new Set()) => {
  if (value === null || value === undefined) return false;
  if (visited.has(value)) return false;

  if (typeof value === 'string' || typeof value === 'number') {
    const token = normalizeToken(value);
    return candidates.some((candidate) => candidate && (token === candidate || token.includes(candidate) || candidate.includes(token)));
  }

  if (Array.isArray(value)) {
    visited.add(value);
    return value.some((item) => scanObjectForTokens(item, candidates, visited));
  }

  if (typeof value === 'object') {
    visited.add(value);
    return Object.values(value).some((item) => scanObjectForTokens(item, candidates, visited));
  }

  return false;
};

export const getCaseIdFromRecord = (record) => {
  if (!record || typeof record !== 'object') return '';
  const visited = new Set();

  const visit = (value, keyHint = '') => {
    if (value === null || value === undefined) return '';
    if (visited.has(value)) return '';

    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = normalizeField(keyHint);
      const looksLikeCaseId =
        normalized.includes('caseid') ||
        normalized.includes('referenceid') ||
        normalized.includes('businesskey') ||
        normalized.includes('casenumber') ||
        normalized.includes('ocaseid');
      return looksLikeCaseId ? String(value).trim() : '';
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
      for (const [childKey, childValue] of Object.entries(value)) {
        const found = visit(childValue, childKey);
        if (found) return found;
      }
      return '';
    }

    return '';
  };

  return visit(record, '');
};

export const getEntityRecordId = (record) => getStringField(record, ['id', 'Id', 'ID', '_id', 'recordId', 'RecordId']);

export const getAttachmentFieldCandidates = (record) => {
  const preferred = ['File', 'file', 'Document', 'document', 'Documents', 'documents', 'Attachment', 'attachment'];
  const dynamic = Object.keys(record || {}).filter((key) => {
    const normalized = normalizeField(key);
    return normalized.includes('file') || normalized.includes('document') || normalized.includes('attachment');
  });
  return [...new Set([...preferred, ...dynamic])];
};

export const extractMainCaseReferenceIdsFromDocument = (record) => {
  const results = new Set();
  const visited = new Set();

  const visit = (value, keyHint = '') => {
    if (value === null || value === undefined) return;
    if (visited.has(value)) return;

    if (typeof value === 'string' || typeof value === 'number') {
      const normalized = normalizeField(keyHint);
      const looksLikeMainCaseRef =
        normalized.includes('maincaseid') ||
        normalized.includes('maincaseentityid') ||
        (normalized.includes('maincase') && normalized.includes('id')) ||
        normalized.includes('creditmaincaseid');
      if (looksLikeMainCaseRef) {
        const valueString = String(value).trim();
        if (valueString) results.add(valueString);
      }
      return;
    }

    if (Array.isArray(value)) {
      visited.add(value);
      value.forEach((item) => visit(item, keyHint));
      return;
    }

    if (typeof value === 'object') {
      visited.add(value);
      Object.entries(value).forEach(([key, child]) => visit(child, key));
    }
  };

  visit(record, '');
  return [...results];
};

export const extractItems = (response) => {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && Array.isArray(response.items)) return response.items;
  if (response && typeof response === 'object' && Array.isArray(response.value)) return response.value;
  return [];
};

export const getFirstObjectFromResponse = (responseBody) => {
  if (!responseBody) return null;
  if (Array.isArray(responseBody) && responseBody.length > 0 && typeof responseBody[0] === 'object') return responseBody[0];
  if (Array.isArray(responseBody?.items) && responseBody.items.length > 0) return responseBody.items[0];
  if (Array.isArray(responseBody?.value) && responseBody.value.length > 0) return responseBody.value[0];
  if (Array.isArray(responseBody?.createdItems) && responseBody.createdItems.length > 0) return responseBody.createdItems[0];
  if (responseBody?.item && typeof responseBody.item === 'object') return responseBody.item;
  if (typeof responseBody === 'object') return responseBody;
  return null;
};
