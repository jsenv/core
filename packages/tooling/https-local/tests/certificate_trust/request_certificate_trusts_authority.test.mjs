import { assert } from "@jsenv/assert";
import {
  installCertificateAuthority,
  requestCertificate,
} from "@jsenv/https-local";
import { startServerForTest } from "@jsenv/https-local/tests/test_helpers.mjs";

await installCertificateAuthority({
  logLevel: "warn",
});
const { certificate, privateKey } = requestCertificate({
  logLevel: "warn",
});
const serverOrigin = await startServerForTest({ certificate, privateKey });

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
