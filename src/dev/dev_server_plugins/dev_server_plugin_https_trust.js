/*
 * Lets another device (a phone) trust the root certificate that signs the dev
 * server certificate, so it opens the dev server over https without a warning.
 *
 * Everything under HTTPS_TRUST_PATHNAME is served over plain http too (see the
 * redirectHttpToHttps passed by startDevServer): it is the one page that must
 * load before the certificate is trusted, over https it would show the very
 * warning it exists to remove. Only the certificate is served, never its key.
 *
 * The page is sent as written, not cooked like the project pages: it needs
 * nothing cooking injects, and a project plugin rewriting html must not be able
 * to break the one page reached before trust.
 *
 * What it means for the device, and why the fingerprint must be compared with
 * the terminal: docs/users/b_dev/b_dev.md, "Trusting it on a phone".
 */

import { readFileSync } from "node:fs";

export const HTTPS_TRUST_PATHNAME = "/.internal/https/";

const httpsTrustPageFileUrl = new URL(
  "./client/https_trust.html",
  import.meta.url,
);

// rootCertificate is a node:crypto X509Certificate
export const devServerPluginHttpsTrust = ({ rootCertificate }) => {
  const commonName = readCommonName(rootCertificate.subject);
  const rootCertificateInfo = {
    fingerprint256: rootCertificate.fingerprint256,
    commonName,
  };
  // "https local root certificate" -> "https_local_root_certificate.crt"
  const rootCertificateFilename = `${commonName.replace(/[^\w.-]+/g, "_")}.crt`;

  return {
    name: "jsenv:https_trust",
    routes: [
      {
        endpoint: `GET ${HTTPS_TRUST_PATHNAME}root.crt`,
        description: "The root certificate signing the dev server certificate.",
        declarationSource: import.meta.url,
        fetch: () => {
          return new Response(rootCertificate.toString(), {
            headers: {
              "content-type": "application/x-x509-ca-cert",
              "content-disposition": `attachment; filename="${rootCertificateFilename}"`,
            },
          });
        },
      },
      {
        endpoint: `GET ${HTTPS_TRUST_PATHNAME}root.json`,
        description: "Fingerprint and name of the root certificate.",
        declarationSource: import.meta.url,
        fetch: () => {
          return Response.json(rootCertificateInfo);
        },
      },
      {
        endpoint: `GET ${HTTPS_TRUST_PATHNAME}ping`,
        description:
          "Fetched over https by the page: it fails as long as the device does not trust the certificate.",
        declarationSource: import.meta.url,
        fetch: () => {
          return new Response(null, { status: 204 });
        },
      },
      // Last: an endpoint ending with "/" covers everything under it, so
      // declared first it would answer for the files above.
      {
        endpoint: `GET ${HTTPS_TRUST_PATHNAME}`,
        description:
          "Page to trust the dev server https on another device (a phone). Served over http.",
        declarationSource: import.meta.url,
        fetch: () => {
          return new Response(readFileSync(httpsTrustPageFileUrl), {
            headers: { "content-type": "text/html" },
          });
        },
      },
    ],
  };
};

// "CN=https local root certificate\nO=..." -> "https local root certificate"
const readCommonName = (subject) => {
  for (const line of subject.split("\n")) {
    if (line.startsWith("CN=")) {
      return line.slice("CN=".length);
    }
  }
  return subject;
};
