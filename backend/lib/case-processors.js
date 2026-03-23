import { uiPathConfig } from '../config/uipath.js';
import { uiPathJsonRequestWithHeaders } from './uipath-client.js';
import {
  normalizeField,
  normalizeSlaStatus,
  getStringField,
  cleanPlaceholder,
  findValueByKeyTokens,
  findCaseIdPattern,
  findRecordValueByKey,
  scanObjectForTokens,
  getCaseIdFromRecord,
  getEntityRecordId,
  getAttachmentFieldCandidates,
  mapTaskLikeObject,
  mapActivityItem,
  normalizeToken,
  extractItems,
} from './data-mappers.js';

const CASE_TRIGGER_NODE_TYPE = 'case-management:Trigger';
const CASE_NOT_STARTED_STATUS = 'Not Started';

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const resolveCaseBinding = (value, bindingsMap) => {
  if (typeof value === 'string' && value.startsWith('=bindings.')) {
    const bindingId = value.slice('=bindings.'.length);
    const binding = bindingsMap.get(bindingId);
    return binding?.default || binding?.name || value;
  }
  return value;
};

const createCaseBindingsMap = (caseJson) => {
  const bindingsMap = new Map();
  const bindings = caseJson?.root?.data?.uipath?.bindings;
  if (Array.isArray(bindings)) {
    bindings.forEach((binding) => {
      if (binding?.id) bindingsMap.set(binding.id, binding);
    });
  }
  return bindingsMap;
};

const createElementExecutionMap = (executionHistory) => {
  const executionMap = new Map();
  const elementExecutions = Array.isArray(executionHistory?.elementExecutions) ? executionHistory.elementExecutions : [];
  elementExecutions.forEach((execution) => {
    if (execution?.elementId) executionMap.set(execution.elementId, execution);
  });
  return executionMap;
};

const transformCaseTaskFromNode = (task, executionMap, bindingsMap) => {
  const taskId = task?.id || task?.elementId || task?.key || '';
  const taskExecution = taskId ? executionMap.get(taskId) : null;
  let taskName = task?.displayName || task?.name || task?.label || '';
  if (!taskName && task?.data?.name) {
    taskName = resolveCaseBinding(task.data.name, bindingsMap);
  }
  return {
    id: taskId || `task-${Math.random().toString(36).slice(2, 8)}`,
    name: taskName || 'Undefined',
    status: taskExecution?.status || CASE_NOT_STARTED_STATUS,
    type: task?.type || 'Undefined',
    startedTime: taskExecution?.startedTime || '',
    completedTime: taskExecution?.completedTime || '',
    stageId: '',
    stageName: '',
  };
};

const buildStagesFromCaseDefinition = (caseJson, executionHistory) => {
  const nodes = Array.isArray(caseJson?.nodes) ? caseJson.nodes : [];
  if (!nodes.length) return [];

  const executionMap = createElementExecutionMap(executionHistory);
  const bindingsMap = createCaseBindingsMap(caseJson);

  return nodes
    .filter((node) => node && node.type !== CASE_TRIGGER_NODE_TYPE)
    .map((node, index) => {
      const execution = executionMap.get(node.id);
      const taskGroups = Array.isArray(node?.data?.tasks) ? node.data.tasks : [];
      const tasks = taskGroups
        .map((group) => Array.isArray(group) ? group.map((task) => transformCaseTaskFromNode(task, executionMap, bindingsMap)) : [])
        .flat()
        .map((task) => ({ ...task, stageId: node.id, stageName: node?.data?.label || `Stage ${index + 1}` }));

      return {
        id: node.id || `stage-${index + 1}`,
        name: node?.data?.label || `Stage ${index + 1}`,
        sla: node?.data?.sla || null,
        status: execution?.status || CASE_NOT_STARTED_STATUS,
        startedTime: execution?.startedTime || '',
        completedTime: execution?.completedTime || '',
        isCurrent: false,
        tasks,
      };
    });
};

const getStageStatusRank = (status) => {
  const normalized = normalizeField(status);
  if (normalized.includes('fault') || normalized.includes('fail')) return 4;
  if (normalized.includes('running') || normalized.includes('progress') || normalized.includes('active') || normalized.includes('pause')) return 3;
  if (normalized.includes('notstarted') || normalized.includes('pending')) return 2;
  if (normalized.includes('complete') || normalized.includes('success')) return 1;
  return 0;
};

