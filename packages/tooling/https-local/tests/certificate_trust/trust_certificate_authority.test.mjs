import { assert } from "@jsenv/assert";
import {
  installCertificateAuthority,
  requestCertificate,
  trustCertificateAuthority,
} from "@jsenv/https-local";
import { startServerForTest } from "@jsenv/https-local/tests/test_helpers.mjs";

await installCertificateAuthority({
  logLevel: "warn",
});
const { certificate, privateKey } = requestCertificate({
  logLevel: "warn",
  trustAuthority: false,
});
const serverOrigin = await startServerForTest({ certificate, privateKey });

// node uses its own CA list, it ignores the system keychain where the authority
// root certificate is installed
{
  let errorCode;
  try {
    await fetch(serverOrigin);
  } catch (e) {
    errorCode = e.cause.code;
  }
  const actual = errorCode;
  const expect = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
  assert({ actual, expect });
}

trustCertificateAuthority({
  logLevel: "warn",
});

{
  const response = await fetch(serverOrigin);
  const actual = {
    status: response.status,
    body: await response.text(),
  };
  const expect = {
    status: 200,
    body: "Hello world",
  };
  assert({ actual, expect });
}
