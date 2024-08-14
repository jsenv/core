import { assert } from "@jsenv/assert";
import { UNICODE } from "@jsenv/log";

import {
  installCertificateAuthority,
  requestCertificate,
  uninstallCertificateAuthority,
} from "@jsenv/https-local";
import { createLoggerForTest } from "@jsenv/https-local/tests/test_helpers.mjs";

const loggerDuringTest = createLoggerForTest({
  // forwardToConsole: true,
});

await uninstallCertificateAuthority({
  logLevel: "warn",
});
await installCertificateAuthority({
  logLevel: "warn",
});
const returnValue = await requestCertificate({
  // logLevel: "warn",
  logger: loggerDuringTest,
});

{
  const { debugs, infos, warns, errors } = loggerDuringTest.getLogs({
    debug: true,
    info: true,
    warn: true,
    error: true,
  });
  const actual = {
    debugs,
    infos,
    warns,
    errors,
    returnValue,
  };
  const expected = {
    debugs: [
      `Restoring certificate authority from filesystem...`,
      `${UNICODE.OK} certificate authority restored from filesystem`,
      "Generating server certificate...",
      `${UNICODE.OK} server certificate generated, it will be valid for 1 year`,
    ],
    infos: [],
    warns: [],
    errors: [],
    returnValue: {
      certificate: assert.any(String),
      privateKey: assert.any(String),
      rootCertificateFilePath: assert.any(String),
    },
  };
  assert({ actual, expected });
}
