import { createIterableWeakSet } from "@jsenv/dom";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

const paramScopeWeakSet = createIterableWeakSet();
let paramScopeIdCounter = 0;
export const getParamScope = (params) => {
  for (const existingParamScope of paramScopeWeakSet) {
    if (compareTwoJsValues(existingParamScope.params, params)) {
      return existingParamScope;
    }
  }
  const id = Symbol(`paramScope-${++paramScopeIdCounter}`);
  const newParamScope = {
    params,
    id,
  };
  paramScopeWeakSet.add(newParamScope);
  return newParamScope;
};