export const inferCurrentStageName = (stages = []) => {
  const activeStage = stages.find((stage) => getStageStatusRank(stage.status) === 3);
  if (activeStage?.name) return activeStage.name;
  const firstPending = stages.find((stage) => getStageStatusRank(stage.status) === 2);
  if (firstPending?.name) return firstPending.name;
  const latestStarted = [...stages]
    .filter((stage) => stage.startedTime)
    .sort((a, b) => toTimestamp(b.startedTime) - toTimestamp(a.startedTime))[0];
  return latestStarted?.name || '';
};

export const normalizeActionTask = (task) => {
  const assignedUser = task?.AssignedToUser || task?.assignedToUser || null;
  const taskSlaDetail = task?.TaskSlaDetail || task?.taskSlaDetail || null;
  const tags = Array.isArray(task?.Tags || task?.tags) ? (task.Tags || task.tags) : [];
  const stageTag = tags.find((tag) => normalizeField(tag?.Name || tag?.name).includes('stage'))
    || tags.find((tag) => normalizeField(tag?.DisplayName || tag?.displayName).includes('stage'));

  return {
    id: String(task?.Id ?? task?.id ?? task?.Key ?? task?.key ?? ''),
    name: String(task?.Title ?? task?.title ?? ''),
    status: String(task?.Status ?? task?.status ?? ''),
    taskState: String(task?.Status ?? task?.status ?? ''),
    type: String(task?.Type ?? task?.type ?? ''),
    assignee: assignedUser?.DisplayName || assignedUser?.displayName || task?.TaskAssigneeName || task?.taskAssigneeName || 'Unassigned',
    dueDate: taskSlaDetail?.ExpiryTime || taskSlaDetail?.expiryTime || '',
    slaStatus: normalizeSlaStatus(taskSlaDetail?.Status || taskSlaDetail?.status || ''),
    startedTime: String(task?.CreatedTime ?? task?.createdTime ?? ''),
    completedTime: String(task?.CompletedTime ?? task?.completedTime ?? ''),
    stageName: stageTag?.DisplayValue || stageTag?.displayValue || '',
    stageId: '',
    activities: Array.isArray(task?.Activities || task?.activities) ? (task.Activities || task.activities) : [],
    externalLink: task.ExternalLink || task.externalLink || '',
  };
};

export const buildActivityFromExecutionHistory = (executionHistory, actionTasks = []) => {
  const events = [];
  const elementExecutions = Array.isArray(executionHistory?.elementExecutions) ? executionHistory.elementExecutions : [];

  elementExecutions.forEach((execution) => {
    if (execution?.startedTime) {
      events.push({
        id: `exec-start-${execution.elementId}`,
        title: `Started ${execution.elementName || 'Step'}`,
        time: execution.startedTime,
        actor: execution.externalLink ? 'User' : 'Automation',
        status: execution.status,
        details: '',
        source: 'execution',
      });
    }
    if (execution?.completedTime) {
      events.push({
        id: `exec-end-${execution.elementId}`,
        title: `${String(execution.status || '').toLowerCase().includes('complete') ? 'Completed' : execution.status || 'Updated'} ${execution.elementName || 'Step'}`,
        time: execution.completedTime,
        actor: execution.externalLink ? 'User' : 'Automation',
        status: execution.status,
        details: '',
        source: 'execution',
      });
    }
  });

  actionTasks.forEach((task) => {
    (task.activities || []).forEach((activity, index) => {
      events.push({
        id: `task-activity-${task.id}-${index + 1}`,
        title: activity?.ActivityType || activity?.activityType || task.name || 'Task',
        time: activity?.CreatedTime || activity?.createdTime || task.startedTime || '',
        actor: task.assignee || 'User',
        status: task.status,
        details: task.name || '',
        source: 'task',
      });
    });
  });

  return events.sort((a, b) => toTimestamp(b.time) - toTimestamp(a.time));
};

