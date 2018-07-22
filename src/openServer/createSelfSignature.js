// https://github.com/digitalbazaar/forge/blob/master/examples/create-cert.js

import forge from "node-forge"

export const createSelfSignature = () => {
  const { pki } = forge

  const { privateKey, publicKey } = pki.rsa.generateKeyPair(1024)

  const cert = pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = "01"
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)

  const attrs = [
    {
      name: "commonName",
      value: "example.org",
    },
    {
      name: "countryName",
      value: "US",
    },
    {
      shortName: "ST",
      value: "Virginia",
    },
    {
      name: "localityName",
      value: "Blacksburg",
    },
    {
      name: "organizationName",
      value: "Test",
    },
    {
      shortName: "OU",
      value: "Test",
    },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    {
      name: "basicConstraints",
      cA: true,
    },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: "extKeyUsage",
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true,
    },
    {
      name: "nsCertType",
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true,
    },
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 6, // URI
          value: "http://example.org/webid#me",
        },
        {
          type: 7, // IP
          ip: "127.0.0.1",
        },
      ],
    },
    {
      name: "subjectKeyIdentifier",
    },
  ])
  // FIXME: add authorityKeyIdentifier extension

  // self-sign certificate
  cert.sign(privateKey /* , forge.md.sha256.create()*/)

  return {
    privateKey: pki.privateKeyToPem(privateKey),
    publicKey: pki.publicKeyToPem(publicKey),
    certificate: pki.certificateToPem(cert),
  }
}
