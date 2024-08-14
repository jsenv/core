import { assert } from "@jsenv/assert";

import {
  installCertificateAuthority,
  requestCertificate,
  uninstallCertificateAuthority,
} from "@jsenv/https-local";
import {
  launchChromium,
  launchFirefox,
  launchWebkit,
  requestServerUsingBrowser,
  startServerForTest,
} from "@jsenv/https-local/tests/test_helpers.mjs";

await uninstallCertificateAuthority({
  logLevel: "warn",
});
await installCertificateAuthority({
  logLevel: "warn",
});
const { certificate, privateKey } = requestCertificate({
  logLevel: "warn",
});

const serverOrigin = await startServerForTest({
  certificate,
  privateKey,
});

{
  const browser = await launchChromium();
  try {
    await requestServerUsingBrowser({
      serverOrigin,
      browser,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e.errorText;
    const expected = "net::ERR_CERT_AUTHORITY_INVALID";
    assert({ actual, expected });
  } finally {
    browser.close();
  }
}

// disabled on windows for now
// there is a little something to change in the expected error to make it pass
if (process.platform !== "win32") {
  const browser = await launchFirefox();
  try {
    await requestServerUsingBrowser({
      serverOrigin,
      browser,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e.errorText;
    const expected = "SEC_ERROR_UNKNOWN_ISSUER";
    assert({ actual, expected, context: { browser: "firefox", error: e } });
  } finally {
    browser.close();
  }
}

// if (process.platform === "darwin") {
{
  const browser = await launchWebkit();
  try {
    await requestServerUsingBrowser({
      serverOrigin,
      browser,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e.errorText;
    const expected = {
      win32: "SSL peer certificate or SSH remote key was not OK",
      linux: "Unacceptable TLS certificate",
      darwin:
        "The certificate for this server is invalid. You might be connecting to a server that is pretending to be “localhost” which could put your confidential information at risk.",
    }[process.platform];
    assert({ actual, expected });
  } finally {
    browser.close();
  }
}