export const resolveEntityByConfiguredName = (entities, configuredName, tokenHints = []) => {
  const configuredRaw = String(configuredName || '').trim();
  const configuredLower = configuredRaw.toLowerCase();
  const normalizedConfigured = normalizeField(configuredName);
  const normalizedHints = tokenHints.map((hint) => normalizeField(hint)).filter(Boolean);

  const getNameCandidates = (entity) => [entity?.name, entity?.displayName].map((value) => String(value || '').trim()).filter(Boolean);

  if (configuredRaw) {
    const strict = entities.find((entity) => {
      const candidates = getNameCandidates(entity);
      return candidates.some((value) => value === configuredRaw || value.toLowerCase() === configuredLower);
    });
    if (strict) return strict;
    return null;
  }

  const exact = entities.find((entity) => {
    const candidates = getNameCandidates(entity).map(normalizeField);
    return candidates.includes(normalizedConfigured);
  });
  if (exact) return exact;

  const containsConfigured = entities.find((entity) => {
    const candidates = getNameCandidates(entity).map(normalizeField);
    return candidates.some((value) => value.includes(normalizedConfigured) || normalizedConfigured.includes(value));
  });
  if (containsConfigured) return containsConfigured;

  if (!normalizedHints.length) return null;

  return entities.find((entity) => {
    const candidates = getNameCandidates(entity).map(normalizeField);
    return candidates.some((value) => normalizedHints.every((hint) => value.includes(hint)));
  }) || null;
};

export const buildMainCaseIndex = (records) => {
  const index = new Map();
  for (const record of records) {
    const caseId = getCaseIdFromRecord(record);
    const oCaseId = getStringField(record, ['oCaseID', 'oCaseId', 'OCaseID', 'OCaseId']);
    const caseIdPattern = findCaseIdPattern(record);
    const caseReference = findValueByKeyTokens(record, ['caseid', 'referenceid', 'businesskey', 'casenumber']);
    const linkedInstanceId = findValueByKeyTokens(record, ['instanceid', 'processinstanceid', 'workflowinstanceid']);
    const entityId = getEntityRecordId(record);
    if (caseId) index.set(normalizeToken(caseId), record);
    if (oCaseId) index.set(normalizeToken(oCaseId), record);
    if (caseIdPattern) index.set(normalizeToken(caseIdPattern), record);
    if (caseReference) index.set(normalizeToken(caseReference), record);
    if (linkedInstanceId) index.set(normalizeToken(linkedInstanceId), record);
    if (entityId) index.set(normalizeToken(entityId), record);
  }
  return index;
};

