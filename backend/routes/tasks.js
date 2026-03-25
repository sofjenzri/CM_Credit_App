import { Router } from 'express';
import { hasClientCredentials, hasUiPathBaseConfig, uiPathConfig } from '../config/uipath.js';
import {
  getBearerTokenFromRequest,
  resolveAuthToken,
  uiPathJsonRequestWithHeaders,
  uiPathRequest,
} from '../lib/uipath-client.js';

const router = Router();

const buildFolderHeaders = () => (
  uiPathConfig.folderKey ? { 'X-UIPATH-FolderKey': uiPathConfig.folderKey } : {}
);

const buildServiceUrl = () => (
  `${uiPathConfig.baseUrl}/${uiPathConfig.orgName}/${uiPathConfig.tenantName}/orchestrator_`
);

const parseTaskId = (rawTaskId) => {
  const value = String(rawTaskId || '').trim();
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
};

const decodeJwtPayload = (token) => {
  try {
    const [, payload = ''] = String(token || '').split('.');
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (_error) {
    return {};
  }
};

const ensureUiPathTaskAccess = async (req, res) => {
  if (!hasUiPathBaseConfig()) {
    res.status(400).json({ message: 'Mode mock actif: les actions sur AppTasks ne sont disponibles qu’en mode UiPath.' });
    return null;
  }

  if (!getBearerTokenFromRequest(req) && !hasClientCredentials()) {
    res.status(401).json({
      message: 'Mode UiPath actif mais aucun token OAuth fourni. Envoie Authorization: Bearer <token> ou configure UIPATH_CLIENT_SECRET.',
    });
    return null;
  }

  return resolveAuthToken(req);
};

router.get('/tasks/:taskId', async (req, res) => {
  const taskId = parseTaskId(req.params.taskId);
  if (taskId === null) {
    res.status(400).json({ message: 'taskId invalide. Un entier UiPath est attendu.' });
    return;
  }

  try {
    const token = await ensureUiPathTaskAccess(req, res);
    if (!token) return;

    const task = await uiPathJsonRequestWithHeaders(
      token,
      `orchestrator_/odata/Tasks(${taskId})`,
      {},
      buildFolderHeaders(),
    );

    res.json(task);
  } catch (error) {
    res.status(502).json({ message: `Erreur backend UiPath: ${error.message}` });
  }
});

router.get('/tasks/:taskId/form', async (req, res) => {
  const taskId = parseTaskId(req.params.taskId);
  if (taskId === null) {
    res.status(400).json({ message: 'taskId invalide. Un entier UiPath est attendu.' });
    return;
  }

  try {
    const token = await ensureUiPathTaskAccess(req, res);
    if (!token) return;

    const form = await uiPathJsonRequestWithHeaders(
      token,
      'orchestrator_/forms/TaskForms/GetTaskFormById',
      { taskId },
      buildFolderHeaders(),
    );

    res.json(form);
  } catch (error) {
    res.status(502).json({ message: `Erreur backend UiPath: ${error.message}` });
  }
});

router.post('/tasks/:taskId/assign-self', async (req, res) => {
  const taskId = parseTaskId(req.params.taskId);
  if (taskId === null) {
    res.status(400).json({ message: 'taskId invalide. Un entier UiPath est attendu.' });
    return;
  }

  try {
    const token = await ensureUiPathTaskAccess(req, res);
    if (!token) return;

    const task = await uiPathJsonRequestWithHeaders(
      token,
      `orchestrator_/odata/Tasks(${taskId})`,
      {},
      buildFolderHeaders(),
    );

    const rawBearerToken = getBearerTokenFromRequest(req);
    const jwtPayload = decodeJwtPayload(rawBearerToken);
    const userNameOrEmail = String(
      jwtPayload.preferred_username
      || jwtPayload.email
      || jwtPayload.name
      || '',
    ).trim();

    if (!userNameOrEmail) {
      res.status(204).send();
      return;
    }

    const taskAssigneeName = String(task?.TaskAssigneeName || '').trim().toLowerCase();
    if (taskAssigneeName && taskAssigneeName.includes(userNameOrEmail.toLowerCase())) {
      res.status(204).send();
      return;
    }

    const response = await uiPathRequest(
      token,
      'orchestrator_/odata/Tasks/UiPath.Server.Configuration.OData.AssignTasks',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildFolderHeaders(),
        },
        body: JSON.stringify({
          taskAssignments: [
            {
              TaskId: taskId,
              UserNameOrEmail: userNameOrEmail,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      res.status(204).send();
      return;
    }

    const assignmentErrors = Array.isArray(response.json?.value) ? response.json.value : [];
    const blockingError = assignmentErrors.find((item) => Number(item?.ErrorCode || 0) !== 2400);
    if (blockingError) {
      res.status(204).send();
      return;
    }

    res.status(204).send();
  } catch (_error) {
    res.status(204).send();
  }
});

router.post('/tasks/:taskId/complete', async (req, res) => {
  const taskId = parseTaskId(req.params.taskId);
  if (taskId === null) {
    res.status(400).json({ message: 'taskId invalide. Un entier UiPath est attendu.' });
    return;
  }

  const action = String(req.body?.action || '').trim();
  const data = req.body?.data ?? req.body?.taskData ?? req.body?.outputData ?? {};

  if (!action) {
    res.status(400).json({ message: "Le champ 'action' est requis pour compléter la tâche (ex: submit)." });
    return;
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    res.status(400).json({ message: "Le champ 'data' doit être un objet JSON contenant les valeurs de sortie." });
    return;
  }

  try {
    const token = await ensureUiPathTaskAccess(req, res);
    if (!token) return;

    const task = await uiPathJsonRequestWithHeaders(
      token,
      `orchestrator_/odata/Tasks(${taskId})`,
      {},
      buildFolderHeaders(),
    );

    const taskType = String(task?.Type || '').trim();
    const completionPath = taskType === 'AppTask'
      ? 'bupproxyservice_/orchestrator/tasks/AppTasks/CompleteAppTask'
      : 'orchestrator_/forms/TaskForms/CompleteTask';

    const response = await uiPathRequest(token, completionPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildFolderHeaders(),
        ...(taskType === 'AppTask' ? { ServiceUrl: buildServiceUrl() } : {}),
      },
      body: JSON.stringify({
        taskId,
        action,
        data,
      }),
    });

    if (!response.ok) {
      res.status(502).json({
        message: `Erreur backend UiPath: impossible de compléter la tâche ${taskId}.`,
        details: response.text,
        status: response.status,
      });
      return;
    }

    if (response.json) {
      res.json(response.json);
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(502).json({ message: `Erreur backend UiPath: ${error.message}` });
  }
});

export default router;
