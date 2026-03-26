import { uiPathConfig } from '../config/uipath.js';
import { uiPathJsonRequest, uiPathJsonRequestWithoutFolderContext } from './uipath-client.js';
import {
  normalizeSlaStatus,
  getStringField,
  cleanPlaceholder,
  findValueByKeyTokens,
  findRecordValueByKey,
  extractItems,
  isActiveProgressStatus,
  normalizeToken,
} from './data-mappers.js';
import {
  resolveEntityByConfiguredName,
  buildMainCaseIndex,
  enrichInstanceWithMainCase,
  mapCaseDetail,
  getStagesData,
  getCaseTasksData,
  buildActivityFromExecutionHistory,
  inferCurrentStageName,
} from './case-processors.js';
import {
  readEntityRecordsWithFallback,
  matchesTargetCaseModel,
  matchesTargetProcessKey,
  matchesTargetFolder,
} from './entity-operations.js';
import { mapTaskLikeObject } from './data-mappers.js';

const isCompletedTaskStatus = (status = '', taskState = '') => {
  const normalized = `${String(status)} ${String(taskState)}`.toLowerCase();
  return normalized.includes('complete') || normalized.includes('done') || normalized.includes('executed') || normalized.includes('closed') || normalized.includes('finish');
};

const isCurrentTaskStatus = (status = '', taskState = '') => {
  const normalized = `${String(status)} ${String(taskState)}`.toLowerCase();
  return normalized.includes('running')
    || normalized.includes('progress')
    || normalized.includes('active')
    || normalized.includes('open')
    || normalized.includes('assigned')
    || normalized.includes('unassigned')
    || normalized.includes('pending');
};

const pickCurrentActivityLabel = (context) => {
  const normalizedTasks = (context.tasks || []).map((task) => mapTaskLikeObject(task));
  const currentTask = normalizedTasks.find((task) => isCurrentTaskStatus(task.status, task.taskState) && !isCompletedTaskStatus(task.status, task.taskState));
  if (currentTask?.name) return currentTask.name;

  const currentStageName = String(context.currentStage || '').trim();
  if (currentStageName) return `Etape ${currentStageName}`;

  return context.status || '-';
};

const isAppTaskType = (type = '') => {
  const normalized = String(type).toLowerCase();
  return normalized.includes('apptask') || normalized === 'apptask' || normalized.includes('app');
};

const pickCurrentActivityType = (context) => {
  const normalizedTasks = (context.tasks || []).map((task) => mapTaskLikeObject(task));
  const currentTask = normalizedTasks.find((task) => isCurrentTaskStatus(task.status, task.taskState) && !isCompletedTaskStatus(task.status, task.taskState));
  if (currentTask?.type && isAppTaskType(currentTask.type)) return 'AppTask';
  return currentTask?.type || '';
};

const pickCurrentTaskId = (context) => {
  const normalizedTasks = (context.tasks || []).map((task) => mapTaskLikeObject(task));
  const currentTask = normalizedTasks.find((task) => isCurrentTaskStatus(task.status, task.taskState) && !isCompletedTaskStatus(task.status, task.taskState));
  return currentTask?.id || '';
};

export const fetchUiPathData = async (token) => {
  const {
    processes,
    instanceContexts,
    documentRecords,
    documentsEntityName,
  } = await fetchUiPathBaseData(token);

  const enrichedContexts = await Promise.all(
    instanceContexts.map((context) => enrichContextWithRuntimeData(token, context))
  );

  const list = enrichedContexts.map(mapContextToListItem);

  const detailById = new Map(
    enrichedContexts.map((context) => [
      context.instanceId,
      mapCaseDetail(context, documentRecords, documentsEntityName),
    ])
  );

  return {
    list,
    detailById,
    source: 'uipath',
    processCount: processes.length,
  };
};