export const enrichInstanceWithMainCase = (instance, mainCaseRecords, mainCaseIndex) => {
  const instanceId = getStringField(instance, ['instanceId', 'id']);
  const instanceCaseRef = getStringField(instance, ['caseId', 'externalId', 'referenceId', 'businessKey', 'caseNumber']);
  const displayName = getStringField(instance, ['instanceDisplayName', 'caseTitle', 'displayName', 'name']);
  const folderKey = getStringField(instance, ['folderKey', 'folderId', 'organizationUnitId']);
  const instanceCreatedTime =
    getStringField(instance, ['startedTime', 'createdTime', 'createdAt', 'creationTime', 'startTime', 'startedAt', 'openedAt']) ||
    findValueByKeyTokens(instance, ['started', 'created', 'creation', 'opened', 'start']);
  const instanceProcessRef = getStringField(instance, ['processInstanceId', 'workflowInstanceId']);

  const candidates = [instanceId, instanceCaseRef, displayName, instanceProcessRef].map(normalizeToken).filter(Boolean);
  let matchedMainCase = candidates.map((candidate) => mainCaseIndex.get(candidate)).find(Boolean);
  if (!matchedMainCase) {
    matchedMainCase = mainCaseRecords.find((record) => scanObjectForTokens(record, candidates)) || null;
  }

  const secondaryCandidates = [
    findValueByKeyTokens(instance, ['caseid', 'referenceid', 'businesskey', 'casenumber', 'ocaseid']),
    findValueByKeyTokens(instance, ['instanceid', 'processinstanceid', 'workflowinstanceid']),
    findCaseIdPattern(instance),
  ].map(normalizeToken).filter(Boolean);

  if (!matchedMainCase && secondaryCandidates.length) {
    matchedMainCase = mainCaseRecords.find((record) => {
      const recordCandidates = [
        getCaseIdFromRecord(record),
        getStringField(record, ['oCaseID', 'oCaseId', 'OCaseID', 'OCaseId']),
        findValueByKeyTokens(record, ['caseid', 'referenceid', 'businesskey', 'casenumber']),
        findValueByKeyTokens(record, ['instanceid', 'processinstanceid', 'workflowinstanceid']),
        findCaseIdPattern(record),
      ].map(normalizeToken).filter(Boolean);
      return recordCandidates.some((value) => secondaryCandidates.includes(value));
    }) || null;
  }

  const createdTime =
    cleanPlaceholder(getStringField(matchedMainCase || {}, ['CreateTime', 'CreatedAt', 'CreationTime', 'UpdateTime'])) ||
    cleanPlaceholder(findValueByKeyTokens(matchedMainCase || {}, ['createtime', 'createdat', 'creationtime'])) ||
    cleanPlaceholder(instanceCreatedTime);

  let caseId = getStringField(matchedMainCase || {}, ['CaseID', 'caseID', 'Case_ID', 'ReferenceID', 'referenceID', 'BusinessKey', 'businessKey', 'CaseNumber']);
  if (!caseId) caseId = findCaseIdPattern(matchedMainCase || {});
  if (!caseId) caseId = findValueByKeyTokens(matchedMainCase || {}, ['caseid', 'referenceid', 'businesskey', 'casenumber']);
  if (!caseId) caseId = getCaseIdFromRecord(matchedMainCase || {});
  if (!caseId) caseId = findCaseIdPattern(instance) || instanceCaseRef;
  if (!caseId) caseId = instanceId;

  const slaStatusRaw =
    cleanPlaceholder(findRecordValueByKey(matchedMainCase || {}, 'SLAStatus', ['SLA_Status', 'SLA', 'slaStatus', 'SlaState'])) ||
    cleanPlaceholder(findValueByKeyTokens(matchedMainCase || {}, ['sla', 'deadline', 'targettime'])) ||
    cleanPlaceholder(findValueByKeyTokens(instance, ['sla'])) ||
    'N/A';
  const slaStatus = normalizeSlaStatus(slaStatusRaw) || 'N/A';

  return {
    instanceId,
    instance,
    processKey: getStringField(instance, ['processKey', 'processDefinitionKey']) || uiPathConfig.targetProcessKey,
    status: getStringField(instance, ['latestRunStatus', 'status']) || 'Unknown',
    caseId,
    folderKey,
    displayName,
    createdTime,
    slaStatus,
    mainCaseRecord: matchedMainCase,
  };
};

