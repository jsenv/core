import { createContext } from "preact";
import { useContext, useEffect, useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { createItemTracker } from "./item_tracker/item_tracker.jsx";

const [useOptionItemTrackerProvider, useTrackOption] = createItemTracker();

/**
 * OptionList + Option: a composable accessible listbox.
 *
 * Usage:
 *   <OptionList id="my-list" value={selected} onChange={setSelected}>
 *     <Option value="a">Option A</Option>
 *     <Option value="b">Option B</Option>
 *   </OptionList>
 *
 * CSS vars on .navi_option_list:
 *   --border-radius, --border-width, --border-color, --background-color, --max-height
 *
 * CSS vars on .navi_option:
 *   --padding, --color, --background-color, --font-weight
 *   --color-hover, --background-color-hover
 *   --color-pointed, --background-color-pointed
 *   --color-selected, --background-color-selected, --font-weight-selected
 *   --color-pointed-selected, --background-color-pointed-selected
 *   --color-highlight, --background-color-highlight
 */

const css = /* css */ `
  @layer navi {
    .navi_option_list {
      --border-radius: 4px;
      --border-width: 1px;
      --border-color: light-dark(#ccc, #555);
      --background-color: light-dark(#fff, #1e1e1e);
      --max-height: 220px;
    }
    .navi_option {
      --padding: 8px 12px;
      --color: inherit;
      --background-color: transparent;
      --font-weight: inherit;

      /* Hover (mouse) */
      --color-hover: var(--color);
      --background-color-hover: light-dark(#f5f5f5, #2a2a2a);

      /* Pointed (keyboard navigation position) */
      --color-pointed: var(--color);
      --background-color-pointed: light-dark(#e8f0fe, #1c3a6e);

      /* Selected */
      --color-selected: light-dark(#1a73e8, #7baaf7);
      --background-color-selected: light-dark(#e8f0fe, #1c3a6e);
      --font-weight-selected: 500;

      /* Highlight (CSS Highlight API match) */
      --color-highlight: inherit;
      --background-color-highlight: #ffe066;
      --color-pointed-selected: var(--color-selected);
      --background-color-pointed-selected: light-dark(#d2e3fc, #174ea6);
    }
  }

  .navi_option_list {
    --x-border-radius: var(--border-radius);
    --x-border-width: var(--border-width);
    --x-border-color: var(--border-color);
    --x-background-color: var(--background-color);
    box-sizing: border-box;
    max-height: var(--max-height);

    margin: 0;
    padding: 0;
    list-style: none;
    background-color: var(--x-background-color);
    border: var(--x-border-width) solid var(--x-border-color);
    border-radius: var(--x-border-radius);
    outline: none;
    overflow-y: auto;

    /* Popover reset — browser adds border, background, padding, margin by default */
    &[popover] {
      position: fixed;
      inset: unset;
      margin: 0;
      padding: 0;
      border: none;
    }
  }
  ::highlight(navi-option-match) {
    color: var(--color-highlight);
    background-color: var(--background-color-highlight);
  }
  .navi_option {
    --x-color: var(--color);
    --x-background-color: var(--background-color);
    --x-font-weight: var(--font-weight);

    padding: var(--padding);
    color: var(--x-color);
    font-weight: var(--x-font-weight);
    background-color: var(--x-background-color);
    cursor: pointer;
    user-select: none;

    &:hover {
      --x-color: var(--color-hover);
      --x-background-color: var(--background-color-hover);
    }

    &[data-pointed] {
      --x-color: var(--color-pointed);
      --x-background-color: var(--background-color-pointed);
    }

    &[data-selected] {
      --x-color: var(--color-selected);
      --x-background-color: var(--background-color-selected);
      --x-font-weight: var(--font-weight-selected);
    }

    &[data-pointed][data-selected] {
      --x-color: var(--color-pointed-selected);
      --x-background-color: var(--background-color-pointed-selected);
    }
  }
`;

const OptionListStyleCSSVars = {
  borderRadius: "--border-radius",
  borderWidth: "--border-width",
  borderColor: "--border-color",
  backgroundColor: "--background-color",
  maxHeight: "--max-height",
};
const OptionStyleCSSVars = {
  "padding": "--padding",
  "color": "--color",
  "backgroundColor": "--background-color",
  "fontWeight": "--font-weight",
  ":-navi-pointed": {
    color: "--color-pointed",
    backgroundColor: "--background-color-pointed",
  },
  ":hover": {
    color: "--color-hover",
    backgroundColor: "--background-color-hover",
  },
  ":-navi-selected": {
    color: "--color-selected",
    backgroundColor: "--background-color-selected",
    fontWeight: "--font-weight-selected",
  },
  ":highlight": {
    color: "--color-highlight",
    backgroundColor: "--background-color-highlight",
  },
};

/**
 * Context OptionList provides downward to its Option children.
 */
const OptionListContext = createContext(null);
export const OptionList = ({
  popover,
  onChange: onChangeProp,
  highlight,
  children,
  ...rest
}) => {
  import.meta.css = css;

  const ItemTrackerProvider = useOptionItemTrackerProvider();
  const [pointedValue, setPointedValue] = useState(null);
  const pointedValueRef = useRef(null);
  pointedValueRef.current = pointedValue;

  const ownId = useId();
  const id = rest.id ?? ownId;

  const defaultRef = useRef(null);
  const ref = rest.ref || defaultRef;

  useEffect(() => {
    if (!CSS.highlights) {
      return undefined;
    }
    if (!highlight) {
      CSS.highlights.delete("navi-option-match");
      return undefined;
    }
    const listEl = ref.current;
    if (!listEl) {
      return undefined;
    }
    const ranges = [];
    const lowerHighlight = highlight.toLowerCase();
    for (const optionEl of listEl.querySelectorAll("[role='option']")) {
      const walker = document.createTreeWalker(optionEl, NodeFilter.SHOW_TEXT);
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
      CSS.highlights.delete("navi-option-match");
    } else {
      CSS.highlights.set("navi-option-match", new Highlight(...ranges));
    }
    return () => {
      CSS.highlights.delete("navi-option-match");
    };
  }, [highlight, children]);
  const effectiveOnChange = popover
    ? (value) => {
        onChangeProp?.(value);
        ref.current?.dispatchEvent(
          new CustomEvent("navi_option_list_selected", {
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
    el.addEventListener("navi_option_list_navigate", onNavigate);
    el.addEventListener("navi_option_list_confirm", onConfirm);
    el.addEventListener("navi_option_list_clear", onClear);
    return () => {
      el.removeEventListener("navi_option_list_navigate", onNavigate);
      el.removeEventListener("navi_option_list_confirm", onConfirm);
      el.removeEventListener("navi_option_list_clear", onClear);
    };
  }, [popover]);

  useKeyboardShortcuts(popover ? noopRef : ref, [
    {
      key: "arrowdown",
      description: "Highlight next option",
      handler: () => navigate("down"),
    },
    {
      key: "arrowup",
      description: "Highlight previous option",
      handler: () => navigate("up"),
    },
    {
      key: "home",
      description: "Highlight first option",
      handler: () => navigate("first"),
    },
    {
      key: "end",
      description: "Highlight last option",
      handler: () => navigate("last"),
    },
    {
      key: "enter",
      description: "Select option at pointer",
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
      description: "Clear pointed option",
      handler: () => {
        setPointedValue(null);
        return true;
      },
    },
  ]);

  const optionListContext = {
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
      baseClassName="navi_option_list"
      styleCSSVars={OptionListStyleCSSVars}
    >
      <OptionListContext.Provider value={optionListContext}>
        <ItemTrackerProvider>{children}</ItemTrackerProvider>
      </OptionListContext.Provider>
    </Box>
  );
};

const OPTION_PSEUDO_CLASSES = [":-navi-pointed", ":-navi-selected"];
export const Option = ({ value, selected, hidden, children, ...rest }) => {
  import.meta.css = css;

  const optionId = useId();
  const id = rest.id || optionId;
  useTrackOption({ value, optionId: id, hidden });
  const { pointedValue, setPointedValue, onSelect } =
    useContext(OptionListContext);

  const isPointed = pointedValue === value;
  const optionRef = useRef(null);

  useEffect(() => {
    const optionEl = optionRef.current;
    if (isPointed && optionEl) {
      optionEl.scrollIntoView({ block: "nearest" });
    }
  }, [isPointed]);

  return (
    <Box
      as="li"
      ref={optionRef}
      baseClassName="navi_option"
      id={optionId}
      role="option"
      aria-selected={selected}
      aria-hidden={hidden ? true : undefined}
      hidden={hidden}
      basePseudoState={{
        ":-navi-pointed": isPointed,
        ":-navi-selected": selected,
      }}
      pseudoClasses={OPTION_PSEUDO_CLASSES}
      styleCSSVars={OptionStyleCSSVars}
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
