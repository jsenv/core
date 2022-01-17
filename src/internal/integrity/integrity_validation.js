import { parseIntegrity } from "./integrity_parsing.js"
import {
  getPrioritizedHashFunction,
  applyAlgoToRepresentationData,
} from "./integrity_algorithms.js"

// https://www.w3.org/TR/SRI/#does-response-match-metadatalist
export const validateResponseIntegrity = async (response, integrity) => {
  if (!isResponseEligibleForIntegrityValidation(response)) {
    return false
  }
  const integrityMetadata = parseIntegrity(integrity)
  const algos = Object.keys(integrityMetadata)
  if (algos.length === 0) {
    return true
  }
  let strongestAlgo = algos[0]
  algos.slice(1).forEach((algoCandidate) => {
    strongestAlgo =
      getPrioritizedHashFunction(strongestAlgo, algoCandidate) || strongestAlgo
  })
  const metadataList = integrityMetadata[strongestAlgo]
  const dataRepresentation = Buffer.from(await response.arrayBuffer())
  const actualBase64Value = applyAlgoToRepresentationData(
    strongestAlgo,
    dataRepresentation,
  )
  const acceptedBase64Values = metadataList.map(
    (metadata) => metadata.base64Value,
  )
  const someIsMatching = acceptedBase64Values.includes(actualBase64Value)
  if (someIsMatching) {
    return true
  }
  const error = new Error(
    `Integrity checksum failed for ${response.url} using "${strongestAlgo}" algorithm`,
  )
  error.code = "EINTEGRITY"
  error.found = actualBase64Value
  error.expected = acceptedBase64Values
  error.algorithm = strongestAlgo
  throw error
}

// https://www.w3.org/TR/SRI/#is-response-eligible-for-integrity-validation
const isResponseEligibleForIntegrityValidation = (response) => {
  return ["basic", "cors", "default"].includes(response.type)
}
