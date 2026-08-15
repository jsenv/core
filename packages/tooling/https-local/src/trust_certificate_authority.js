import { createLogger } from "@jsenv/humanize";
import { readFileSync } from "node:fs";
import { getAuthorityFileInfos } from "./internal/authority_file_infos.js";
import { addCertificateToProcessCACertificates } from "./internal/process_ca_certificates.js";

export const trustCertificateAuthority = ({
  logLevel,
  logger = createLogger({ logLevel }), // to be able to catch logs during unit tests
} = {}) => {
  const { rootCertificateFileInfo } = getAuthorityFileInfos();
  if (!rootCertificateFileInfo.exists) {
    throw new Error(
      `Certificate authority not found, "installCertificateAuthority" must be called before "trustCertificateAuthority".
--- Suggested command to run ---
npx @jsenv/https-local init`,
    );
  }

  const rootCertificate = readFileSync(
    new URL(rootCertificateFileInfo.url),
    "utf8",
  );
  return addCertificateToProcessCACertificates({
    logger,
    certificate: rootCertificate,
    certificateFilePath: rootCertificateFileInfo.path,
  });
};
