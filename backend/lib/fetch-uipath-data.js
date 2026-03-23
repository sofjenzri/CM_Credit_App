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
} from './data-mappers.js';
import {
  resolveEntityByConfiguredName,
  buildMainCaseIndex,
  enrichInstanceWithMainCase,
  mapCaseDetail,
  getStagesData,
  getCaseTasksData,
  getCaseActivityData,
  inferCurrentStageName,
} from './case-processors.js';
import {
  readEntityRecordsWithFallback,
  matchesTargetCaseModel,
  matchesTargetProcessKey,
  matchesTargetFolder,
} from './entity-operations.js';
import { mapTaskLikeObject } from './data-mappers.js';

export const fetchUiPathData = async (token) => {
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
  let documentsEntity = resolveEntityByConfiguredName(entities, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);

  if (!mainCaseEntity || !documentsEntity) {
    try {
      const entitiesUnscopedResponse = await uiPathJsonRequestWithoutFolderContext(token, 'datafabric_/api/Entity');
      const entitiesUnscoped = extractItems(entitiesUnscopedResponse);
      if (entitiesUnscoped.length) {
        entities = entitiesUnscoped;
        if (!mainCaseEntity) {
          mainCaseEntity = resolveEntityByConfiguredName(entities, uiPathConfig.mainCaseEntityName, ['credit', 'main', 'case']);
        }
        if (!documentsEntity) {
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

  if (documentsEntity?.id) {
    documentRecords = await readEntityRecordsWithFallback(token, documentsEntity.id, {
      limit: 500,
      start: 0,
      expansionLevel: 2,
    });
  }

  const mainCaseIndex = buildMainCaseIndex(mainCaseRecords);
  const instanceContexts = filteredInstances.map((instance) => enrichInstanceWithMainCase(instance, mainCaseRecords, mainCaseIndex));

  console.log('DEBUG fetchUiPathData - instanceContexts[0]:', JSON.stringify(instanceContexts[0], null, 2));

  const enrichedContexts = await Promise.all(
    instanceContexts.map(async (context) => {
      const [stagesData, tasks, activity] = await Promise.all([
        getStagesData(token, context.instanceId, uiPathConfig.folderKey),
        getCaseTasksData(token, context.instanceId, uiPathConfig.folderKey),
        getCaseActivityData(token, context.instanceId, uiPathConfig.folderKey),
      ]);

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
    })
  );

  const list = enrichedContexts.map((context) => ({
    id: context.instanceId,
    caseId: context.caseId,
    processKey: context.processKey,
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
    createdTime:
      cleanPlaceholder(getStringField(context.mainCaseRecord || {}, ['CreateTime', 'CreatedAt', 'CreationTime', 'UpdateTime'])) ||
      cleanPlaceholder(findValueByKeyTokens(context.mainCaseRecord || {}, ['createtime', 'createdat', 'creationtime'])) ||
      cleanPlaceholder(context.createdTime) ||
      '',
    slaStatus: context.slaStatus || 'N/A',
  }));

  const detailById = new Map(
    enrichedContexts.map((context) => [
      context.instanceId,
      mapCaseDetail(context, documentRecords, documentsEntity?.name || uiPathConfig.caseDocumentsEntityName),
    ])
  );

  return {
    list,
    detailById,
    source: 'uipath',
    processCount: processes.length,
  };
};
