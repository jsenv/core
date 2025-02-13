/*
 * This file is the first file executed by code using the package
 * Its responsability is to export what is documented
 * Ideally this file should be kept simple to help discovering codebase progressively.
 *
 * see also
 * - https://github.com/davewasmer/devcert
 * - https://github.com/FiloSottile/mkcert
 */

export {
  installCertificateAuthority,
  uninstallCertificateAuthority,
} from "./certificate_authority.js";
export { requestCertificate } from "./certificate_request.js";
export { verifyHostsFile } from "./hosts_file_verif.js";
export {
  createValidityDurationOfXDays,
  createValidityDurationOfXYears,
} from "./validity_duration.js";
