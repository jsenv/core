import { createContext } from "preact";
import { useContext, useEffect, useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { useKeyboardShortcuts } from "../keyboard/keyboard_shortcuts.js";

/**
 * OptionList + Option: a composable accessible listbox.
 *
 * Usage:
 *   <OptionList id="my-list" value={selected} onChange={setSelected}>
 *     <Option value="a">Option A</Option>
 *     <Option value="b">Option B</Option>
 *   </OptionList>
 *
 * The list handles keyboard navigation (ArrowUp/Down, Home, End, Enter, Escape)
 * and exposes highlighted/selected state to each Option via context.
 *
 * CSS vars on .navi_option_list:
 *   --border-radius
 *   --border-width
 *   --border-color
 *   --background-color
 *   --max-height
 *
 * CSS vars on .navi_option:
 *   --padding
 *   --color
 *   --background-color
 *   --font-weight
 *   --color-hover                       mouse hover
 *   --background-color-hover
 *   --color-highlighted                 keyboard navigation cursor
 *   --background-color-highlighted
 *   --color-selected                    selected value
 *   --background-color-selected
 *   --font-weight-selected
 *   --color-highlighted-selected        highlighted AND selected
 *   --background-color-highlighted-selected
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

export const OptionListContext = createContext(null);

export const OptionList = ({
  id,
  value: selectedValue,
  onChange,
  hidden,
  children,
  ...rest
}) => {
  import.meta.css = css;

  // "highlighted" = the option the keyboard cursor is on (not the mouse hover)
  const [highlightedValue, setHighlightedValue] = useState(null);
  // Ordered registry of option values — filled in by Option on mount
  const registeredValuesRef = useRef([]);
  const listRef = useRef(null);
  // Refs for stable shortcut handler closures
  const highlightedValueRef = useRef(null);
  highlightedValueRef.current = highlightedValue;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const register = (optionValue) => {
    registeredValuesRef.current = [...registeredValuesRef.current, optionValue];
    return () => {
      registeredValuesRef.current = registeredValuesRef.current.filter(
        (v) => v !== optionValue,
      );
    };
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedValue === null || !listRef.current) {
      return;
    }
    const el = listRef.current.querySelector("[data-highlighted]");
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedValue]);

  useKeyboardShortcuts(listRef, [
    {
      key: "arrowdown",
      description: "Highlight next option",
      handler: () => {
        const values = registeredValuesRef.current;
        if (values.length === 0) {
          return false;
        }
        const current = highlightedValueRef.current;
        const currentIndex = current === null ? -1 : values.indexOf(current);
        const nextIndex =
          currentIndex < values.length - 1 ? currentIndex + 1 : currentIndex;
        setHighlightedValue(values[nextIndex]);
        return true;
      },
    },
    {
      key: "arrowup",
      description: "Highlight previous option",
      handler: () => {
        const values = registeredValuesRef.current;
        if (values.length === 0) {
          return false;
        }
        const current = highlightedValueRef.current;
        const currentIndex = current === null ? -1 : values.indexOf(current);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        setHighlightedValue(values[prevIndex]);
        return true;
      },
    },
    {
      key: "home",
      description: "Highlight first option",
      handler: () => {
        const values = registeredValuesRef.current;
        if (values.length === 0) {
          return false;
        }
        setHighlightedValue(values[0]);
        return true;
      },
    },
    {
      key: "end",
      description: "Highlight last option",
      handler: () => {
        const values = registeredValuesRef.current;
        if (values.length === 0) {
          return false;
        }
        setHighlightedValue(values[values.length - 1]);
        return true;
      },
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

  const contextValue = {
    selectedValue,
    highlightedValue,
    setHighlightedValue,
    onSelect: onChange,
    register,
  };

  return (
    <Box
      as="ul"
      ref={listRef}
      id={id}
      role="listbox"
      tabIndex={0}
      hidden={hidden}
      {...rest}
      baseClassName="navi_option_list"
    >
      <OptionListContext.Provider value={contextValue}>
        {children}
      </OptionListContext.Provider>
    </Box>
  );
};

const OPTION_PSEUDO_CLASSES = [":-navi-highlighted", ":-navi-selected"];
export const Option = ({ value, children, ...rest }) => {
  import.meta.css = css;

  const {
    selectedValue,
    highlightedValue,
    setHighlightedValue,
    onSelect,
    register,
  } = useContext(OptionListContext);
  const optionId = useId();

  useEffect(() => {
    return register(value);
  }, [value]);

  const isSelected = selectedValue === value;
  const isHighlighted = highlightedValue === value;

  return (
    <Box
      as="li"
      baseClassName="navi_option"
      id={optionId}
      role="option"
      aria-selected={isSelected}
      basePseudoState={{
        ":-navi-highlighted": isHighlighted,
        ":-navi-selected": isSelected,
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
