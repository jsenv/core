import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getCertificateAuthorityFileUrls } from "./certificate_authority_file_urls.js";

export const getAuthorityFileInfos = () => {
  const {
    certificateAuthorityJsonFileUrl,
    rootCertificateFileUrl,
    rootCertificatePrivateKeyFileUrl,
  } = getCertificateAuthorityFileUrls();

  const authorityJsonFilePath = fileURLToPath(certificateAuthorityJsonFileUrl);
  const authorityJsonFileDetected = existsSync(authorityJsonFilePath);

  const rootCertificateFilePath = fileURLToPath(rootCertificateFileUrl);
  const rootCertificateFileDetected = existsSync(rootCertificateFilePath);

  const rootCertificatePrivateKeyFilePath = fileURLToPath(
    rootCertificatePrivateKeyFileUrl,
  );
  const rootCertificatePrivateKeyFileDetected = existsSync(
    rootCertificatePrivateKeyFilePath,
  );

  return {
    authorityJsonFileInfo: {
      url: certificateAuthorityJsonFileUrl,
      path: authorityJsonFilePath,
      exists: authorityJsonFileDetected,
    },
    rootCertificateFileInfo: {
      url: rootCertificateFileUrl,
      path: rootCertificateFilePath,
      exists: rootCertificateFileDetected,
    },
    rootCertificatePrivateKeyFileInfo: {
      url: rootCertificatePrivateKeyFileUrl,
      path: rootCertificatePrivateKeyFilePath,
      exists: rootCertificatePrivateKeyFileDetected,
    },
  };
};
