import { assert } from "@jsenv/assert"

import { forge } from "@jsenv/https-local/src/internal/forge.js"
import {
  createAuthorityRootCertificate,
  requestCertificateFromAuthority,
} from "@jsenv/https-local/src/internal/certificate_generator.js"
import { createLoggerForTest } from "@jsenv/https-local/tests/test_helpers.mjs"

const {
  rootCertificateForgeObject,
  rootCertificatePublicKeyForgeObject,
  rootCertificatePrivateKeyForgeObject,
} = await createAuthorityRootCertificate({
  logger: createLoggerForTest(),
  commonName: "https://github.com/jsenv/server",
  countryName: "FR",
  stateOrProvinceName: "Alpes Maritimes",
  localityName: "Valbonne",
  organizationName: "jsenv",
  organizationalUnitName: "jsenv server",
  validityDurationInMs: 100000,
  serialNumber: 0,
})

{
  const actual = {
    rootCertificateForgeObject,
    rootCertificatePublicKeyForgeObject,
    rootCertificatePrivateKeyForgeObject,
  }
  const expected = {
    rootCertificateForgeObject: assert.any(Object),
    rootCertificatePublicKeyForgeObject: assert.any(Object),
    rootCertificatePrivateKeyForgeObject: assert.any(Object),
  }
  assert({ actual, expected })
}

{
  const { pki } = forge
  // const rootCertificate = pki.certificateToPem(rootCertificateForgeObject)
  // const authorityCertificateForgeObject = pki.certificateFromPem(rootCertificate)
  const rootCertificatePrivateKey = pki.privateKeyToPem(
    rootCertificatePrivateKeyForgeObject,
  )
  await new Promise((resolve) => {
    setTimeout(resolve, 1000)
  })
  const auhtorityCertificatePrivateKeyForgeObject = pki.privateKeyFromPem(
    rootCertificatePrivateKey,
  )
  const actual = auhtorityCertificatePrivateKeyForgeObject
  const expected = auhtorityCertificatePrivateKeyForgeObject
  assert({ actual, expected })
}

{
  const {
    certificateForgeObject,
    certificatePublicKeyForgeObject,
    certificatePrivateKeyForgeObject,
  } = requestCertificateFromAuthority({
    authorityCertificateForgeObject: rootCertificateForgeObject,
    auhtorityCertificatePrivateKeyForgeObject:
      rootCertificatePrivateKeyForgeObject,
    serialNumber: 1,
    altNames: ["localhost"],
    validityDurationInMs: 10000,
  })
  const actual = {
    certificateForgeObject,
    certificatePublicKeyForgeObject,
    certificatePrivateKeyForgeObject,
  }
  const expected = {
    certificateForgeObject: assert.any(Object),
    certificatePublicKeyForgeObject: assert.any(Object),
    certificatePrivateKeyForgeObject: assert.any(Object),
  }
  assert({ actual, expected })

  // ici ça serais bien de tester des truc de forge,
  // genre que le certificat issuer est bien l'authorité
  // {
  //   const { pki } = forge
  //   const caStore = pki.createCaStore()
  //   caStore.addCertificate(rootCertificateForgeObject)
  //   caStore.addCertificate(certificateForgeObject)
  //   const actual = await new Promise((resolve) => {
  //     pki.verifyCertificateChain(
  //       caStore,
  //       [rootCertificateForgeObject, certificateForgeObject],
  //       (
  //         vfd,
  //         // depth,
  //         // chain
  //       ) => {
  //         if (vfd === true) {
  //           resolve() // certificateForgeObject.verifySubjectKeyIdentifier())
  //         }
  //       },
  //     )
  //   })
  //   const expected = false
  //   assert({ actual, expected })
  // }
}
