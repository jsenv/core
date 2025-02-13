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

if (process.platform === "win32") {
  process.exit(0);
}

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
    const expect = "net::ERR_CERT_AUTHORITY_INVALID";
    assert({ actual, expect });
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
    assert({
      actual: e.errorText.includes("SEC_ERROR_UNKNOWN"),
      expect: true,
    });
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
    if (process.platform === "darwin") {
      assert({
        actual: e.errorText.includes(
          "The certificate for this server is invalid. You might be connecting to",
        ),
        expect: true,
      });
    } else {
      assert({
        actual: e.errorText,
        expect: {
          win32: "SSL peer certificate or SSH remote key was not OK",
          linux: "Unacceptable TLS certificate",
        }[process.platform],
      });
    }
  } finally {
    browser.close();
  }
}
