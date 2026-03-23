import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const uiPathConfig = {
  baseUrl: (process.env.UIPATH_BASE_URL || '').replace(/\/+$/, ''),
  orgName: (process.env.UIPATH_ORG_NAME || '').trim(),
  tenantName: (process.env.UIPATH_TENANT_NAME || '').trim(),
  folderKey: (process.env.UIPATH_FOLDER_KEY || '').trim(),
  clientId: (process.env.UIPATH_CLIENT_ID || '').trim(),
  clientSecret: (process.env.UIPATH_CLIENT_SECRET || '').trim(),
  scope: (process.env.UIPATH_SCOPE || 'OR.Execution OR.Folders OR.Jobs OR.Tasks PIMS DataFabric.Data.Read DataFabric.Data.Write DataFabric.Schema.Read').trim(),
  targetProcessKey: (process.env.TARGET_CASE_PROCESS_KEY || 'CM_Credit_MainProcess').trim(),
  targetCaseModelId: (process.env.TARGET_CASE_MODEL_ID || '').trim(),
  mainCaseEntityName: (process.env.MAINCASE_ENTITY_NAME || 'CM_Credit_MainCase').trim(),
  caseDocumentsEntityName: (process.env.CASEDOCUMENTS_ENTITY_NAME || 'CM_Credit_CaseDocuments').trim(),
  caseDocumentsAttachmentField: (process.env.CASEDOCUMENTS_ATTACHMENT_FIELD || 'File').trim(),
};

export const hasUiPathBaseConfig = () => {
  if (process.env.USE_MOCK_DATA === 'true') return false;
  return Boolean(uiPathConfig.baseUrl && uiPathConfig.orgName && uiPathConfig.tenantName);
};

export const hasClientCredentials = () =>
  Boolean(uiPathConfig.clientId && uiPathConfig.clientSecret);
