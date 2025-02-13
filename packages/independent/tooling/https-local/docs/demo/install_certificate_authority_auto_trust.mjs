import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority({
  tryToTrust: true,
});
