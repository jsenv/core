import { createContext } from "preact";
import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { createItemTracker } from "./item_tracker/item_tracker.jsx";

const [useSuggestionItemTrackerProvider, useTrackSuggestion] =
  createItemTracker();

/**
 * SuggestionList + Suggestion: a composable accessible listbox.
 *
 * Usage:
 *   <SuggestionList id="my-list" value={selected} onChange={setSelected}>
 *     <Suggestion value="a">Option A</Suggestion>
 *     <Suggestion value="b">Option B</Suggestion>
 *   </SuggestionList>
 *
 * CSS vars on .navi_suggestion_list:
 *   --suggestion-list-border-radius, --suggestion-list-border-width, --suggestion-list-border-color, --suggestion-list-background-color, --suggestion-list-max-height
 *
 * CSS vars on .navi_suggestion:
 *   --suggestion-padding, --suggestion-color, --suggestion-background-color, --suggestion-font-weight
 *   --suggestion-color-hover, --suggestion-background-color-hover
 *   --suggestion-color-pointed, --suggestion-background-color-pointed
 *   --suggestion-color-selected, --suggestion-background-color-selected, --suggestion-font-weight-selected
 *   --suggestion-color-pointed-selected, --suggestion-background-color-pointed-selected
 *   --suggestion-color-highlight, --suggestion-background-color-highlight
 *
 * CSS vars on .navi_suggestion_group_label:
 *   --suggestion-group-label-padding, --suggestion-group-label-color, --suggestion-group-label-font-size, --suggestion-group-label-font-weight
 */

