import {
  applyAlgoToRepresentationData,
  getPrioritizedHashFunction,
} from "./integrity_algorithms.js";
import { parseIntegrity } from "./integrity_parsing.js";

// https://www.w3.org/TR/SRI/#does-response-match-metadatalist
export const validateResponseIntegrity = (
  { url, type, dataRepresentation },
  integrity,
) => {
  if (!isResponseEligibleForIntegrityValidation({ type })) {
    return false;
  }
  const integrityMetadata = parseIntegrity(integrity);
  const algos = Object.keys(integrityMetadata);
  if (algos.length === 0) {
    return true;
  }
  let strongestAlgo = algos[0];
  algos.slice(1).forEach((algoCandidate) => {
    strongestAlgo =
      getPrioritizedHashFunction(strongestAlgo, algoCandidate) || strongestAlgo;
  });
  const metadataList = integrityMetadata[strongestAlgo];
  const actualBase64Value = applyAlgoToRepresentationData(
    strongestAlgo,
    dataRepresentation,
  );
  const acceptedBase64Values = metadataList.map(
    (metadata) => metadata.base64Value,
  );
  const someIsMatching = acceptedBase64Values.includes(actualBase64Value);
  if (someIsMatching) {
    return true;
  }
  const error = new Error(
    `Integrity validation failed for resource "${url}". The integrity found for this resource is "${strongestAlgo}-${actualBase64Value}"`,
  );
  error.code = "EINTEGRITY";
  error.algorithm = strongestAlgo;
  error.found = actualBase64Value;
  throw error;
};

// https://www.w3.org/TR/SRI/#is-response-eligible-for-integrity-validation
const isResponseEligibleForIntegrityValidation = (response) => {
  return ["basic", "cors", "default"].includes(response.type);
};
