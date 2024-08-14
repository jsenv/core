// https://github.com/digitalbazaar/forge/blob/master/examples/create-cert.js
// https://github.com/digitalbazaar/forge/issues/660#issuecomment-467145103

import { forge } from "./forge.js"
import {
  attributeArrayFromAttributeDescription,
  attributeDescriptionFromAttributeArray,
  subjectAltNamesFromAltNames,
  extensionArrayFromExtensionDescription,
} from "./certificate_data_converter.js"

export const createAuthorityRootCertificate = async ({
  commonName,
  countryName,
  stateOrProvinceName,
  localityName,
  organizationName,
  organizationalUnitName,
  validityDurationInMs,
  serialNumber,
} = {}) => {
  if (typeof serialNumber !== "number") {
    throw new TypeError(`serial must be a number but received ${serialNumber}`)
  }

  const { pki } = forge
  const rootCertificateForgeObject = pki.createCertificate()
  const keyPair = pki.rsa.generateKeyPair(2048) // TODO: use async version https://github.com/digitalbazaar/forge#rsa
  const rootCertificatePublicKeyForgeObject = keyPair.publicKey
  const rootCertificatePrivateKeyForgeObject = keyPair.privateKey

  rootCertificateForgeObject.publicKey = rootCertificatePublicKeyForgeObject
  rootCertificateForgeObject.serialNumber = serialNumber.toString(16)
  rootCertificateForgeObject.validity.notBefore = new Date()
  rootCertificateForgeObject.validity.notAfter = new Date(
    Date.now() + validityDurationInMs,
  )
  rootCertificateForgeObject.setSubject(
    attributeArrayFromAttributeDescription({
      commonName,
      countryName,
      stateOrProvinceName,
      localityName,
      organizationName,
      organizationalUnitName,
    }),
  )
  rootCertificateForgeObject.setIssuer(
    attributeArrayFromAttributeDescription({
      commonName,
      countryName,
      stateOrProvinceName,
      localityName,
      organizationName,
      organizationalUnitName,
    }),
  )
  rootCertificateForgeObject.setExtensions(
    extensionArrayFromExtensionDescription({
      basicConstraints: {
        critical: true,
        cA: true,
      },
      keyUsage: {
        critical: true,
        digitalSignature: true,
        keyCertSign: true,
        cRLSign: true,
      },
      // extKeyUsage: {
      //   serverAuth: true,
      //   clientAuth: true,
      // },
      // subjectKeyIdentifier: {},
    }),
  )

  // self-sign certificate
  rootCertificateForgeObject.sign(rootCertificatePrivateKeyForgeObject) // , forge.sha256.create())

  return {
    rootCertificateForgeObject,
    rootCertificatePublicKeyForgeObject,
    rootCertificatePrivateKeyForgeObject,
  }
}

export const requestCertificateFromAuthority = ({
  authorityCertificateForgeObject, // could be intermediate or root certificate authority
  auhtorityCertificatePrivateKeyForgeObject,
  serialNumber,
  altNames = [],
  commonName,
  validityDurationInMs,
}) => {
  if (
    typeof authorityCertificateForgeObject !== "object" ||
    authorityCertificateForgeObject === null
  ) {
    throw new TypeError(
      `authorityCertificateForgeObject must be an object but received ${authorityCertificateForgeObject}`,
    )
  }
  if (
    typeof auhtorityCertificatePrivateKeyForgeObject !== "object" ||
    auhtorityCertificatePrivateKeyForgeObject === null
  ) {
    throw new TypeError(
      `auhtorityCertificatePrivateKeyForgeObject must be an object but received ${auhtorityCertificatePrivateKeyForgeObject}`,
    )
  }
  if (typeof serialNumber !== "number") {
    throw new TypeError(
      `serialNumber must be a number but received ${serialNumber}`,
    )
  }

  const { pki } = forge
  const certificateForgeObject = pki.createCertificate()
  const keyPair = pki.rsa.generateKeyPair(2048) // TODO: use async version https://github.com/digitalbazaar/forge#rsa
  const certificatePublicKeyForgeObject = keyPair.publicKey
  const certificatePrivateKeyForgeObject = keyPair.privateKey

  certificateForgeObject.publicKey = certificatePublicKeyForgeObject
  certificateForgeObject.serialNumber = serialNumber.toString(16)
  certificateForgeObject.validity.notBefore = new Date()
  certificateForgeObject.validity.notAfter = new Date(
    Date.now() + validityDurationInMs,
  )

  const attributeDescription = {
    ...attributeDescriptionFromAttributeArray(
      authorityCertificateForgeObject.subject.attributes,
    ),
    commonName,
    // organizationName: serverCertificateOrganizationName
  }
  const attributeArray =
    attributeArrayFromAttributeDescription(attributeDescription)
  certificateForgeObject.setSubject(attributeArray)
  certificateForgeObject.setIssuer(
    authorityCertificateForgeObject.subject.attributes,
  )
  certificateForgeObject.setExtensions(
    extensionArrayFromExtensionDescription({
      basicConstraints: {
        critical: true,
        cA: false,
      },
      keyUsage: {
        critical: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      extKeyUsage: {
        critical: false,
        serverAuth: true,
      },
      authorityKeyIdentifier: {
        critical: false,
        // keyIdentifier: authorityCertificateForgeObject.generateSubjectKeyIdentifier().getBytes(),
        authorityCertIssuer: true,
        serialNumber: Number(0).toString(16),
      },
      subjectAltName: {
        critical: false,
        altNames: subjectAltNamesFromAltNames(altNames),
      },
    }),
  )
  certificateForgeObject.sign(
    auhtorityCertificatePrivateKeyForgeObject,
    forge.sha256.create(),
  )

  return {
    certificateForgeObject,
    certificatePublicKeyForgeObject,
    certificatePrivateKeyForgeObject,
  }
}