export const mapCaseDetail = (instanceContext, allDocumentRecords, documentsEntityName) => {
  const record = instanceContext.mainCaseRecord || {};
  const expectedDocumentCaseIds = new Set([
    instanceContext.caseId,
    getCaseIdFromRecord(record),
    getStringField(record, ['oCaseID', 'oCaseId', 'OCaseID', 'OCaseId']),
    getStringField(instanceContext.instance || {}, ['caseId', 'externalId', 'referenceId', 'businessKey', 'caseNumber']),
    findCaseIdPattern(record),
    findCaseIdPattern(instanceContext.instance || {}),
  ].map(normalizeToken).filter(Boolean));

  const documents = allDocumentRecords
    .filter((doc) => {
      const docOCaseId = normalizeToken(getStringField(doc, ['oCaseID', 'oCaseId', 'OCaseID', 'OCaseId', 'CaseID', 'caseId']));
      return Boolean(docOCaseId && expectedDocumentCaseIds.has(docOCaseId));
    })
    .map((doc) => {
      const recordId = getEntityRecordId(doc);
      const fieldName = getAttachmentFieldCandidates(doc)[0] || 'File';
      const fileName = getStringField(doc, ['FileName', 'fileName', 'DocumentName', 'documentName', 'Name']) || `document-${recordId}`;
      const fileType = getStringField(doc, ['FileType', 'fileType', 'DocumentType', 'documentType', 'type']) || 'Non spécifié';
      const query = new URLSearchParams({ entityName: documentsEntityName, fieldName, fileName });
      return {
        id: recordId || fileName,
        fileType,
        fileName,
        url: recordId ? `/api/documents/${encodeURIComponent(recordId)}?${query.toString()}` : '#',
      };
    });

  const extractStageTasks = (stage) => {
    const directTasks = Array.isArray(stage?.tasks) ? stage.tasks.flat() : [];
    const actionTasks = Array.isArray(stage?.actionTasks) ? stage.actionTasks.flat() : [];
    const activities = Array.isArray(stage?.activities) ? stage.activities.flat() : [];
    const combined = [...directTasks, ...actionTasks, ...activities].filter((item) => item && typeof item === 'object');
    const stageName = getStringField(stage, ['name', 'stageName', 'displayName']) || '';
    const stageId = getStringField(stage, ['id', 'stageId', 'key']) || '';
    return combined.map((task, index) => mapTaskLikeObject(task, index, { stageName, stageId }));
  };

  const mappedStages = (instanceContext.stages || []).map((s, index) => {
    const stageId = getStringField(s, ['id', 'stageId', 'key']) || `stage-${index + 1}`;
    const stageName = getStringField(s, ['name', 'stageName', 'displayName']) || `Stage ${index + 1}`;
    const mappedStageTasks = extractStageTasks(s);
    const extraTasksFromCaseScope = (instanceContext.tasks || []).filter((task) => {
      const taskStageId = normalizeField(task.stageId);
      const taskStageName = normalizeField(task.stageName);
      return (taskStageId && taskStageId === normalizeField(stageId))
        || (taskStageName && taskStageName === normalizeField(stageName));
    });

    return {
      id: stageId,
      name: stageName,
      status: getStringField(s, ['status', 'stageStatus', 'state']) || '',
      startedTime: getStringField(s, ['startedTime', 'startTime', 'startedAt', 'createdTime', 'createdAt']) || '',
      completedTime: getStringField(s, ['completedTime', 'endTime', 'completedAt', 'finishedTime', 'updatedAt']) || '',
      sla: s.sla || null,
      isCurrent: Boolean(s?.isCurrent || s?.current),
      tasks: [...mappedStageTasks, ...extraTasksFromCaseScope],
    };
  });

  const allTasks = [
    ...mappedStages.flatMap((stage) => stage.tasks || []),
    ...(instanceContext.tasks || []).map((task, index) => mapTaskLikeObject(task, index)),
  ];

  const uniqueTasks = [];
  const seenTaskKeys = new Set();
  allTasks.forEach((task) => {
    const key = `${normalizeField(task.id)}:${normalizeField(task.name)}:${normalizeField(task.stageName)}:${normalizeField(task.dueDate)}`;
    if (seenTaskKeys.has(key)) return;
    seenTaskKeys.add(key);
    uniqueTasks.push(task);
  });

  const taskLevelSla =
    uniqueTasks.find((task) => normalizeField(task.slaStatus || '').includes('overdue'))?.slaStatus
    || uniqueTasks.find((task) => normalizeField(task.slaStatus || '').includes('soon') || normalizeField(task.slaStatus || '').includes('later'))?.slaStatus
    || uniqueTasks.find((task) => String(task.slaStatus || '').trim())?.slaStatus
    || '';

  const normalizedSla = normalizeSlaStatus(
    instanceContext.slaStatus
    || taskLevelSla
    || findValueByKeyTokens(instanceContext.instance || {}, ['sla'])
    || findValueByKeyTokens(record || {}, ['sla'])
  ) || 'N/A';

  return {
    id: instanceContext.instanceId,
    caseId: instanceContext.caseId,
    folderKey: uiPathConfig.folderKey || instanceContext.folderKey || '',
    processKey: instanceContext.processKey,
    status: instanceContext.status,
    currentStage: instanceContext.currentStage || '',
    createdTime: instanceContext.createdTime || '',
    startedTime: instanceContext.createdTime || '',
    slaStatus: normalizedSla,
    stages: mappedStages,
    tasks: uniqueTasks,
    activity: (instanceContext.activity || []).map((item, index) => {
      const looksNormalized = item && typeof item === 'object' && ('title' in item) && ('time' in item);
      return looksNormalized ? item : mapActivityItem(item, index);
    }),
    client: {
      clientId: findRecordValueByKey(record, 'ClientID', ['ClientId', 'Client_ID']),
      name: findRecordValueByKey(record, 'Name', ['FullName']),
      birthDate: findRecordValueByKey(record, 'BirthDate'),
      scoring: findRecordValueByKey(record, 'Scoring', ['RiskScore']),
      debtRatio: findRecordValueByKey(record, 'DebtRatio', ['Debt_Ratio']),
      incomes: findRecordValueByKey(record, 'Incomes', ['Income']),
      expenses: findRecordValueByKey(record, 'Expenses', ['Expense']),
    },
    credit: {
      creditType: findRecordValueByKey(record, 'CreditType', ['TypeCredit', 'Type_Credit']),
      requestedAmount: findRecordValueByKey(record, 'RequestedAmount', ['AmountRequested', 'Requested_Amount']),
      duration: findRecordValueByKey(record, 'Duration', ['DurationMonths', 'Duration_Months']),
      finalDecision: findRecordValueByKey(record, 'FinalDecision', ['DecisionFinale']),
      paymentDate: findRecordValueByKey(record, 'PaymentDate', ['DisbursementDate']),
    },
    documents,
    executionHistory: instanceContext.executionHistory || null,
  };
};

