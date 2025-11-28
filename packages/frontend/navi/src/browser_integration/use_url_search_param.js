import { useRef, useState } from "preact/hooks";

import { goTo } from "./browser_integration.js";
import { documentUrlSignal } from "./document_url_signal.js";

const NEVER_SET = {};
export const useUrlSearchParam = (paramName, defaultValue) => {
  const documentUrl = documentUrlSignal.value;
  const searchParam = new URL(documentUrl).searchParams.get(paramName);
  const valueRef = useRef(NEVER_SET);
  const [value, setValue] = useState(defaultValue);
  if (valueRef.current !== searchParam) {
    valueRef.current = searchParam;
    setValue(searchParam);
  }

  const setSearchParamValue = (newValue, { replace = true } = {}) => {
    const newUrlObject = new URL(window.location.href);
    newUrlObject.searchParams.set(paramName, newValue);
    const newUrl = newUrlObject.href;
    goTo(newUrl, { replace });
  };

  return [value, setSearchParamValue];
};
