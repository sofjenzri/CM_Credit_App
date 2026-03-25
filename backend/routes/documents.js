import { Router } from 'express';
import { uiPathConfig, hasUiPathBaseConfig, hasClientCredentials } from '../config/uipath.js';
import {
  buildUiPathUrl,
  getBearerTokenFromRequest,
  resolveAuthToken,
  uiPathJsonRequest,
  uiPathJsonRequestWithoutFolderContext,
} from '../lib/uipath-client.js';
import { extractItems } from '../lib/data-mappers.js';
import { resolveEntityByConfiguredName } from '../lib/case-processors.js';
import { upload } from '../middleware/upload.js';
import {
  createEntityRecord,
  deleteEntityRecordById,
  getEntitySampleRecord,
  mapDocumentValuesToEntityColumns,
  updateDocumentFieldsByRecordId,
  uploadEntityAttachment,
} from '../lib/entity-operations.js';

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

router.post('/cases/:caseId/documents', upload.single('document'), async (req, res) => {
  try {
    if (!hasUiPathBaseConfig()) {
      res.status(400).json({ message: 'Upload document disponible uniquement en mode UiPath réel.' });
      return;
    }

    if (!getBearerTokenFromRequest(req) && !hasClientCredentials()) {
      res.status(401).json({
        message: 'Mode UiPath actif mais aucun token OAuth fourni. Envoie Authorization: Bearer <token> ou configure UIPATH_CLIENT_SECRET.',
      });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'Aucun fichier fourni.' });
      return;
    }

    const caseId = String(req.params.caseId || '').trim();
    if (!caseId) {
      res.status(400).json({ message: 'caseId requis.' });
      return;
    }

    const token = await resolveAuthToken(req);

    let entitiesRaw = extractItems(await uiPathJsonRequest(token, 'datafabric_/api/Entity'));
    let documentsEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);

    if (!documentsEntity) {
      try {
        entitiesRaw = extractItems(await uiPathJsonRequestWithoutFolderContext(token, 'datafabric_/api/Entity'));
        documentsEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);
      } catch (_error) {
      }
    }

    if (!documentsEntity?.id) {
      res.status(404).json({ message: `Entité documents introuvable: ${uiPathConfig.caseDocumentsEntityName}` });
      return;
    }

    const rawFileName = String(req.body?.fileName || file.originalname || 'document.bin').trim() || 'document.bin';
    const fileType = String(req.body?.fileType || file.mimetype || '').trim();

    const documentSampleRecord = await getEntitySampleRecord(token, documentsEntity.id);
    const sourceValues = {
      caseId,
      fileName: rawFileName,
      fileType,
    };

    const mappedDocumentPayload = mapDocumentValuesToEntityColumns(sourceValues, documentSampleRecord);
    const documentPayload = {
      ...mappedDocumentPayload,
      OCaseID: caseId,
      FileName: rawFileName,
    };

    const createdDocument = await createEntityRecord(token, documentsEntity.id, documentPayload);
    const documentRecordId = createdDocument.recordId;

    if (!documentRecordId) {
      throw new Error(`RecordId document introuvable pour ${rawFileName}`);
    }

    await uploadEntityAttachment(
      token,
      documentsEntity.name || uiPathConfig.caseDocumentsEntityName,
      documentRecordId,
      uiPathConfig.caseDocumentsAttachmentField || 'File',
      file,
    );

    try {
      await updateDocumentFieldsByRecordId(token, documentsEntity.id, documentRecordId, documentPayload);
    } catch (updateError) {
      console.warn(`WARNING document metadata update ${documentRecordId}: ${updateError.message}`);
    }

    res.status(201).json({
      id: documentRecordId,
      fileType,
      fileName: rawFileName,
      url: `/api/documents/${encodeURIComponent(documentRecordId)}?entityName=${encodeURIComponent(documentsEntity.name || uiPathConfig.caseDocumentsEntityName)}&fieldName=${encodeURIComponent(uiPathConfig.caseDocumentsAttachmentField || 'File')}&fileName=${encodeURIComponent(rawFileName)}`,
    });
  } catch (error) {
    res.status(502).json({ message: `Erreur backend document UiPath: ${error.message}` });
  }
});

router.delete('/documents/:recordId', async (req, res) => {
  try {
    if (!hasUiPathBaseConfig()) {
      res.status(400).json({ message: 'Suppression document disponible uniquement en mode UiPath réel.' });
      return;
    }

    if (!getBearerTokenFromRequest(req) && !hasClientCredentials()) {
      res.status(401).json({
        message: 'Mode UiPath actif mais aucun token OAuth fourni. Envoie Authorization: Bearer <token> ou configure UIPATH_CLIENT_SECRET.',
      });
      return;
    }

    const recordId = String(req.params.recordId || '').trim();
    if (!recordId) {
      res.status(400).json({ message: 'recordId requis.' });
      return;
    }

    const token = await resolveAuthToken(req);

    let entitiesRaw = extractItems(await uiPathJsonRequest(token, 'datafabric_/api/Entity'));
    let documentsEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);

    if (!documentsEntity) {
      try {
        entitiesRaw = extractItems(await uiPathJsonRequestWithoutFolderContext(token, 'datafabric_/api/Entity'));
        documentsEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);
      } catch (_error) {
      }
    }

    if (!documentsEntity?.id) {
      res.status(404).json({ message: `Entité documents introuvable: ${uiPathConfig.caseDocumentsEntityName}` });
      return;
    }

    await deleteEntityRecordById(token, documentsEntity.id, recordId);
    res.status(204).send();
  } catch (error) {
    res.status(502).json({ message: `Erreur backend document UiPath: ${error.message}` });
  }
});

export default router;
