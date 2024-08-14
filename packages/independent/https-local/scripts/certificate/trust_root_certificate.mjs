import { readFile } from "@jsenv/filesystem";
import { getCertificateAuthorityFileUrls } from "@jsenv/https-local/src/internal/certificate_authority_file_urls.js";
import { importPlatformMethods } from "@jsenv/https-local/src/internal/platform.js";
import { jsenvParameters } from "@jsenv/https-local/src/jsenvParameters.js";
import { createLogger } from "@jsenv/humanize";

const { rootCertificateFileUrl } = getCertificateAuthorityFileUrls();
const { executeTrustQuery } = await importPlatformMethods();
await executeTrustQuery({
  logger: createLogger({ logLevel: "debug" }),
  certificateCommonName: jsenvParameters.certificateCommonName,
  certificateFileUrl: rootCertificateFileUrl,
  certificate: await readFile(rootCertificateFileUrl, { as: "string" }),
  verb: "ADD_TRUST",
  NSSDynamicInstall: true,
});