export const fetchUiPathCaseList = async (token) => {
  const {
    processes,
    instanceContexts,
  } = await fetchUiPathBaseData(token, { includeDocuments: false });

  const enrichedContexts = await Promise.all(
    instanceContexts.map((context) => enrichContextForList(token, context))
  );

  return {
    list: enrichedContexts.map(mapContextToListItem),
    source: 'uipath',
    processCount: processes.length,
  };
};

export const fetchUiPathCaseDetail = async (token, requestedId) => {
  const normalizedRequestedId = normalizeToken(requestedId);
  const {
    instanceContexts,
    documentRecords,
    documentsEntityName,
  } = await fetchUiPathBaseData(token);

  const matchingContext = instanceContexts.find((context) => (
    normalizeToken(context.instanceId) === normalizedRequestedId
    || normalizeToken(context.caseId) === normalizedRequestedId
  ));

  if (!matchingContext) {
    return null;
  }

  const enrichedContext = await enrichContextWithRuntimeData(token, matchingContext);
  return mapCaseDetail(enrichedContext, documentRecords, documentsEntityName);
};

const fetchUiPathBaseData = async (token, options = {}) => {
  const { includeDocuments = true } = options;
  const [processesResponse, instancesResponse, entitiesResponse] = await Promise.all([
    uiPathJsonRequest(token, 'pims_/api/v1/processes/summary', { processType: 'CaseManagement' }),
    uiPathJsonRequest(token, 'pims_/api/v1/instances', { processType: 'CaseManagement', pageSize: 200 }),
    uiPathJsonRequest(token, 'datafabric_/api/Entity'),
  ]);

  const processes = processesResponse?.processes || [];
  const instances = instancesResponse?.instances || [];
  let entities = extractItems(entitiesResponse);
  const filteredInstances = instances.filter((instance) => (
    matchesTargetProcessKey(instance)
    && matchesTargetCaseModel(instance)
    && matchesTargetFolder(instance)
  ));

  let mainCaseEntity = resolveEntityByConfiguredName(entities, uiPathConfig.mainCaseEntityName, ['credit', 'main', 'case']);
  let documentsEntity = includeDocuments
    ? resolveEntityByConfiguredName(entities, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document'])
    : null;

  if (!mainCaseEntity || (includeDocuments && !documentsEntity)) {
    try {
      const entitiesUnscopedResponse = await uiPathJsonRequestWithoutFolderContext(token, 'datafabric_/api/Entity');
      const entitiesUnscoped = extractItems(entitiesUnscopedResponse);
      if (entitiesUnscoped.length) {
        entities = entitiesUnscoped;
        if (!mainCaseEntity) {
          mainCaseEntity = resolveEntityByConfiguredName(entities, uiPathConfig.mainCaseEntityName, ['credit', 'main', 'case']);
        }
        if (includeDocuments && !documentsEntity) {
          documentsEntity = resolveEntityByConfiguredName(entities, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);
        }
      }
    } catch (_error) {
    }
  }

  console.log('DEBUG fetchUiPathData - mainCaseEntity found:', !!mainCaseEntity, mainCaseEntity?.name);
  console.log('DEBUG fetchUiPathData - documentsEntity found:', !!documentsEntity, documentsEntity?.name);

  let mainCaseRecords = [];
  let documentRecords = [];

  if (mainCaseEntity?.id) {
    mainCaseRecords = await readEntityRecordsWithFallback(token, mainCaseEntity.id, {
      limit: 500,
      start: 0,
      expansionLevel: 2,
    });
    console.log('DEBUG fetchUiPathData - mainCaseRecords count:', mainCaseRecords.length);
  }

  if (includeDocuments && documentsEntity?.id) {
    documentRecords = await readEntityRecordsWithFallback(token, documentsEntity.id, {
      limit: 500,
      start: 0,
      expansionLevel: 2,
    });
  }

  const mainCaseIndex = buildMainCaseIndex(mainCaseRecords);
  const instanceContexts = filteredInstances.map((instance) => enrichInstanceWithMainCase(instance, mainCaseRecords, mainCaseIndex));

  console.log('DEBUG fetchUiPathData - instanceContexts[0]:', JSON.stringify(instanceContexts[0], null, 2));

  return {
    processes,
    instanceContexts,
    documentRecords,
    documentsEntityName: documentsEntity?.name || uiPathConfig.caseDocumentsEntityName,
  };
};

const enrichContextForList = async (token, context) => {
  const tasks = await getCaseTasksData(token, context.instanceId, uiPathConfig.folderKey);
  const currentStageFromTasks = tasks
    .map((task) => mapTaskLikeObject(task))
    .find((task) => isActiveProgressStatus(task.taskState || task.status))?.stageName || '';

  const derivedSla = normalizeSlaStatus(
    context.slaStatus
    || tasks.find((task) => String(task.slaStatus || '').trim())?.slaStatus
    || ''
  ) || 'N/A';

  return {
    ...context,
    currentStage: currentStageFromTasks || context.currentStage || '',
    tasks,
    slaStatus: derivedSla,
  };
};

const enrichContextWithRuntimeData = async (token, context) => {
  const [stagesData, tasks] = await Promise.all([
    getStagesData(token, context.instanceId, uiPathConfig.folderKey),
    getCaseTasksData(token, context.instanceId, uiPathConfig.folderKey),
  ]);

  const activity = buildActivityFromExecutionHistory(stagesData.executionHistory, tasks);
  const currentStageFromTasks = tasks
    .map((task) => mapTaskLikeObject(task))
    .find((task) => isActiveProgressStatus(task.taskState || task.status))?.stageName || '';

  const currentStageFromExecution = inferCurrentStageName(stagesData.stages || []);

  const derivedSla = normalizeSlaStatus(
    context.slaStatus
    || tasks.find((task) => String(task.slaStatus || '').trim())?.slaStatus
    || ''
  ) || 'N/A';

  return {
    ...context,
    currentStage: stagesData.currentStageName || currentStageFromTasks || currentStageFromExecution || context.currentStage || '',
    stages: stagesData.stages,
    tasks,
    activity,
    executionHistory: stagesData.executionHistory,
    caseJson: stagesData.caseJson,
    slaStatus: derivedSla,
  };
};

const mapContextToListItem = (context) => ({
  id: context.instanceId,
  caseId: context.caseId,
  processKey: context.processKey,
  processVersion: context.processVersion || '',
  status: context.status,
  currentStage: context.currentStage || '-',
  clientName: findRecordValueByKey(context.mainCaseRecord || {}, 'Name', ['FullName', 'ClientName']) || '-',
  creditType: findRecordValueByKey(context.mainCaseRecord || {}, 'CreditType', ['TypeCredit', 'Type_Credit']),
  requestedAmount: findRecordValueByKey(context.mainCaseRecord || {}, 'RequestedAmount', ['AmountRequested', 'Requested_Amount']),
  dossierStatus:
    cleanPlaceholder(getStringField(context.mainCaseRecord || {}, ['CaseStatus', 'Status', 'DossierStatus'])) ||
    cleanPlaceholder(findValueByKeyTokens(context.mainCaseRecord || {}, ['casestatus', 'dossierstatus', 'status'])) ||
    context.status ||
    '-',
  currentActivityLabel: pickCurrentActivityLabel(context),
  currentActivityType: pickCurrentActivityType(context),
  currentTaskId: pickCurrentTaskId(context),
  createdTime:
    cleanPlaceholder(getStringField(context.mainCaseRecord || {}, ['CreateTime', 'CreatedAt', 'CreationTime', 'UpdateTime'])) ||
    cleanPlaceholder(findValueByKeyTokens(context.mainCaseRecord || {}, ['createtime', 'createdat', 'creationtime'])) ||
    cleanPlaceholder(context.createdTime) ||
    '',
  slaStatus: context.slaStatus || 'N/A',
});
