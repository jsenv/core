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
await installCertificateAuthority({
  logLevel: "warn",
  certificateValidityDurationInMs: 6000,
})
await new Promise((resolve) => {
  setTimeout(resolve, 1500)
})
const loggerForSecondCall = createLoggerForTest({
  // forwardToConsole: true,
})
const { rootCertificateFilePath } = await installCertificateAuthority({
  logger: loggerForSecondCall,
  certificateValidityDurationInMs: 6000,
  aboutToExpireRatio: 0.95,
})

{
  const { infos, warns, errors } = loggerForSecondCall.getLogs({
    info: true,
    warn: true,
    error: true,
  })
  const actual = { infos, warns, errors }
  const expected = {
    infos: [
      `${UNICODE.OK} authority root certificate found in filesystem`,
      `Checking certificate validity...`,
      assert.matchesRegExp(/certificate will expire in \d seconds/),
      `Generating authority root certificate with a validity of 6 seconds...`,
      `${UNICODE.OK} authority root certificate written at ${rootCertificateFilePath}`,
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
  }
  assert({ actual, expected })
}
