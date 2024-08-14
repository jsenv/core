import { assert } from "@jsenv/assert"
import { UNICODE } from "@jsenv/log"

import {
  installCertificateAuthority,
  uninstallCertificateAuthority,
} from "@jsenv/https-local"
import { createLoggerForTest } from "@jsenv/https-local/tests/test_helpers.mjs"

await uninstallCertificateAuthority({
  logLevel: "warn",
})
const loggerForTest = createLoggerForTest({
  // logLevel: "info",
  // forwardToConsole: true,
})
const {
  rootCertificateForgeObject,
  rootCertificatePrivateKeyForgeObject,
  rootCertificate,
  rootCertificatePrivateKey,
  rootCertificateFilePath,
  trustInfo,
} = await installCertificateAuthority({
  logger: loggerForTest,
})
const { infos, warns, errors } = loggerForTest.getLogs({
  info: true,
  warn: true,
  error: true,
})

const actual = {
  // assert what is logged
  infos,
  warns,
  errors,
  // assert value returned
  rootCertificateForgeObject,
  rootCertificatePrivateKeyForgeObject,
  rootCertificate,
  rootCertificatePrivateKey,
  rootCertificateFilePath,
  trustInfo,
}
const expected = {
  infos: [
    `${UNICODE.INFO} authority root certificate not found in filesystem`,
    `Generating authority root certificate with a validity of 20 years...`,
    `${UNICODE.OK} authority root certificate written at ${actual.rootCertificateFilePath}`,
    ...{
      darwin: [
        `${UNICODE.INFO} You should add certificate to mac keychain`,
        `${UNICODE.INFO} You should add certificate to firefox`,
      ],
      win32: [
        `${UNICODE.INFO} You should add certificate to windows`,
        `${UNICODE.INFO} You should add certificate to firefox`,
      ],
      linux: [
        `${UNICODE.INFO} You should add certificate to linux`,
        `${UNICODE.INFO} You should add certificate to chrome`,
        `${UNICODE.INFO} You should add certificate to firefox`,
      ],
    }[process.platform],
  ],
  warns: [],
  errors: [],
  rootCertificateForgeObject: assert.any(Object),
  rootCertificatePrivateKeyForgeObject: assert.any(Object),
  rootCertificate: assert.any(String),
  rootCertificatePrivateKey: assert.any(String),
  rootCertificateFilePath: assert.any(String),
  trustInfo: {
    darwin: {
      mac: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      chrome: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      firefox: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      safari: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
    },
    win32: {
      windows: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      chrome: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      edge: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      firefox: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
    },
    linux: {
      linux: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      chrome: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
      firefox: {
        status: "not_trusted",
        reason: "certificate is new and tryToTrust is disabled",
      },
    },
  }[process.platform],
}
assert({ actual, expected })
