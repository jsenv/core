import { assert } from "@jsenv/assert";
import {
  installCertificateAuthority,
  uninstallCertificateAuthority,
} from "@jsenv/https-local";
import { createLoggerForTest } from "@jsenv/https-local/tests/test_helpers.mjs";
import { UNICODE } from "@jsenv/humanize";

process.exit(0);

await uninstallCertificateAuthority({
  logLevel: "warn",
});
await installCertificateAuthority({
  logLevel: "warn",
  certificateValidityDurationInMs: 1000,
});
await new Promise((resolve) => {
  setTimeout(resolve, 2500);
});
const loggerForSecondCall = createLoggerForTest({
  // forwardToConsole: true,
});
const { rootCertificateFilePath } = await installCertificateAuthority({
  logger: loggerForSecondCall,
  certificateValidityDurationInMs: 1000,
});

{
  const { infos, warns, errors } = loggerForSecondCall.getLogs({
    info: true,
    warn: true,
    error: true,
  });
  const actual = { infos, warns, errors };
  const expect = {
    infos: [
      `${UNICODE.OK} authority root certificate found in filesystem`,
      `Checking certificate validity...`,
      assert.matchesRegExp(/certificate expired \d seconds ago/),
      `Generating authority root certificate with a validity of 1 second...`,
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
  };
  assert({ actual, expect });
}
