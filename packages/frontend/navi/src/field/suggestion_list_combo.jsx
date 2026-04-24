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
 * lockSize: measures the container once it first has non-zero dimensions (i.e.
 *           once it becomes visible, e.g. when a parent <dialog> opens), then
 *           sets minWidth/minHeight so filtering cannot shrink the container —
 *           the size is anchored to the fully-populated state. The container
 *           can still grow if content happens to be taller, hence min* and not
 *           a hard fixed size. sizeLocked ensures we only capture the size once,
 *           so a subsequent filter→clear cycle does not re-measure a smaller box.
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
  const sizeLocked = useRef(false);

  useLayoutEffect(() => {
    if (!lockSize) {
      return undefined;
    }
    if (sizeLocked.current) {
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
      el.style.minWidth = `${width}px`;
      el.style.minHeight = `${height}px`;
      sizeLocked.current = true;
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
