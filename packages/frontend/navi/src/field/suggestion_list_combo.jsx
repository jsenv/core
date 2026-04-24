import { useContext, useState } from "preact/hooks";

import { SuggestionFilterContext } from "./suggestion_list.jsx";

/**
 * SuggestionListCombo: wraps a SuggestionSearch + SuggestionList pair.
 *
 * Owns filter state and provides it via context so that:
 * - SuggestionSearch wires its input automatically
 * - Each Suggestion computes its own hidden state from the filter
 * - SuggestionList auto-injects sequential indices and highlight
 *
 * Usage:
 *   <SuggestionListCombo>
 *     <SuggestionSearch placeholder="Search…" />
 *     <SuggestionList maxHeight={280} uiAction={setValue}>
 *       {items.map((item) => (
 *         <Suggestion key={item} value={item}>{item}</Suggestion>
 *       ))}
 *     </SuggestionList>
 *   </SuggestionListCombo>
 *
 * match: optional custom match function (value, filter) => boolean
 */
export const SuggestionListCombo = ({ match, children }) => {
  const [filter, setFilter] = useState("");
  const ctx = { filter, setFilter, match };
  return (
    <SuggestionFilterContext.Provider value={ctx}>
      {children}
    </SuggestionFilterContext.Provider>
  );
};

/**
 * SuggestionSearch: a search input wired to the nearest SuggestionListCombo.
 * All props are forwarded to the underlying <input>.
 */
export const SuggestionSearch = ({ onInput, ...rest }) => {
  const filterCtx = useContext(SuggestionFilterContext);
  if (!filterCtx) {
    throw new Error("SuggestionSearch must be used inside SuggestionListCombo");
  }
  const { filter, setFilter } = filterCtx;
  return (
    <input
      type="search"
      value={filter}
      onInput={(e) => {
        setFilter(e.target.value);
        onInput?.(e);
      }}
      {...rest}
    />
  );
};