export const getStagesData = async (token, instanceId, folderKey) => {
  try {
    const [caseJson, executionHistory] = await Promise.all([
      uiPathJsonRequestWithHeaders(token, `pims_/api/v1/cases/${instanceId}/case-json`, {}, { 'X-UIPATH-FolderKey': folderKey }),
      uiPathJsonRequestWithHeaders(token, `pims_/api/v1/element-executions/case-instances/${instanceId}`, {}, { 'X-UIPATH-FolderKey': folderKey }),
    ]);

    const stagesArray = buildStagesFromCaseDefinition(caseJson, executionHistory);
    if (!stagesArray.length) return { currentStageName: '', stages: [], executionHistory: null, caseJson: null };

    const currentStageName = inferCurrentStageName(stagesArray);
    const normalizedStages = stagesArray.map((stage) => ({ ...stage, isCurrent: stage.name === currentStageName }));
    return { currentStageName, stages: normalizedStages, executionHistory, caseJson };
  } catch (error) {
    console.warn(`getStagesData error for ${instanceId}:`, error.message);
    return { currentStageName: '', stages: [], executionHistory: null, caseJson: null };
  }
};

export const getCaseTasksData = async (token, instanceId, folderKey) => {
  try {
    const response = await uiPathJsonRequestWithHeaders(
      token,
      'orchestrator_/odata/Tasks/UiPath.Server.Configuration.OData.GetTasksAcrossFolders',
      {
        '$filter': `Tags/any(tags:tags/DisplayName eq '${instanceId}') and (IsDeleted eq false)`,
        '$expand': 'AssignedToUser,Activities',
        '$top': 100, '$skip': 0, '$count': true,
      },
      folderKey ? { 'X-UIPATH-FolderKey': folderKey } : {},
    );
    return extractItems(response).filter((task) => task && typeof task === 'object').map(normalizeActionTask);
  } catch (error) {
    console.warn(`getCaseTasksData error for ${instanceId}:`, error.message);
    return [];
  }
};

export const getCaseActivityData = async (token, instanceId, folderKey) => {
  try {
    const executionHistory = await uiPathJsonRequestWithHeaders(
      token,
      `pims_/api/v1/element-executions/case-instances/${instanceId}`,
      {},
      { 'X-UIPATH-FolderKey': folderKey },
    );
    const actionTasks = await getCaseTasksData(token, instanceId, folderKey);
    return buildActivityFromExecutionHistory(executionHistory, actionTasks);
  } catch (error) {
    console.warn(`getCaseActivityData error for ${instanceId}:`, error.message);
    return [];
  }
};

export const getCurrentStage = async (token, instanceId, folderKey) => {
  const { currentStageName } = await getStagesData(token, instanceId, folderKey);
  return currentStageName;
};
