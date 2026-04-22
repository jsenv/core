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
 *   --color-highlighted, --background-color-highlighted
 *   --color-selected, --background-color-selected, --font-weight-selected
 *   --color-highlighted-selected, --background-color-highlighted-selected
 */

const css = /* css */ `
  @layer navi {
    .navi_option_list {
      --border-radius: 4px;
      --border-width: 1px;
      --border-color: light-dark(#ccc, #555);
      --background-color: light-dark(#fff, #1e1e1e);
      --max-height: none;
    }
    .navi_option {
      --padding: 8px 12px;
      --color: inherit;
      --background-color: transparent;
      --font-weight: inherit;

      /* Hover (mouse) */
      --color-hover: var(--color);
      --background-color-hover: light-dark(#f5f5f5, #2a2a2a);

      /* Highlighted (keyboard navigation cursor) */
      --color-highlighted: var(--color);
      --background-color-highlighted: light-dark(#e8f0fe, #1c3a6e);

      /* Selected */
      --color-selected: light-dark(#1a73e8, #7baaf7);
      --background-color-selected: light-dark(#e8f0fe, #1c3a6e);
      --font-weight-selected: 500;

      /* Highlighted + selected */
      --color-highlighted-selected: var(--color-selected);
      --background-color-highlighted-selected: light-dark(#d2e3fc, #174ea6);
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
      inset: unset;
      margin: 0;
      padding: 0;
      border: none;
      overflow: visible;
    }
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

    &[data-highlighted] {
      --x-color: var(--color-highlighted);
      --x-background-color: var(--background-color-highlighted);
    }

    &[data-selected] {
      --x-color: var(--color-selected);
      --x-background-color: var(--background-color-selected);
      --x-font-weight: var(--font-weight-selected);
    }

    &[data-highlighted][data-selected] {
      --x-color: var(--color-highlighted-selected);
      --x-background-color: var(--background-color-highlighted-selected);
    }
  }
`;

/**
 * Context OptionList provides downward to its Option children.
 */
export const OptionListContext = createContext(null);

export const OptionList = ({
  popover,
  onChange: onChangeProp,
  children,
  ...rest
}) => {
  import.meta.css = css;

  const ItemTrackerProvider = useOptionItemTrackerProvider();
  const [highlightedValue, setHighlightedValue] = useState(null);
  const highlightedValueRef = useRef(null);
  highlightedValueRef.current = highlightedValue;

  const ownId = useId();
  const id = rest.id ?? ownId;

  const listRef = useRef(null);
  const effectiveOnChange = popover
    ? (value) => {
        onChangeProp?.(value);
        listRef.current?.dispatchEvent(
          new CustomEvent("combobox-selected", {
            detail: { value },
            bubbles: true,
          }),
        );
      }
    : onChangeProp;
  const onChangeRef = useRef(effectiveOnChange);
  onChangeRef.current = effectiveOnChange;

  const navigate = (direction) => {
    const values = ItemTrackerProvider.items.map((item) => item.value);
    if (values.length === 0) {
      return false;
    }
    const current = highlightedValueRef.current;
    if (direction === "down") {
      const idx = current === null ? -1 : values.indexOf(current);
      setHighlightedValue(values[idx < values.length - 1 ? idx + 1 : idx]);
    } else if (direction === "up") {
      const idx = current === null ? -1 : values.indexOf(current);
      setHighlightedValue(values[idx > 0 ? idx - 1 : 0]);
    } else if (direction === "first") {
      setHighlightedValue(values[0]);
    } else if (direction === "last") {
      setHighlightedValue(values[values.length - 1]);
    }
    return true;
  };

  // Listen for commands dispatched by a linked Input (combobox mode)
  const noopRef = useRef(null);
  useEffect(() => {
    if (!popover || !listRef.current) {
      return undefined;
    }
    const el = listRef.current;
    const onNavigate = (e) => {
      navigate(e.detail.direction);
    };
    const onConfirm = (e) => {
      const current = highlightedValueRef.current;
      if (current !== null) {
        onChangeRef.current?.(current);
        e.preventDefault();
      }
    };
    const onClear = () => {
      setHighlightedValue(null);
    };
    el.addEventListener("combobox-navigate", onNavigate);
    el.addEventListener("combobox-confirm", onConfirm);
    el.addEventListener("combobox-clear", onClear);
    return () => {
      el.removeEventListener("combobox-navigate", onNavigate);
      el.removeEventListener("combobox-confirm", onConfirm);
      el.removeEventListener("combobox-clear", onClear);
    };
  }, [popover]);

  useKeyboardShortcuts(popover ? noopRef : listRef, [
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
      description: "Select highlighted option",
      handler: () => {
        const current = highlightedValueRef.current;
        if (current === null) {
          return false;
        }
        onChangeRef.current?.(current);
        return true;
      },
    },
    {
      key: "escape",
      description: "Clear highlighted option",
      handler: () => {
        setHighlightedValue(null);
        return true;
      },
    },
  ]);

  const optionListContext = {
    highlightedValue,
    setHighlightedValue,
    onSelect: effectiveOnChange,
  };

  return (
    <Box
      as="ul"
      ref={listRef}
      id={id}
      role="listbox"
      tabIndex={popover ? -1 : 0}
      popover={popover ? "manual" : undefined}
      {...rest}
      baseClassName="navi_option_list"
    >
      <OptionListContext.Provider value={optionListContext}>
        <ItemTrackerProvider>{children}</ItemTrackerProvider>
      </OptionListContext.Provider>
    </Box>
  );
};

const OPTION_PSEUDO_CLASSES = [":-navi-highlighted", ":-navi-selected"];
export const Option = ({ value, selected, children, ...rest }) => {
  import.meta.css = css;

  const optionId = useId();
  const id = rest.id || optionId;
  useTrackOption({ value, optionId: id });
  const { highlightedValue, setHighlightedValue, onSelect } =
    useContext(OptionListContext);

  const isHighlighted = highlightedValue === value;
  const optionRef = useRef(null);

  useEffect(() => {
    const optionEl = optionRef.current;
    if (isHighlighted && optionEl) {
      optionEl.scrollIntoView({ block: "nearest" });
    }
  }, [isHighlighted]);

  return (
    <Box
      as="li"
      ref={optionRef}
      baseClassName="navi_option"
      id={optionId}
      role="option"
      aria-selected={selected}
      basePseudoState={{
        ":-navi-highlighted": isHighlighted,
        ":-navi-selected": selected,
      }}
      pseudoClasses={OPTION_PSEUDO_CLASSES}
      onMouseEnter={() => setHighlightedValue(value)}
      onMouseLeave={() => setHighlightedValue(null)}
      onMouseDown={() => {
        onSelect?.(value);
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};
