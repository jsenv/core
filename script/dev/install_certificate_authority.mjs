/*
 * This file needs to be executed once. After that the root certificate is valid for 20 years.
 * Re-executing this file will log the current root certificate validity and trust status.
 * Re-executing this file 20 years later would reinstall a root certificate and re-trust it.
 *
 * Read more in https://github.com/jsenv/https-local#installCertificateAuthority
 */

import {
  installCertificateAuthority,
  verifyHostsFile,
} from "@jsenv/https-local"

await installCertificateAuthority({
  tryToTrust: true,
  NSSDynamicInstall: true,
})
await verifyHostsFile({
  ipMappings: {
    "127.0.0.1": ["localhost"],
  },
  tryToUpdatesHostsFile: true,
})
