# 3.0.6

- Fix certutil command on windows

# 3.0.4

- proper fix for firefox nss database

# 3.0.3

- update deps to fix firefox nssb not found on mac

# 3.0.2

- add nssdb store paths on linux
- improve firefox and chrome detection on linux
- update dependencies and devDependencies
- update mac os to 2022 in github workflow

# 3.0.1

- fix firefox is running detection (could return true because of playwright)

# 3.0.0

- requestCertificateForLocalhost renamed requestCertificate
- do not force "localhost" in altNames anymore

# 2.1.0

- installCertificateAuthority properly retrust root cert on macOS

# 2.0.0

- requestCertificateForLocalhost changes
  - becomes sync
  - serverCertificateAltNames renamed altNames
  - serverCertificateValidityDurationInMs renamed validityDurationInMs
  - serverCertificateCommonName renamed commonName
  - returns { certificate, privateKey } instead of { serverCertificate, serverPrivateKey }
