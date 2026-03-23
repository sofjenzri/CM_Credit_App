import { Router } from 'express';
import { uiPathConfig, hasUiPathBaseConfig, hasClientCredentials } from '../config/uipath.js';
import { getBearerTokenFromRequest } from '../lib/uipath-client.js';

const router = Router();

router.get('/health', (_req, res) => {
  const source = hasUiPathBaseConfig() ? 'uipath' : 'mock';
  res.json({ ok: true, source });
});

router.get('/source', (req, res) => {
  const hasBearer = Boolean(getBearerTokenFromRequest(req));
  const mode = hasUiPathBaseConfig() ? 'uipath' : 'mock';
  const authMode = hasBearer ? 'oauth-bearer-header' : hasClientCredentials() ? 'client-credentials' : 'none';

  res.json({
    mode,
    authMode,
    targetProcessKey: uiPathConfig.targetProcessKey,
    targetCaseModelId: uiPathConfig.targetCaseModelId,
    mainCaseEntityName: uiPathConfig.mainCaseEntityName,
    caseDocumentsEntityName: uiPathConfig.caseDocumentsEntityName,
    folderKey: uiPathConfig.folderKey,
  });
});

export default router;
