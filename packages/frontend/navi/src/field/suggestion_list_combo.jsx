import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  SuggestionFilterContext,
  SuggestionMatchContext,
} from "./suggestion_list.jsx";

const SetFilterContext = createContext();

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
export const SuggestionListCombo = ({
  match = defaultMatch,
  children,
  ...props
}) => {
  const [filter, setFilter] = useState("");
  return (
    <Box {...props} baseClassName="navi_suggestion_list_combo">
      <SuggestionMatchContext.Provider value={match}>
        <SuggestionFilterContext.Provider value={filter}>
          <SetFilterContext.Provider value={setFilter}>
            {children}
          </SetFilterContext.Provider>
        </SuggestionFilterContext.Provider>
      </SuggestionMatchContext.Provider>
    </Box>
  );
};
const defaultMatch = (v, filter) => String(v).toLowerCase().includes(filter);

/**
 * SuggestionSearch: a search input wired to the nearest SuggestionListCombo.
 * All props are forwarded to the underlying <input>.
 */
export const SuggestionSearch = ({ onInput, ...rest }) => {
  const filter = useContext(SuggestionFilterContext);
  const setFilter = useContext(SetFilterContext);
  if (!setFilter) {
    throw new Error("SuggestionSearch must be used inside SuggestionListCombo");
  }
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
