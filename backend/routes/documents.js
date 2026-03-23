import { Router } from 'express';
import { uiPathConfig, hasUiPathBaseConfig, hasClientCredentials } from '../config/uipath.js';
import {
  buildUiPathUrl,
  getBearerTokenFromRequest,
  resolveAuthToken,
} from '../lib/uipath-client.js';

const router = Router();

router.get('/documents/:recordId', async (req, res) => {
  try {
    if (!hasUiPathBaseConfig()) {
      res.status(400).json({ message: 'Téléchargement document disponible uniquement en mode UiPath réel.' });
      return;
    }

    if (!getBearerTokenFromRequest(req) && !hasClientCredentials()) {
      res.status(401).json({
        message: 'Mode UiPath actif mais aucun token OAuth fourni. Envoie Authorization: Bearer <token> ou configure UIPATH_CLIENT_SECRET.',
      });
      return;
    }

    const { recordId } = req.params;
    const entityName = String(req.query.entityName || uiPathConfig.caseDocumentsEntityName);
    const fieldName = String(req.query.fieldName || 'File');
    const fileName = String(req.query.fileName || `${recordId}.pdf`);

    const token = await resolveAuthToken(req);
    const url = buildUiPathUrl(`datafabric_/api/Attachment/${entityName}/${recordId}/${fieldName}`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ message: `Erreur document UiPath: ${text}` });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    res.status(502).json({ message: `Erreur backend document UiPath: ${error.message}` });
  }
});

export default router;