const css = /* css */ `
  @layer navi {
    .navi_suggestion_list {
      --suggestion-list-border-radius: 4px;
      --suggestion-list-border-width: 1px;
      --suggestion-list-border-color: light-dark(#ccc, #555);
      --suggestion-list-border-style: solid;
      --suggestion-list-background-color: light-dark(#fff, #1e1e1e);
      --suggestion-list-max-height: 220px;
    }
    .navi_suggestion_group_label {
      --suggestion-group-label-padding: 4px 12px 2px;
      --suggestion-group-label-color: light-dark(#888, #aaa);
      --suggestion-group-label-font-size: 0.75em;
      --suggestion-group-label-font-weight: 600;
    }
    .navi_suggestion {
      --suggestion-padding: 8px 12px;
      --suggestion-color: inherit;
      --suggestion-background-color: transparent;
      --suggestion-font-weight: inherit;

      /* Hover (mouse) */
      --suggestion-color-hover: var(--suggestion-color);
      --suggestion-background-color-hover: light-dark(#f5f5f5, #2a2a2a);

      /* Pointed (keyboard navigation position) */
      --suggestion-color-pointed: var(--suggestion-color);
      --suggestion-background-color-pointed: light-dark(#e8f0fe, #1c3a6e);

      /* Selected */
      --suggestion-color-selected: light-dark(#1a73e8, #7baaf7);
      --suggestion-background-color-selected: light-dark(#e8f0fe, #1c3a6e);
      --suggestion-font-weight-selected: 500;

      /* Highlight (CSS Highlight API match) */
      --suggestion-color-highlight: inherit;
      --suggestion-background-color-highlight: #ffe066;
      --suggestion-color-pointed-selected: var(--suggestion-color-selected);
      --suggestion-background-color-pointed-selected: light-dark(
        #d2e3fc,
        #174ea6
      );
    }
  }

  .navi_suggestion_list {
    --x-border-radius: var(--suggestion-list-border-radius);
    --x-border-width: var(--suggestion-list-border-width);
    --x-border-color: var(--suggestion-list-border-color);
    --x-border-style: var(--suggestion-list-border-style);
    --x-background-color: var(--suggestion-list-background-color);
    box-sizing: border-box;
    width: fit-content;
    min-width: var(--suggestion-list-anchor-width, 0px);
    max-width: 95vw;
    max-height: var(--suggestion-list-max-height);
    margin: 0;
    padding: 0;
    list-style: none;
    background-color: var(--x-background-color);
    border: var(--x-border-width) var(--x-border-style) var(--x-border-color);
    border-radius: var(--x-border-radius);
    transition: opacity 0.2s ease;
    overflow-y: auto;

    /* Popover reset — browser adds border, background, padding, margin by default */
    &[popover] {
      position: absolute;
      inset: unset;
      margin: 0;
      padding: 0;
      /* border: none; */
    }
    &[data-anchor-hidden] {
      opacity: 0;
      pointer-events: none;
    }
  }
  ::highlight(navi-suggestion-match) {
    color: var(--suggestion-color-highlight);
    background-color: var(--suggestion-background-color-highlight);
  }
  .navi_suggestion {
    --x-color: var(--suggestion-color);
    --x-background-color: var(--suggestion-background-color);
    --x-font-weight: var(--suggestion-font-weight);
    box-sizing: border-box;

    padding: var(--suggestion-padding);
    color: var(--x-color);
    font-weight: var(--x-font-weight);
    background-color: var(--x-background-color);
    cursor: pointer;
    user-select: none;

    &:hover {
      --x-color: var(--suggestion-color-hover);
      --x-background-color: var(--suggestion-background-color-hover);
    }

    &[data-pointed] {
      --x-color: var(--suggestion-color-pointed);
      --x-background-color: var(--suggestion-background-color-pointed);
    }

    &[data-selected] {
      --x-color: var(--suggestion-color-selected);
      --x-background-color: var(--suggestion-background-color-selected);
      --x-font-weight: var(--suggestion-font-weight-selected);
    }

    &[data-pointed][data-selected] {
      --x-color: var(--suggestion-color-pointed-selected);
      --x-background-color: var(--suggestion-background-color-pointed-selected);
    }
  }
  .navi_suggestion_group_label {
    position: sticky;
    top: 0;
    z-index: 1;
    display: block;
    padding: var(--suggestion-group-label-padding);
    color: var(--suggestion-group-label-color);
    font-weight: var(--suggestion-group-label-font-weight);
    font-size: var(--suggestion-group-label-font-size);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: var(--suggestion-group-label-background-color);
    user-select: none;
  }
  .navi_suggestion_list_empty {
    display: none;
    padding: var(--suggestion-padding);
    color: var(--suggestion-group-label-color);
    font-size: 0.9em;
    text-align: center;
    user-select: none;
  }
  /* Show the empty state only when there are no visible suggestions */
  .navi_suggestion_list:not(:has([role="option"]:not([hidden]))) {
    .navi_suggestion_list_empty {
      display: block;
    }
  }
`;

const SuggestionListStyleCSSVars = {
  borderRadius: "--suggestion-list-border-radius",
  borderWidth: "--suggestion-list-border-width",
  borderColor: "--suggestion-list-border-color",
  backgroundColor: "--suggestion-list-background-color",
  maxHeight: "--suggestion-list-max-height",
};
const SuggestionStyleCSSVars = {
  "padding": "--suggestion-padding",
  "color": "--suggestion-color",
  "backgroundColor": "--suggestion-background-color",
  "fontWeight": "--suggestion-font-weight",
  ":-navi-pointed": {
    color: "--suggestion-color-pointed",
    backgroundColor: "--suggestion-background-color-pointed",
  },
  ":hover": {
    color: "--suggestion-color-hover",
    backgroundColor: "--suggestion-background-color-hover",
  },
  ":-navi-selected": {
    color: "--suggestion-color-selected",
    backgroundColor: "--suggestion-background-color-selected",
    fontWeight: "--suggestion-font-weight-selected",
  },
  "::highlight": {
    color: "--suggestion-color-highlight",
    backgroundColor: "--suggestion-background-color-highlight",
  },
};

/**
 * Context OptionList provides downward to its Option children.
 */
