import { Router } from 'express';
import { uiPathConfig, hasUiPathBaseConfig, hasClientCredentials } from '../config/uipath.js';
import { upload } from '../middleware/upload.js';
import {
  getBearerTokenFromRequest,
  resolveAuthToken,
  uiPathJsonRequest,
  uiPathJsonRequestWithoutFolderContext,
} from '../lib/uipath-client.js';
import { extractItems } from '../lib/data-mappers.js';
import { resolveEntityByConfiguredName } from '../lib/case-processors.js';
import {
  createEntityRecord,
  getEntitySampleRecord,
  insertThenUpdateCaseId,
  mapDocumentValuesToEntityColumns,
  mapValuesToEntityColumns,
  updateDocumentFieldsByRecordId,
  uploadEntityAttachment,
} from '../lib/entity-operations.js';

const router = Router();

const parseNumeric = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value)
    .replace(/\s/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickFirst = (...values) => values.find((value) => (
  value !== undefined &&
  value !== null &&
  String(value).trim() !== ''
));

router.post('/loan-requests', upload.array('documents', 20), async (req, res) => {
  try {
    const payloadRaw = req.body?.payload;
    const formPayload = typeof payloadRaw === 'string' ? JSON.parse(payloadRaw) : (payloadRaw || req.body || {});
    const documents = Array.isArray(req.files) ? req.files : [];

    if (!formPayload || typeof formPayload !== 'object') {
      return res.status(400).json({ message: 'Payload formulaire invalide.' });
    }

    const requestedAmount = parseNumeric(pickFirst(
      formPayload.requestedAmount,
      formPayload.loanAmount,
      formPayload?.loanDetails?.requestedAmount,
      formPayload?.loanDetails?.loanAmount,
    ));
    const durationMonths = parseNumeric(pickFirst(
      formPayload.durationMonths,
      formPayload?.loanDetails?.durationMonths,
      formPayload?.loanDetails?.loanDurationMonths,
    ));
    const loanPurpose = String(pickFirst(
      formPayload.loanPurpose,
      formPayload?.loanDetails?.loanPurpose,
      formPayload?.loanDetails?.purpose,
    ) || '').trim();

    if (!loanPurpose || requestedAmount <= 0) {
      return res.status(400).json({ message: 'Objet du prêt et montant demandé sont obligatoires.' });
    }

    const generatedCaseId = `WEB-${String(Date.now()).slice(-8)}`;

    if (!hasUiPathBaseConfig()) {
      return res.status(200).json({
        message: 'Données simulées: mode mock actif.',
        source: 'mock',
        caseId: generatedCaseId,
        createdDocuments: documents.length,
      });
    }

    if (!getBearerTokenFromRequest(req) && !hasClientCredentials()) {
      return res.status(401).json({
        message: 'Mode UiPath actif mais aucun token OAuth fourni. Envoie Authorization: Bearer <token> ou configure UIPATH_CLIENT_SECRET.',
      });
    }

    const token = await resolveAuthToken(req);

    let entitiesRaw = extractItems(await uiPathJsonRequest(token, 'datafabric_/api/Entity'));
    let mainCaseEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.mainCaseEntityName, ['credit', 'main', 'case']);
    let documentsEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);

    if (!mainCaseEntity || !documentsEntity) {
      try {
        entitiesRaw = extractItems(await uiPathJsonRequestWithoutFolderContext(token, 'datafabric_/api/Entity'));
        if (!mainCaseEntity) {
          mainCaseEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.mainCaseEntityName, ['credit', 'main', 'case']);
        }
        if (!documentsEntity) {
          documentsEntity = resolveEntityByConfiguredName(entitiesRaw, uiPathConfig.caseDocumentsEntityName, ['credit', 'case', 'document']);
        }
      } catch (_error) {
      }
    }

    if (!mainCaseEntity?.id) {
      return res.status(404).json({ message: `Entité principale introuvable: ${uiPathConfig.mainCaseEntityName}` });
    }
    if (!documentsEntity?.id) {
      return res.status(404).json({ message: `Entité documents introuvable: ${uiPathConfig.caseDocumentsEntityName}` });
    }

    const firstName = String(pickFirst(formPayload.firstName, formPayload?.personalInfo?.firstName) || '').trim();
    const lastName = String(pickFirst(formPayload.lastName, formPayload?.personalInfo?.lastName) || '').trim();
    const clientCode = String(pickFirst(formPayload.clientCode, formPayload.clientId, formPayload.clientRef, formPayload?.personalInfo?.clientCode) || '').trim();
    const fullName = String(pickFirst(formPayload.fullName, formPayload?.personalInfo?.fullName, `${firstName} ${lastName}`) || '').trim();
    const birthDate = String(pickFirst(formPayload.birthDate, formPayload?.personalInfo?.birthDate) || '').trim();
    const creditType = String(pickFirst(formPayload.creditType, formPayload?.loanDetails?.creditType, 'Prêt personnel') || 'Prêt personnel').trim();
    const durationValue = durationMonths > 0 ? durationMonths : 48;
    const netIncome = parseNumeric(pickFirst(formPayload.netIncome, formPayload?.income?.netIncome));
    const monthlyCharges = parseNumeric(pickFirst(formPayload.monthlyCharges, formPayload?.income?.monthlyCharges));
    const otherIncome = parseNumeric(pickFirst(formPayload.otherIncome, formPayload?.income?.otherIncome));
    const debtRatio = String(pickFirst(formPayload.debtRatio, formPayload?.income?.debtRatio) || '').trim();
    const iban = String(pickFirst(formPayload.iban, formPayload?.banking?.iban) || '').trim();
    const bankName = String(pickFirst(formPayload.bankName, formPayload?.banking?.bankName) || '').trim();
    const address = String(pickFirst(formPayload.address, formPayload?.personalInfo?.address) || '').trim();
    const city = String(pickFirst(formPayload.city, formPayload?.personalInfo?.city) || '').trim();
    const phone = String(pickFirst(formPayload.phone, formPayload?.personalInfo?.phone) || '').trim();
    const email = String(pickFirst(formPayload.email, formPayload?.personalInfo?.email) || '').trim();
    const familyStatus = String(pickFirst(formPayload.familyStatus, formPayload?.personalInfo?.familyStatus) || '').trim();
    const housingStatus = String(pickFirst(formPayload.housingStatus, formPayload?.personalInfo?.housingStatus) || '').trim();
    const profession = String(pickFirst(formPayload.jobTitle, formPayload?.employment?.jobTitle) || '').trim();
    const employer = String(pickFirst(formPayload.employer, formPayload?.employment?.employer) || '').trim();
    const contractType = String(pickFirst(formPayload.contractType, formPayload?.employment?.contractType) || '').trim();
    const seniority = String(pickFirst(formPayload.seniority, formPayload?.employment?.seniority) || '').trim();
    const consent = Boolean(pickFirst(formPayload.acceptSolvabilityStudy, formPayload?.consent?.personalData));
    const createTime = new Date().toISOString();

    const sourceValues = {
      caseId: generatedCaseId,
      clientCode,
      incomingChannel: 'WEB',
      name: fullName,
      birthDate,
      creditType,
      requestedAmount,
      duration: durationValue,
      loanPurpose,
      caseStatus: 'Initiation',
      incomes: netIncome,
      expenses: monthlyCharges,
      otherIncome,
      debtRatio,
      iban,
      bankName,
      address,
      city,
      phone,
      email,
      familyStatus,
      housingStatus,
      profession,
      employer,
      contractType,
      seniority,
      consent,
      createTime,
    };

    const sampleRecord = await getEntitySampleRecord(token, mainCaseEntity.id);
    const dynamicMappedPayload = mapValuesToEntityColumns(sourceValues, sampleRecord);
    const mainCasePayload = {
      ...dynamicMappedPayload,
      IncomingChannel: 'WEB',
      incomingChannel: 'WEB',
      Incoming_Channel: 'WEB',
    };

    const createdMainCase = await insertThenUpdateCaseId(token, mainCaseEntity.id, mainCasePayload, generatedCaseId);
    const documentSampleRecord = await getEntitySampleRecord(token, documentsEntity.id);

    const uploadedDocuments = [];
    const failedDocuments = [];
    for (const file of documents) {
      try {
        const rawFileName = file.originalname || 'document.bin';
        const documentSourceValues = {
          caseId: generatedCaseId,
          fileName: rawFileName,
          fileType: file?.mimetype || '',
        };

        const mappedDocumentPayload = mapDocumentValuesToEntityColumns(documentSourceValues, documentSampleRecord);
        const documentPayload = {
          ...mappedDocumentPayload,
          OCaseID: generatedCaseId,
          FileName: rawFileName,
        };

        const createdDocument = await createEntityRecord(token, documentsEntity.id, documentPayload);
        const documentRecordId = createdDocument.recordId;

        if (!documentRecordId) {
          throw new Error(`RecordId document introuvable pour ${file.originalname || 'document.bin'}`);
        }

        await uploadEntityAttachment(
          token,
          documentsEntity.name || uiPathConfig.caseDocumentsEntityName,
          documentRecordId,
          uiPathConfig.caseDocumentsAttachmentField || 'File',
          file,
        );

        let metadataWarning = '';
        try {
          await updateDocumentFieldsByRecordId(token, documentsEntity.id, documentRecordId, documentPayload);
        } catch (updateError) {
          metadataWarning = updateError.message;
          console.warn(`WARNING document metadata update ${documentRecordId}: ${updateError.message}`);
        }

        uploadedDocuments.push({
          fileName: rawFileName,
          recordId: documentRecordId,
          metadataWarning,
        });
      } catch (error) {
        failedDocuments.push({
          fileName: file?.originalname || 'document.bin',
          error: error.message,
        });
      }
    }

    res.status(201).json({
      message: 'Demande de crédit enregistrée dans CM_Credit_MainCase.',
      source: 'uipath',
      caseId: generatedCaseId,
      mainCaseRecordId: createdMainCase.recordId || null,
      uploadedDocuments,
      failedDocuments,
    });
  } catch (error) {
    console.error('ERROR /api/loan-requests:', error.message, error.stack);
    res.status(502).json({ message: `Erreur backend création demande: ${error.message}` });
  }
});

export default router;
