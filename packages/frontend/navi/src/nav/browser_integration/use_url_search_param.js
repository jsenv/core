import { amendSearch } from "../amend_search.js";
import { navTo } from "./browser_integration.js";
import { documentUrlSignal } from "./document_url_signal.js";

/**
 * One search param of the address, read and written without a route.
 *
 * The value is the address's, read at each render: `defaultValue` while the
 * address has none. The setter writes the param, or takes it out of the
 * address for `undefined` or `null`, and replaces the entry by default — the
 * page answering where it stands, as a state signal's write does; `{ replace:
 * false }` pushes one.
 *
 * @param {string} paramName
 * @param {string} [defaultValue]
 * @returns {[string|undefined, (value: unknown, options?: { replace?: boolean }) => void]}
 */
export const useUrlSearchParam = (paramName, defaultValue) => {
  const documentUrl = documentUrlSignal.value;
  const searchParam = new URL(documentUrl).searchParams.get(paramName);
  const value = searchParam === null ? defaultValue : searchParam;

  // The query edited as written: the other pairs (a route's array param among
  // them) stay as they are (see amendSearch).
  const setSearchParamValue = (newValue, { replace = true } = {}) => {
    const newUrlObject = new URL(documentUrlSignal.peek());
    newUrlObject.search = amendSearch(
      newUrlObject.search,
      (name) => name === paramName,
      newValue === undefined || newValue === null
        ? []
        : [
            `${encodeURIComponent(paramName)}=${encodeURIComponent(String(newValue))}`,
          ],
    );
    navTo(newUrlObject.href, { replace });
  };

  return [value, setSearchParamValue];
};
