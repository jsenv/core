import {
  applyAlgoToRepresentationData,
  getPrioritizedHashFunction,
} from "./integrity_algorithms.js";
import { parseIntegrity } from "./integrity_parsing.js";

export const updateIntegrity = (integrity, representationData) => {
  const integrityMetadata = parseIntegrity(integrity);
  const algos = Object.keys(integrityMetadata);
  if (algos.length === 0) {
    return "";
  }
  let strongestAlgo = algos[0];
  algos.slice(1).forEach((algoCandidate) => {
    strongestAlgo =
      getPrioritizedHashFunction(strongestAlgo, algoCandidate) || strongestAlgo;
  });
  const base64Value = applyAlgoToRepresentationData(
    strongestAlgo,
    representationData,
  );
  return `${strongestAlgo}-${base64Value}`;
};