const SuggestionListContext = createContext(null);
export const SuggestionList = ({
  popover,
  onChange: onChangeProp,
  highlight,
  emptyState = "No results",
  children,
  ...rest
}) => {
  import.meta.css = css;

  const ItemTrackerProvider = useSuggestionItemTrackerProvider();
  const [pointedValue, setPointedValue] = useState(null);
  const pointedValueRef = useRef(null);
  pointedValueRef.current = pointedValue;

  const ownId = useId();
  const id = rest.id ?? ownId;

  const defaultRef = useRef(null);
  const ref = rest.ref || defaultRef;

  useLayoutEffect(() => {
    if (!CSS.highlights) {
      return undefined;
    }
    if (!highlight) {
      CSS.highlights.delete("navi-suggestion-match");
      return undefined;
    }
    const listEl = ref.current;
    if (!listEl) {
      return undefined;
    }
    const ranges = [];
    const lowerHighlight = highlight.toLowerCase();
    for (const suggestionEl of listEl.querySelectorAll("[role='option']")) {
      const walker = document.createTreeWalker(
        suggestionEl,
        NodeFilter.SHOW_TEXT,
      );
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent;
        const lowerText = text.toLowerCase();
        let index = lowerText.indexOf(lowerHighlight);
        while (index !== -1) {
          const range = new Range();
          range.setStart(node, index);
          range.setEnd(node, index + highlight.length);
          ranges.push(range);
          index = lowerText.indexOf(lowerHighlight, index + 1);
        }
      }
    }
    if (ranges.length === 0) {
      CSS.highlights.delete("navi-suggestion-match");
    } else {
      CSS.highlights.set("navi-suggestion-match", new Highlight(...ranges));
    }
    return () => {
      CSS.highlights.delete("navi-suggestion-match");
    };
  }, [highlight, children]);
  const effectiveOnChange = popover
    ? (value) => {
        onChangeProp?.(value);
        ref.current?.dispatchEvent(
          new CustomEvent("navi_suggestion_list_selected", {
            detail: { value },
            bubbles: true,
          }),
        );
      }
    : onChangeProp;
  const onChangeRef = useRef(effectiveOnChange);
  onChangeRef.current = effectiveOnChange;

  const navigate = (direction) => {
    const values = ItemTrackerProvider.items
      .filter((item) => !item.hidden)
      .map((item) => item.value);
    if (values.length === 0) {
      return false;
    }
    const current = pointedValueRef.current;
    if (direction === "down") {
      const idx = current === null ? -1 : values.indexOf(current);
      setPointedValue(values[idx < values.length - 1 ? idx + 1 : idx]);
    } else if (direction === "up") {
      const idx = current === null ? -1 : values.indexOf(current);
      setPointedValue(values[idx > 0 ? idx - 1 : 0]);
    } else if (direction === "first") {
      setPointedValue(values[0]);
    } else if (direction === "last") {
      setPointedValue(values[values.length - 1]);
    }
    return true;
  };

  // Listen for commands dispatched by a linked Input (combobox mode)
  const noopRef = useRef(null);
  useEffect(() => {
    if (!popover || !ref.current) {
      return undefined;
    }
    const el = ref.current;
    const onNavigate = (e) => {
      navigate(e.detail.direction);
    };
    const onConfirm = (e) => {
      const current = pointedValueRef.current;
      if (current !== null) {
        onChangeRef.current?.(current);
        e.preventDefault();
      }
    };
    const onClear = () => {
      setPointedValue(null);
    };
    el.addEventListener("navi_suggestion_list_navigate", onNavigate);
    el.addEventListener("navi_suggestion_list_confirm", onConfirm);
    el.addEventListener("navi_suggestion_list_clear", onClear);
    return () => {
      el.removeEventListener("navi_suggestion_list_navigate", onNavigate);
      el.removeEventListener("navi_suggestion_list_confirm", onConfirm);
      el.removeEventListener("navi_suggestion_list_clear", onClear);
    };
  }, [popover]);

  useKeyboardShortcuts(popover ? noopRef : ref, [
    {
      key: "arrowdown",
      description: "Point to next suggestion",
      handler: () => navigate("down"),
    },
    {
      key: "arrowup",
      description: "Point to previous suggestion",
      handler: () => navigate("up"),
    },
    {
      key: "home",
      description: "Point to first suggestion",
      handler: () => navigate("first"),
    },
    {
      key: "end",
      description: "Point to last suggestion",
      handler: () => navigate("last"),
    },
    {
      key: "enter",
      description: "Confirm pointed suggestion",
      handler: () => {
        const current = pointedValueRef.current;
        if (current === null) {
          return false;
        }
        onChangeRef.current?.(current);
        return true;
      },
    },
    {
      key: "escape",
      description: "Clear pointed suggestion",
      handler: () => {
        setPointedValue(null);
        return true;
      },
    },
  ]);

  const suggestionListContext = {
    pointedValue,
    setPointedValue,
    onSelect: effectiveOnChange,
  };

  return (
    <Box
      as="ul"
      ref={ref}
      id={id}
      role="listbox"
      tabIndex={popover ? -1 : 0}
      popover={popover ? "manual" : undefined}
      {...rest}
      baseClassName="navi_suggestion_list"
      styleCSSVars={SuggestionListStyleCSSVars}
    >
      <SuggestionListContext.Provider value={suggestionListContext}>
        <ItemTrackerProvider>{children}</ItemTrackerProvider>
        {emptyState && (
          <li className="navi_suggestion_list_empty">{emptyState}</li>
        )}
      </SuggestionListContext.Provider>
    </Box>
  );
};

