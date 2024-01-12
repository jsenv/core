import { getAnyErrorInfo } from "./any.js";
import { getErrorInfoDefault } from "./default.js";
import { getReferenceErrorInfo } from "./reference.js";
import { getPrototypeErrorInfo } from "./prototype.js";
import { getPropertiesErrorInfo } from "./properties.js";
import { getPropertiesOrderErrorInfo } from "./properties_order.js";
import { getSymbolsErrorInfo } from "./symbols.js";
import { getSymbolsOrderErrorInfo } from "./symbols_order.js";
import { getSetSizeErrorInfo } from "./set_size.js";
import { getMapEntryErrorInfo } from "./map_entry.js";
import { getMatchesRegExpErrorInfo } from "./matches_reg_exp.js";
import { getNotErroInfo } from "./not.js";
import { getArrayLengthErrorInfo } from "./array_length.js";
import { getStringsErrorInfo } from "./strings.js";
import { getBetweenErrorInfo } from "./between.js";

export const getErrorInfo = (comparison, { format }) => {
  const failedComparison = deepestComparison(comparison);
  const errorInfoFromCandidates = firstFunctionReturningSomething(
    [
      getAnyErrorInfo,
      getMapEntryErrorInfo,
      getNotErroInfo,
      getMatchesRegExpErrorInfo,
      getPrototypeErrorInfo,
      getReferenceErrorInfo,
      getPropertiesErrorInfo,
      getPropertiesOrderErrorInfo,
      getSymbolsErrorInfo,
      getSymbolsOrderErrorInfo,
      getSetSizeErrorInfo,
      getArrayLengthErrorInfo,
      getStringsErrorInfo,
      getBetweenErrorInfo,
    ],
    failedComparison,
    { format },
  );
  return (
    errorInfoFromCandidates || getErrorInfoDefault(failedComparison, { format })
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

const firstFunctionReturningSomething = (fnCandidates, ...args) => {
  let i = 0;
  while (i < fnCandidates.length) {
    const fnCandidate = fnCandidates[i];
    const returnValue = fnCandidate(...args);
    if (returnValue !== null && returnValue !== undefined) {
      return returnValue;
    }
    i++;
  }
  return undefined;
};
