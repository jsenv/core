import { createContext } from "preact";
import { useId, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  ListboxIdContext,
  SuggestionFilterContext,
  SuggestionMatchContext,
} from "./suggestion_list.jsx";

export const SetFilterContext = createContext();

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
  const listboxId = useId();
  return (
    <Box {...props} baseClassName="navi_suggestion_list_combo">
      <SuggestionMatchContext.Provider value={match}>
        <SuggestionFilterContext.Provider value={filter}>
          <SetFilterContext.Provider value={setFilter}>
            <ListboxIdContext.Provider value={listboxId}>
              {children}
            </ListboxIdContext.Provider>
          </SetFilterContext.Provider>
        </SuggestionFilterContext.Provider>
      </SuggestionMatchContext.Provider>
    </Box>
  );
};
const defaultMatch = (v, filter) => String(v).toLowerCase().includes(filter);