const SUGGESTION_PSEUDO_CLASSES = [":-navi-pointed", ":-navi-selected"];
const SUGGESTION_PSEUDO_ELEMENTS = ["::highlight"];
export const Suggestion = ({ value, selected, hidden, children, ...rest }) => {
  import.meta.css = css;

  const suggestionId = useId();
  const id = rest.id || suggestionId;
  useTrackSuggestion({ value, suggestionId: id, hidden });
  const { pointedValue, setPointedValue, onSelect } = useContext(
    SuggestionListContext,
  );

  const isPointed = pointedValue === value;
  const suggestionRef = useRef(null);

  useEffect(() => {
    const suggestionEl = suggestionRef.current;
    if (isPointed && suggestionEl) {
      suggestionEl.scrollIntoView({ block: "nearest" });
    }
  }, [isPointed]);

  return (
    <Box
      as="li"
      ref={suggestionRef}
      baseClassName="navi_suggestion"
      id={suggestionId}
      role="option"
      aria-selected={selected}
      aria-hidden={hidden ? true : undefined}
      hidden={hidden}
      basePseudoState={{
        ":-navi-pointed": isPointed,
        ":-navi-selected": selected,
      }}
      pseudoClasses={SUGGESTION_PSEUDO_CLASSES}
      pseudoElements={SUGGESTION_PSEUDO_ELEMENTS}
      styleCSSVars={SuggestionStyleCSSVars}
      onMouseEnter={() => {
        if (!hidden) {
          setPointedValue(value);
        }
      }}
      onMouseLeave={() => {
        if (!hidden) {
          setPointedValue(null);
        }
      }}
      onMouseDown={(e) => {
        if (hidden || e.button !== 0) {
          return;
        }
        onSelect?.(value);
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};

export const SuggestionGroup = ({ label, children, ...rest }) => {
  import.meta.css = css;
  const groupId = useId();
  return (
    <li role="presentation" {...rest}>
      <span
        id={groupId}
        role="presentation"
        aria-hidden="true"
        style={{ display: "contents" }}
      >
        {typeof label === "string" ? (
          <span className="navi_suggestion_group_label">{label}</span>
        ) : (
          label
        )}
      </span>
      <ul
        role="group"
        aria-labelledby={groupId}
        style={{ margin: 0, padding: 0, listStyle: "none" }}
      >
        {children}
      </ul>
    </li>
  );
};
