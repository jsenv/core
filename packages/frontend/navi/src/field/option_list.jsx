import { createContext } from "preact";
import { useContext, useEffect, useId, useRef, useState } from "preact/hooks";
import { Box } from "../box/box.jsx";

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

    &[aria-selected="true"] {
      --x-color: var(--color-selected);
      --x-background-color: var(--background-color-selected);
      --x-font-weight: var(--font-weight-selected);
    }

    &[data-highlighted][aria-selected="true"] {
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

  const handleKeyDown = (e) => {
    const values = registeredValuesRef.current;
    if (values.length === 0) {
      return;
    }
    const currentIndex =
      highlightedValue === null ? -1 : values.indexOf(highlightedValue);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex =
        currentIndex < values.length - 1 ? currentIndex + 1 : currentIndex;
      setHighlightedValue(values[nextIndex]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      setHighlightedValue(values[prevIndex]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlightedValue(values[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlightedValue(values[values.length - 1]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedValue !== null && onChange) {
        onChange(highlightedValue);
      }
    } else if (e.key === "Escape") {
      setHighlightedValue(null);
    }
  };

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
      onKeyDown={handleKeyDown}
      {...rest}
      baseClassName="navi_option_list"
    >
      <OptionListContext.Provider value={contextValue}>
        {" "}
        {children}
      </OptionListContext.Provider>
    </Box>
  );
};

export const Option = ({ value, children, ...rest }) => {
  import.meta.css = css;

  const optionId = useId();
  const {
    selectedValue,
    highlightedValue,
    setHighlightedValue,
    onSelect,
    register,
  } = useContext(OptionListContext);

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
      data-highlighted={isHighlighted || undefined}
      onMouseEnter={() => setHighlightedValue(value)}
      onMouseLeave={() => setHighlightedValue(null)}
      onMouseDown={(e) => {
        e.preventDefault();
        if (onSelect) {
          onSelect(value);
        }
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};
