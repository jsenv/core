import { anyComparisonToErrorMessage } from "./error_message/any.js";
import { defaultComparisonToErrorMessage } from "./error_message/default.js";
import { referenceComparisonToErrorMessage } from "./error_message/reference.js";
import { prototypeComparisonToErrorMessage } from "./error_message/prototype.js";
import { propertiesComparisonToErrorMessage } from "./error_message/properties.js";
import { propertiesOrderComparisonToErrorMessage } from "./error_message/properties_order.js";
import { symbolsComparisonToErrorMessage } from "./error_message/symbols.js";
import { symbolsOrderComparisonToErrorMessage } from "./error_message/symbols_order.js";
import { setSizeComparisonToMessage } from "./error_message/set_size.js";
import { mapEntryComparisonToErrorMessage } from "./error_message/map_entry.js";
import { matchesRegExpToErrorMessage } from "./error_message/matches_reg_exp.js";
import { notComparisonToErrorMessage } from "./error_message/not.js";
import { arrayLengthComparisonToMessage } from "./error_message/array_length.js";
import { stringsComparisonToErrorMessage } from "./error_message/strings.js";
import { betweenComparisonToMessage } from "./error_message/between.js";

export const errorMessageFromComparison = (comparison) => {
  const failedComparison = deepestComparison(comparison);
  const errorMessageFromCandidates = firstFunctionReturningSomething(
    [
      anyComparisonToErrorMessage,
      mapEntryComparisonToErrorMessage,
      notComparisonToErrorMessage,
      matchesRegExpToErrorMessage,
      prototypeComparisonToErrorMessage,
      referenceComparisonToErrorMessage,
      propertiesComparisonToErrorMessage,
      propertiesOrderComparisonToErrorMessage,
      symbolsComparisonToErrorMessage,
      symbolsOrderComparisonToErrorMessage,
      setSizeComparisonToMessage,
      arrayLengthComparisonToMessage,
      stringsComparisonToErrorMessage,
      betweenComparisonToMessage,
    ],
    failedComparison,
  );
  return (
    errorMessageFromCandidates ||
    defaultComparisonToErrorMessage(failedComparison)
  );
};

const deepestComparison = (comparison) => {
  let current = comparison;

  while (current) {
    const { children } = current;
    if (children.length === 0) break;
    current = children[children.length - 1];
  }

  return current;
};

const firstFunctionReturningSomething = (fnCandidates, failedComparison) => {
  let i = 0;
  while (i < fnCandidates.length) {
    const fnCandidate = fnCandidates[i];
    const returnValue = fnCandidate(failedComparison);
    if (returnValue !== null && returnValue !== undefined) {
      return returnValue;
    }
    i++;
  }
  return undefined;
};
