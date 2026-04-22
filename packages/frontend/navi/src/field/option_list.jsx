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
 * A parent component can control OptionList by providing OptionListControllerContext.
 * The controller can override: value, onChange, hidden, highlightedValue,
 * setHighlightedValue, highlightedValueRef, registeredValuesRef, registeredIdsRef.
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

  /* Popover reset — browser adds border, background, padding, margin by default */
  .navi_option_list[popover] {
    position: fixed;
    inset: unset;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    overflow: visible;
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

/**
 * Context a parent component (e.g. ComboBox) can provide to control OptionList.
 * Any key provided overrides OptionList's own local state/props.
 *
 * Shape:
 *   {
 *     value,               // controlled selected value
 *     onChange,            // selection handler
 *     hidden,              // visibility override
 *     highlightedValue,    // keyboard cursor value
 *     setHighlightedValue,
 *     highlightedValueRef, // ref holding current highlightedValue for stable closures
 *     registeredValuesRef, // shared ordered array of registered option values
 *     registeredIdsRef,    // shared Map<value, domId> for aria-activedescendant
 *     keyboardTargetRef,   // when provided, keyboard shortcuts are installed here instead of <ul>
 *   }
 */
export const OptionListControllerContext = createContext(null);

/**
 * Context OptionList provides downward to its Option children.
 */
export const OptionListContext = createContext(null);

export const OptionList = ({
  id,
  popover,
  value: valueProp,
  onChange: onChangeProp,
  hidden: hiddenProp,
  children,
  ...rest
}) => {
  import.meta.css = css;

  const controller = useContext(OptionListControllerContext);

  // Own state — used when no controller overrides them
  const [ownHighlightedValue, setOwnHighlightedValue] = useState(null);
  const ownRegisteredValuesRef = useRef([]);
  const ownRegisteredIdsRef = useRef(new Map());
  const ownHighlightedValueRef = useRef(null);
  ownHighlightedValueRef.current = ownHighlightedValue;

  // Resolve effective values: controller wins over own props/state
  const value = controller ? controller.value : valueProp;
  const onChange = controller ? controller.onChange : onChangeProp;
  const hidden = controller ? controller.hidden : hiddenProp;
  const highlightedValue = controller
    ? controller.highlightedValue
    : ownHighlightedValue;
  const setHighlightedValue = controller
    ? controller.setHighlightedValue
    : setOwnHighlightedValue;
  const highlightedValueRef = controller
    ? controller.highlightedValueRef
    : ownHighlightedValueRef;
  const registeredValuesRef = controller
    ? controller.registeredValuesRef
    : ownRegisteredValuesRef;
  const registeredIdsRef = controller
    ? controller.registeredIdsRef
    : ownRegisteredIdsRef;
  const keyboardTargetRef = controller ? controller.keyboardTargetRef : null;

  const ownId = useId();
  const listboxId = id ?? ownId;

  const listRef = useRef(null);
  // When popover mode, dispatch a DOM event so the linked Input is notified
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
    : onChange;
  const onChangeRef = useRef(effectiveOnChange);
  onChangeRef.current = effectiveOnChange;

  const register = (optionValue, optionId) => {
    registeredValuesRef.current = [...registeredValuesRef.current, optionValue];
    registeredIdsRef.current.set(optionValue, optionId);
    return () => {
      registeredValuesRef.current = registeredValuesRef.current.filter(
        (v) => v !== optionValue,
      );
      registeredIdsRef.current.delete(optionValue);
    };
  };

  // Listen for commands dispatched by a linked Input (combobox mode)
  const noopRef = useRef(null);
  useEffect(() => {
    if (!popover || !listRef.current) {
      return undefined;
    }
    const el = listRef.current;
    const onNavigate = (e) => {
      const { direction } = e.detail;
      const values = registeredValuesRef.current;
      if (values.length === 0) {
        return;
      }
      const current = highlightedValueRef.current;
      if (direction === "down") {
        const idx = current === null ? -1 : values.indexOf(current);
        const next = idx < values.length - 1 ? idx + 1 : idx;
        setHighlightedValue(values[next]);
      } else if (direction === "up") {
        const idx = current === null ? -1 : values.indexOf(current);
        const prev = idx > 0 ? idx - 1 : 0;
        setHighlightedValue(values[prev]);
      } else if (direction === "first") {
        setHighlightedValue(values[0]);
      } else if (direction === "last") {
        setHighlightedValue(values[values.length - 1]);
      }
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

  useKeyboardShortcuts(popover ? noopRef : (keyboardTargetRef ?? listRef), [
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

  const optionListContext = {
    value,
    highlightedValue,
    setHighlightedValue,
    onSelect: effectiveOnChange,
    register,
  };

  return (
    <OptionListContext.Provider value={optionListContext}>
      <Box
        as="ul"
        ref={listRef}
        id={listboxId}
        role="listbox"
        tabIndex={keyboardTargetRef || popover ? -1 : 0}
        popover={popover ? "manual" : undefined}
        hidden={popover ? undefined : hidden}
        {...rest}
        baseClassName="navi_option_list"
      >
        {children}
      </Box>
    </OptionListContext.Provider>
  );
};

const OPTION_PSEUDO_CLASSES = [":-navi-highlighted", ":-navi-selected"];

export const Option = ({ value, children, ...rest }) => {
  import.meta.css = css;

  const {
    value: selectedValue,
    highlightedValue,
    setHighlightedValue,
    onSelect,
    register,
  } = useContext(OptionListContext);
  const optionId = useId();

  useEffect(() => {
    return register(value, optionId);
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
