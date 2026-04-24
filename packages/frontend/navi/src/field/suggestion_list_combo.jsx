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
 *
 * Automatically:
 * - Reads/writes the filter from SuggestionFilterContext
 * - Forwards keyboard shortcuts (arrows, enter, escape) to the listbox
 * - Sets aria-controls / aria-autocomplete / aria-haspopup on itself
 */
export const SuggestionSearch = ({ onInput, onKeyDown, ...rest }) => {
  const filter = useContext(SuggestionFilterContext);
  const setFilter = useContext(SetFilterContext);
  if (!setFilter) {
    throw new Error("SuggestionSearch must be used inside SuggestionListCombo");
  }
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    const inputEl = inputRef.current;
    if (!inputEl) {
      return undefined;
    }
    const combo = inputEl.closest(".navi_suggestion_list_combo");
    const listbox = combo ? combo.querySelector("[role='listbox']") : null;
    if (listbox) {
      inputEl.setAttribute("aria-controls", listbox.id);
      inputEl.setAttribute("aria-autocomplete", "list");
      inputEl.setAttribute("aria-haspopup", "listbox");
    }
    const handleKeyDown = (e) => {
      const comboEl = inputEl.closest(".navi_suggestion_list_combo");
      const listboxEl = comboEl
        ? comboEl.querySelector("[role='listbox']")
        : null;
      if (!listboxEl) {
        return;
      }
      let eventName = null;
      let detail = null;
      if (e.key === "ArrowDown") {
        eventName = "navi_list_navigate";
        detail = { direction: "down", event: e };
      } else if (e.key === "ArrowUp") {
        eventName = "navi_list_navigate";
        detail = { direction: "up", event: e };
      } else if (e.key === "Home") {
        eventName = "navi_list_navigate";
        detail = { direction: "first", event: e };
      } else if (e.key === "End") {
        eventName = "navi_list_navigate";
        detail = { direction: "last", event: e };
      } else if (e.key === "Enter") {
        eventName = "navi_list_confirm";
        detail = { event: e };
      } else if (e.key === "Escape") {
        eventName = "navi_list_clear";
        detail = { event: e };
      }
      if (!eventName) {
        return;
      }
      const customEvent = new CustomEvent(eventName, {
        cancelable: true,
        detail,
      });
      listboxEl.dispatchEvent(customEvent);
      if (customEvent.defaultPrevented) {
        e.preventDefault();
      }
    };
    inputEl.addEventListener("keydown", handleKeyDown);
    return () => {
      inputEl.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="search"
      value={filter}
      onInput={(e) => {
        setFilter(e.target.value);
        onInput?.(e);
      }}
      onKeyDown={onKeyDown}
      {...rest}
    />
  );
};
