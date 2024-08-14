import { createValidityDurationOfXYears } from "./validity_duration.js"

export const jsenvParameters = {
  certificateCommonName: "https local root certificate",
  certificateValidityDurationInMs: createValidityDurationOfXYears(20),
}

// const jsenvCertificateParams = {
//   rootCertificateOrganizationName: "jsenv",
//   rootCertificateOrganizationalUnitName: "local-https-certificates",
//   rootCertificateCountryName: "FR",
//   rootCertificateStateOrProvinceName: "Alpes Maritimes",
//   rootCertificateLocalityName: "Valbonne",
// }
