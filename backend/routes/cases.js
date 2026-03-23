import { Router } from 'express';
import { uiPathConfig, hasUiPathBaseConfig, hasClientCredentials } from '../config/uipath.js';
import { cases, getMockList } from '../mock/data.js';
import {
  getBearerTokenFromRequest,
  resolveAuthToken,
  uiPathJsonRequest,
} from '../lib/uipath-client.js';
import { extractItems } from '../lib/data-mappers.js';
import { fetchUiPathData } from '../lib/fetch-uipath-data.js';
import { getCurrentStage } from '../lib/case-processors.js';

const router = Router();

router.post('/debug/uipath-data', async (req, res) => {
  try {
    if (!hasUiPathBaseConfig()) {
      return res.status(400).json({ message: 'UiPath config incomplete' });
    }

    const token = req.body?.token || getBearerTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: 'No token provided in body or header' });
    }

    const [processesResponse, instancesResponse, entitiesResponse] = await Promise.all([
      uiPathJsonRequest(token, 'pims_/api/v1/processes/summary', { processType: 'CaseManagement' }),
      uiPathJsonRequest(token, 'pims_/api/v1/instances', { processType: 'CaseManagement', pageSize: 5 }),
      uiPathJsonRequest(token, 'datafabric_/api/Entity'),
    ]);

    const instances = instancesResponse?.instances || [];
    const entities = extractItems(entitiesResponse);
    const mainCaseEntity = entities.find((item) => item.name === uiPathConfig.mainCaseEntityName);

    let mainCaseRecords = [];
    if (mainCaseEntity?.id) {
      const mainCaseResponse = await uiPathJsonRequest(
        token,
        `datafabric_/api/EntityService/entity/${mainCaseEntity.id}/read`,
        { limit: 5, start: 0, expansionLevel: 2 },
      );
      mainCaseRecords = extractItems(mainCaseResponse);
    }

    const firstInstance = instances[0] || {};
    const firstMainCase = mainCaseRecords[0] || {};
    const firstStagesCall = instances.length > 0
      ? await getCurrentStage(token, instances[0].instanceId, uiPathConfig.folderKey)
      : '';

    res.json({
      message: 'Debug data - inspect structure',
      firstInstance: {
        keys: Object.keys(firstInstance),
        sample: firstInstance,
      },
      firstMainCase: {
        keys: Object.keys(firstMainCase),
        sample: firstMainCase,
      },
      firstStagesCallResult: firstStagesCall,
    });
  } catch (error) {
    res.status(502).json({ message: `Debug error: ${error.message}` });
  }
});

router.get('/cases', async (req, res) => {
  try {
    if (!hasUiPathBaseConfig()) {
      res.json(getMockList());
      return;
    }

    if (!getBearerTokenFromRequest(req) && !hasClientCredentials()) {
      res.status(401).json({
        message: 'Mode UiPath actif mais aucun token OAuth fourni. Envoie Authorization: Bearer <token> ou configure UIPATH_CLIENT_SECRET.',
      });
      return;
    }

    const token = await resolveAuthToken(req);
    const data = await fetchUiPathData(token);
    res.json(data.list);
  } catch (error) {
    console.error('ERROR /api/cases:', error.message, error.stack);
    res.status(502).json({ message: `Erreur backend UiPath: ${error.message}` });
  }
});

router.get('/cases/:id', async (req, res) => {
  try {
    if (!hasUiPathBaseConfig()) {
      const mockFound = cases.find((item) => item.id === req.params.id);
      if (!mockFound) {
        res.status(404).json({ message: 'Case introuvable' });
        return;
      }
      res.json(mockFound);
      return;
    }

    if (!getBearerTokenFromRequest(req) && !hasClientCredentials()) {
      res.status(401).json({
        message: 'Mode UiPath actif mais aucun token OAuth fourni. Envoie Authorization: Bearer <token> ou configure UIPATH_CLIENT_SECRET.',
      });
      return;
    }

    const token = await resolveAuthToken(req);
    const data = await fetchUiPathData(token);
    const found = data.detailById.get(req.params.id);
    if (!found) {
      res.status(404).json({ message: 'Case introuvable' });
      return;
    }
    res.json(found);
  } catch (error) {
    res.status(502).json({ message: `Erreur backend UiPath: ${error.message}` });
  }
});

export default router;
