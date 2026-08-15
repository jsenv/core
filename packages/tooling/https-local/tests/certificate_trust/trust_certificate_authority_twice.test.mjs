import { assert } from "@jsenv/assert";
import {
  installCertificateAuthority,
  trustCertificateAuthority,
} from "@jsenv/https-local";
import tls from "node:tls";

await installCertificateAuthority({
  logLevel: "warn",
});

const certificatesBeforeTrust = tls.getCACertificates("default");
const firstCallReturnValue = trustCertificateAuthority({ logLevel: "warn" });
const certificatesAfterFirstCall = tls.getCACertificates("default");
const secondCallReturnValue = trustCertificateAuthority({ logLevel: "warn" });
const certificatesAfterSecondCall = tls.getCACertificates("default");

// node re-emits PEM with its own line wrapping, so the certificates must be
// compared on their body rather than on their exact text
const toCertificateBody = (certificate) =>
  certificate
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
const certificateBodySet = new Set(
  certificatesAfterSecondCall.map(toCertificateBody),
);

const actual = {
  firstCallReturnValue,
  secondCallReturnValue,
  countAddedByFirstCall:
    certificatesAfterFirstCall.length - certificatesBeforeTrust.length,
  countAddedBySecondCall:
    certificatesAfterSecondCall.length - certificatesAfterFirstCall.length,
  defaultCertificatesKept: certificatesBeforeTrust.every((certificate) =>
    certificateBodySet.has(toCertificateBody(certificate)),
  ),
};
const expect = {
  firstCallReturnValue: true,
  secondCallReturnValue: false,
  countAddedByFirstCall: 1,
  countAddedBySecondCall: 0,
  defaultCertificatesKept: true,
};
assert({ actual, expect });
