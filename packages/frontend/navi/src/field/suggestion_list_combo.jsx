import { createContext } from "preact";
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";

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
 * lockSize: once the element first has non-zero dimensions, fix width+height so
 *           filtering cannot shrink the container (useful inside a dialog).
 */
export const SuggestionListCombo = ({
  match = defaultMatch,
  lockSize,
  children,
  ...props
}) => {
  const [filter, setFilter] = useState("");
  const listboxId = useId();
  const boxRef = useRef(null);

  useLayoutEffect(() => {
    if (!lockSize) {
      return undefined;
    }
    if (filter !== "") {
      return undefined;
    }
    const el = boxRef.current;
    if (!el) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      if (width === 0 && height === 0) {
        return;
      }
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      observer.disconnect();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [lockSize, filter]);

  return (
    <Box {...props} ref={boxRef} baseClassName="navi_suggestion_list_combo">
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
