import { useRef, useState } from "preact/hooks";

import { amendSearch } from "../amend_search.js";
import { navTo } from "./browser_integration.js";
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

  // The query edited as written: the other pairs (a route's array param among
  // them) stay as they are (see amendSearch).
  const setSearchParamValue = (newValue, { replace = false } = {}) => {
    const newUrlObject = new URL(documentUrlSignal.peek());
    newUrlObject.search = amendSearch(
      newUrlObject.search,
      (name) => name === paramName,
      [
        `${encodeURIComponent(paramName)}=${encodeURIComponent(String(newValue))}`,
      ],
    );
    const newUrl = newUrlObject.href;
    navTo(newUrl, { replace });
  };

  return [value, setSearchParamValue];
};
