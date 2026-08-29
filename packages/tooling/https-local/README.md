# HTTPS Local [![npm package](https://img.shields.io/npm/v/@jsenv/https-local.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/https-local)

Generate locally trusted HTTPS certificates for local development.

🔒 Certificates trusted by your operating system and browsers  
🌐 Perfect for local HTTPS development  
🖥️ Works on macOS, Linux, and Windows  
📱 Trusted by iOS simulators too  
⚡ Simple CLI and JavaScript API

## Table of Contents

- [HTTPS Local ](#https-local-)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [CLI](#cli)
    - [init](#init)
      - [iOS simulator](#ios-simulator)
    - [generate](#generate)
    - [cleanup](#cleanup)
  - [Certificate Expiration](#certificate-expiration)
  - [JavaScript API](#javascript-api)
    - [requestCertificate](#requestcertificate)
    - [trustCertificateAuthority](#trustcertificateauthority)
    - [verifyHostsFile](#verifyhostsfile)
      - [Auto Update Hosts](#auto-update-hosts)
    - [installCertificateAuthority](#installcertificateauthority)
      - [Auto Trust](#auto-trust)

## Quick Start

```console
npx @jsenv/https-local init
npx @jsenv/https-local generate
```

Then start your server reading the generated certificate files:

```js
import { createServer } from "node:https";
import { readFileSync } from "node:fs";

const server = createServer(
  {
    cert: readFileSync("certificate.pem"),
    key: readFileSync("private_key.pem"),
  },
  (request, response) => {
    response.end("Hello HTTPS world!");
  },
).listen(8443, () => {
  console.log("HTTPS server running at https://localhost:8443");
});
```

## CLI

### init

```console
npx @jsenv/https-local init
```

Installs a root certificate authority, trusts it in your OS, your browsers and the [iOS simulators](#ios-simulator) currently booted, and ensures `localhost` is mapped to `127.0.0.1` in your hosts file. Safe to re-run — subsequent runs report the current status.

<details>
  <summary>First execution (macOS)</summary>

```console
> npx @jsenv/https-local init

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at /Users/you/https_local/https_local_root_certificate.crt
Adding certificate to mac keychain...
❯ sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "/Users/you/https_local/https_local_root_certificate.crt"
Password:
✔ certificate added to mac keychain
Adding certificate to firefox...
✔ certificate added to Firefox
Check if certificate is in iOS simulator "iPhone 17"...
ℹ certificate not found in iOS simulator "iPhone 17"
Adding certificate to iOS simulator "iPhone 17"...
❯ xcrun simctl keychain 3353AABB-2A54-49FA-B69D-AA4454350523 add-root-cert "/Users/you/https_local/https_local_root_certificate.crt"
✔ certificate added to iOS simulator "iPhone 17"
Check hosts file content...
✔ all ip mappings found in hosts file
```

</details>

<details>
  <summary>Second execution (macOS)</summary>

```console
> npx @jsenv/https-local init

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is in mac keychain...
✔ certificate found in mac keychain
Check if certificate is in Firefox...
✔ certificate found in Firefox
Check if certificate is in iOS simulator "iPhone 17"...
✔ certificate found in iOS simulator "iPhone 17"
Check hosts file content...
✔ all ip mappings found in hosts file
```

</details>

#### iOS simulator

An iOS simulator has a trust store of its own: a certificate trusted by the mac keychain is still refused by Safari inside the simulator, and a `fetch` towards another origin fails with `TypeError: Load failed` — WebKit only offers the "Visit website" exception for the page itself, not for cross-origin requests.

`init` adds the root certificate to every simulator booted at the time it runs, with full trust: there is nothing to enable in Settings › General › About › Certificate Trust Settings afterwards (that toggle is for certificates installed from a profile). Boot the simulator, then run `init` again; or add it by hand, `booted` standing for every running simulator:

```console
xcrun simctl keychain booted add-root-cert "$HOME/Library/Application Support/https_local/https_local_root_certificate.crt"
```

The certificate stays in the simulator across reboots. It cannot be removed on its own, so `cleanup` leaves it there; `xcrun simctl keychain <udid> reset` wipes the whole simulator keychain.

### generate

```console
npx @jsenv/https-local generate
```

Generates a server certificate signed by the local certificate authority and writes it to files. Requires `init` to have been run first.

> **Note:** Certificate files are static — they are not renewed automatically. Re-run `generate` after one year to replace expired files.

Options:

| Option          | Description                       | Default           |
| --------------- | --------------------------------- | ----------------- |
| `--certificate` | Path for the certificate file     | `certificate.pem` |
| `--private-key` | Path for the private key file     | `private_key.pem` |
| `--hostnames`   | Comma-separated list of hostnames | `localhost`       |

Example:

```console
npx @jsenv/https-local generate --certificate server.pem --private-key server.key --hostnames localhost,myapp.local
```

### cleanup

```console
npx @jsenv/https-local cleanup
```

Uninstalls the root certificate and removes its trust from your OS and browsers.

## Certificate Expiration

| Certificate | Expires after | How to renew?     |
| ----------- | ------------- | ----------------- |
| server      | 1 year        | Re-run `generate` |
| authority   | 20 years      | Re-run `init`     |

The **server certificate** expires after one year, which is the maximum duration allowed by web browsers.

The **authority root certificate** expires after 20 years. Re-running `init` after expiry will reinstall and re-trust a new one.

## JavaScript API

To use the JavaScript API, add the package to your dev dependencies:

```console
npm install --save-dev @jsenv/https-local
```

### requestCertificate

The `requestCertificate` function generates a fresh certificate each time it is called and returns it in memory. Because the certificate is generated on every server startup, it is always valid — as long as your server is restarted at least once a year.

```js
import { createServer } from "node:https";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate({
  altNames: ["localhost", "local.example"],
});
const server = createServer(
  { cert: certificate, key: privateKey },
  (request, response) => {
    response.end("Hello HTTPS world!");
  },
).listen(8443, () => {
  console.log("HTTPS server running at https://localhost:8443");
});
```

[`init`](#init) (or `installCertificateAuthority`) must be called once before using this function.

It also makes the current process trust the certificate authority, as described in [trustCertificateAuthority](#trustcertificateauthority). Pass `trustAuthority: false` to keep the CA certificates of the process untouched:

```js
const { certificate, privateKey } = requestCertificate({
  trustAuthority: false,
});
```

### trustCertificateAuthority

The root certificate authority is installed in the system keychain, which browsers read — but node does not: it uses its own CA list. A node process requesting a local HTTPS server signed by the authority therefore fails with `unable to verify the first certificate`, even on the machine that created the authority.

`trustCertificateAuthority` adds the authority root certificate to the CA list of the current process:

```js
import { trustCertificateAuthority } from "@jsenv/https-local";

trustCertificateAuthority();

const response = await fetch("https://localhost:4000");
```

Only the authority root certificate is added; the CA certificates node trusts by default are preserved and the rest of the system keychain is left out. Calling it twice does nothing the second time.

[requestCertificate](#requestcertificate) does this on its own, so this function is for processes acting only as a client — an integration test requesting a local HTTPS server started elsewhere, for instance.

[`init`](#init) (or `installCertificateAuthority`) must be called once before using this function.

> **Note:** it relies on [`tls.setDefaultCACertificates`](https://nodejs.org/api/tls.html#tlssetdefaultcacertificatescerts), available starting from node 22.19.0 and 24.5.0. On older versions the call logs a warning and does nothing; the alternative there is the `NODE_EXTRA_CA_CERTS` environment variable, pointing to the `rootCertificateFilePath` returned by [requestCertificate](#requestcertificate). It must be set before the process starts, which is why it does not replace this function:
>
> ```console
> NODE_EXTRA_CA_CERTS="~/Library/Application Support/https_local/https_local_root_certificate.crt" node file.mjs
> ```

### verifyHostsFile

Verifies that IP mappings important for your local server are present in the hosts file.

```js
import { verifyHostsFile } from "@jsenv/https-local";

await verifyHostsFile({
  ipMappings: {
    "127.0.0.1": ["localhost", "local.example"],
  },
});
```

#### Auto Update Hosts

It's possible to update hosts file programmatically using `tryToUpdateHostsFile`:

```js
import { verifyHostsFile } from "@jsenv/https-local";

await verifyHostsFile({
  ipMappings: {
    "127.0.0.1": ["localhost", "local.example"],
  },
  tryToUpdateHostsFile: true,
});
```

### installCertificateAuthority

The `installCertificateAuthority` function generates a certificate authority valid for 20 years.
This certificate authority is needed to generate local certificates that will be trusted by the operating system and web browsers.

```js
import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority();
```

By default, trusting the root certificate is a manual process. See [BenMorel/dev-certificates](https://github.com/BenMorel/dev-certificates/tree/c10cd68945da772f31815b7a36721ddf848ff3a3#import-the-ca-in-your-browser) for instructions. This can also be done programmatically as shown in [Auto Trust](#auto-trust).

#### Auto Trust

It's possible to trust root certificate programmatically using `tryToTrust`:

```js
import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority({
  tryToTrust: true,
});
```
