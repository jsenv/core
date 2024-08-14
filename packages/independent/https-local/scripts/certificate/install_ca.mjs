import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority({
  logLevel: "debug",
  tryToTrust: false,
  NSSDynamicInstall: true,
});
