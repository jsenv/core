# https local

[![npm package](https://img.shields.io/npm/v/@jsenv/https-local.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/https-local)

A programmatic way to generate locally trusted certificates.

Generate certificate(s) trusted by your operating system and browsers.
This certificate can be used to start your development server in HTTPS.
Works on mac, linux and windows.

# How to use

The following steps can be taken to start a local server in https.

1. Install the root certificate using https-local
2. Request certificate for your server
3. Start that server

## 1. Install the root certificate

```console
npx @jsenv/https-local install --trust
```

This will install a root certificate valid for 20 years.

- Re-executing this command will log the current root certificate validity and trust status.
- Re-executing this command 20 years later would reinstall a root certificate and re-trust it

## 2. Request certificate for your server

_start_dev_server.mjs_

```js
import { createServer } from "node:https";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate();
const server = createServer(
  {
    cert: certificate,
    key: privateKey,
  },
  (request, response) => {
    const body = "Hello world";
    response.writeHead(200, {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(body),
    });
    response.write(body);
    response.end();
  },
);
server.listen(8080);
console.log(`Server listening at https://local.example:8080`);
```

## 3. Start the server

```console
node ./start_dev_server.mjs
```

At this stage you have a server running in https.
The rest of this documentation goes into more details.

# Certificate expiration

| Certificate | Expires after | How to renew?                        |
| ----------- | ------------- | ------------------------------------ |
| server      | 1 year        | Re-run _requestCertificate_          |
| authority   | 20 year       | Re-run _installCertificateAuthority_ |

The **server certificate** expires after one year which is the maximum duration allowed by web browsers.
In the unlikely scenario where a local server is running for more than a year without interruption, restart it to re-run requestCertificate.

The **authority root certificate** expires after 20 years which is close to the maximum allowed duration.
In the very unlikely scenario where you are using the same machine for more than 20 years, re-execute [installCertificateAuthority](#installCertificateAuthority) to update certificate authority then restart your server.

# installCertificateAuthority

_installCertificateAuthority_ function generates a certificate authority valid for 20 years.
This certificate authority is needed to generate local certificates that will be trusted by the operating system and web browsers.

```js
import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority();
```

By default, trusting authority root certificate is a manual process. This manual process is documented in [BenMorel/dev-certificates#Import the CA in your browser](https://github.com/BenMorel/dev-certificates/tree/c10cd68945da772f31815b7a36721ddf848ff3a3#import-the-ca-in-your-browser). This process can be done programmatically as explained in [Auto trust](#Auto-trust).

Find below logs written in terminal when this function is executed.

<details>
  <summary>mac</summary>

```console
> node ./install_certificate_authority.mjs

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at /Users/dmail/https_local/http_local_root_certificate.crt
ℹ You should add root certificate to mac keychain
ℹ You should add root certificate to firefox
```

_second execution logs_

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
  <summary>linux</summary>

```console
> node ./install_certificate_authority.mjs

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at /home/dmail/.config/https_local/https_local_root_certificate.crt
ℹ You should add certificate to linux
ℹ You should add certificate to chrome
ℹ You should add certificate to firefox
```

_second execution logs_

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
  <summary>windows</summary>

```console
> node ./install_certificate_authority.mjs

ℹ authority root certificate not found in filesystem
Generating authority root certificate with a validity of 20 years...
✔ authority root certificate written at C:\Users\Dmail\AppData\Local\https_local\https_local_root_certificate.crt
ℹ You should add certificate to windows
ℹ You should add certificate to firefox
```

_second execution logs_

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

## Auto trust

It's possible to trust root certificate programmatically using _tryToTrust_

```js
import { installCertificateAuthority } from "@jsenv/https-local";

await installCertificateAuthority({
  tryToTrust: true,
});
```

<details>
  <summary>mac</summary>

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

_second execution logs_

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
  <summary>linux</summary>

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

_second execution logs_

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
  <summary>windows</summary>

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

_second execution logs_

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

# requestCertificate

_requestCertificate_ function returns a certificate and private key that can be used to start a server in HTTPS.

```js
import { createServer } from "node:https";
import { requestCertificate } from "@jsenv/https-local";

const { certificate, privateKey } = requestCertificate({
  altNames: ["localhost", "local.example"],
});
```

[installCertificateAuthority](#installCertificateAuthority) must be called before this function.

# verifyHostsFile

This function is not mandatory to obtain the https certificates.
But it is useful to programmatically verify ip mappings that are important for your local server are present in hosts file.

```js
import { verifyHostsFile } from "@jsenv/https-local";

await verifyHostsFile({
  ipMappings: {
    "127.0.0.1": ["localhost", "local.example"],
  },
});
```

Find below logs written in terminal when this function is executed.

<details>
  <summary>mac and linux</summary>

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
  <summary>windows</summary>

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

## Auto update hosts

It's possible to update hosts file programmatically using _tryToUpdateHostsFile_.

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
  <summary>mac and linux</summary>

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
  <summary>windows</summary>

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
