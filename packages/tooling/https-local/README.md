# HTTPS Local [![npm package](https://img.shields.io/npm/v/@jsenv/https-local.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/https-local)

Generate locally trusted HTTPS certificates for local development.

🔒 Certificates trusted by your operating system and browsers  
🌐 Perfect for local HTTPS development  
🖥️ Works on macOS, Linux, and Windows  
⚡ Simple CLI and JavaScript API

## Table of Contents

- [HTTPS Local ](#https-local-)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [CLI](#cli)
    - [init](#init)
    - [cleanup](#cleanup)
    - [generate](#generate)
    - [Advanced commands](#advanced-commands)
  - [Certificate Expiration](#certificate-expiration)
  - [JavaScript API](#javascript-api)
    - [requestCertificate](#requestcertificate)
    - [verifyHostsFile](#verifyhostsfile)
      - [Auto Update Hosts](#auto-update-hosts)
    - [installCertificateAuthority](#installcertificateauthority)
      - [Auto Trust](#auto-trust)

## Quick Start

```console
npx @jsenv/https-local init
```

That's it. Your machine is now ready to run local HTTPS servers.

## CLI

### init

```console
npx @jsenv/https-local init
```

Installs a root certificate authority, trusts it in your OS and browsers, and ensures `localhost` is mapped to `127.0.0.1` in your hosts file. Safe to re-run — subsequent runs report the current status.

### cleanup

```console
npx @jsenv/https-local cleanup
```

Uninstalls the root certificate and removes its trust from your OS and browsers.

### generate

```console
npx @jsenv/https-local generate
```

Generates a server certificate signed by the local certificate authority and writes it to files.

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

Requires `init` to have been run first.

### Advanced commands

These commands are the individual steps that `init` and `cleanup` perform internally.

```console
npx @jsenv/https-local install --trust
```

Installs the root certificate. Pass `--trust` to also add it to OS and browser trust stores.

```console
npx @jsenv/https-local uninstall
```

Uninstalls the root certificate from the filesystem.

```console
npx @jsenv/https-local localhost-mapping
```

Ensures `localhost` is mapped to `127.0.0.1` in the hosts file.

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

The `requestCertificate` function returns a certificate and private key that can be used to start a server in HTTPS.

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

Find below logs written in terminal when this function is executed:

<details>
  <summary>Mac and Linux output</summary>

```console
> node ./verify_hosts.mjs

Check hosts file content...
⚠ 1 mapping is missing in hosts file
--- hosts file path ---
/etc/hosts
--- line(s) to add ---
127.0.0.1 localhost local.example
```

</details>

<details>
  <summary>Windows output</summary>

```console
> node ./verify_hosts.mjs

Check hosts file content...
⚠ 1 mapping is missing in hosts file
--- hosts file path ---
C:\\Windows\\System32\\Drivers\\etc\\hosts
--- line(s) to add ---
127.0.0.1 localhost local.example
```

</details>

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

<details>
  <summary>Mac and Linux output</summary>

```console
Check hosts file content...
ℹ 1 mapping is missing in hosts file
Adding 1 mapping(s) in hosts file...
❯ echo "127.0.0.1 local.example" | sudo tee -a /etc/hosts
Password:
✔ mappings added to hosts file
```

_Second execution logs_

```console
> node ./verify_hosts.mjs

Check hosts file content...
✔ all ip mappings found in hosts file
```

</details>

<details>
  <summary>Windows output</summary>

```console
Check hosts file content...
ℹ 1 mapping is missing in hosts file
Adding 1 mapping(s) in hosts file...
❯ (echo 127.0.0.1 local.example) >> C:\\Windows\\System32\\Drivers\\etc\\hosts
Password:
✔ mappings added to hosts file
```

_Second execution logs_

```console
> node ./verify_hosts.mjs

Check hosts file content...
✔ all ip mappings found in hosts file
```

</details>

### installCertificateAuthority

The `installCertificateAuthority` function generates a certificate authority valid for 20 years.
This certificate authority is needed to generate local certificates that will be trusted by the operating system and web browsers.

```js
import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority();
```

By default, trusting authority root certificate is a manual process. This manual process is documented in [BenMorel/dev-certificates#Import the CA in your browser](https://github.com/BenMorel/dev-certificates/tree/c10cd68945da772f31815b7a36721ddf848ff3a3#import-the-ca-in-your-browser). This process can be done programmatically as explained in [Auto Trust](#auto-trust).

<details>
  <summary>macOS output</summary>

```console
> node ./install_certificate_authority.mjs

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at /Users/dmail/https_local/http_local_root_certificate.crt
ℹ You should add root certificate to mac keychain
ℹ You should add root certificate to firefox
```

_Second execution logs_

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is in mac keychain...
ℹ certificate not found in mac keychain
Check if certificate is in firefox...
ℹ certificate not found in firefox
```

</details>

<details>
  <summary>Linux output</summary>

```console
> node ./install_certificate_authority.mjs

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at /home/dmail/.config/https_local/https_local_root_certificate.crt
ℹ You should add certificate to linux
ℹ You should add certificate to chrome
ℹ You should add certificate to firefox
```

_Second execution logs_

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is in linux...
ℹ certificate in linux is outdated
Check if certificate is in chrome...
ℹ certificate not found in chrome
Check if certificate is in firefox...
ℹ certificate not found in firefox
```

</details>

<details>
  <summary>Windows output</summary>

```console
> node ./install_certificate_authority.mjs

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at C:\Users\Dmail\AppData\Local\https_local\https_local_root_certificate.crt
ℹ You should add certificate to windows
ℹ You should add certificate to firefox
```

_Second execution logs_

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is trusted by windows...
ℹ certificate is not trusted by windows
Check if certificate is trusted by firefox...
ℹ unable to detect if certificate is trusted by firefox (not implemented on windows)
```

</details>

#### Auto Trust

It's possible to trust root certificate programmatically using `tryToTrust`:

```js
import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority({
  tryToTrust: true,
});
```

<details>
  <summary>macOS output</summary>

```console
> node ./install_certificate_authority.mjs

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at /Users/dmail/https_local/https_local_root_certificate.crt
Adding certificate to mac keychain...
❯ sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "/Users/dmail/https_local/https_local_root_certificate.crt"
Password:
✔ certificate added to mac keychain
Adding certificate to firefox...
✔ certificate added to Firefox
```

_Second execution logs_

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is in mac keychain...
✔ certificate found in mac keychain
Check if certificate is in Firefox...
✔ certificate found in Firefox
```

</details>

<details>
  <summary>Linux output</summary>

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is in linux...
ℹ certificate not in linux
Adding certificate to linux...
❯ sudo /bin/cp -f "/home/dmail/.config/https_local/https_local_root_certificate.crt" /usr/local/share/ca-certificates/https_local_root_certificate.crt
[sudo] Password for dmail :
❯ sudo update-ca-certificates
✔ certificate added to linux
Check if certificate is in chrome...
ℹ certificate not found in chrome
Adding certificate to chrome...
✔ certificate added to chrome
Check if certificate is in firefox...
ℹ certificate not found in firefox
Adding certificate to firefox...
✔ certificate added to firefox
```

_Second execution logs_

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is in linux...
✔ certificate found in linux
Check if certificate is in chrome...
✔ certificate found in chrome
Check if certificate is in firefox...
✔ certificate found in firefox
```

</details>

<details>
  <summary>Windows output</summary>

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is trusted by windows...
ℹ certificate not trusted by windows
Adding certificate to windows...
❯ certutil -addstore -user root C:\Users\Dmail\AppData\Local\https_local\https_local_root_certificate.crt
✔ certificate added to windows
Check if certificate is trusted by firefox...
ℹ unable to detect if certificate is trusted by firefox (not implemented on windows)
```

_Second execution logs_

```console
> node ./install_certificate_authority.mjs

✔ authority root certificate found in filesystem
Checking certificate validity...
✔ certificate still valid for 19 years
Detect if certificate attributes have changed...
✔ certificate attributes are the same
Check if certificate is trusted by windows...
✔ certificate trusted by windows
Check if certificate is trusted by firefox...
ℹ unable to detect if certificate is trusted by firefox (not implemented on windows)
```

</details>
