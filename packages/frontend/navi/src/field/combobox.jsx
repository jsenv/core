import { createContext } from "preact";
import { useContext, useEffect, useId, useRef, useState } from "preact/hooks";

import { Input } from "./input.jsx";
import { OptionListControllerContext } from "./option_list.jsx";

/**
 * ComboBox: wraps a ComboBoxInput + OptionList to create an accessible combobox widget.
 *
 * Usage:
 *   <ComboBox value={selected} onChange={setSelected}>
 *     <ComboBoxInput placeholder="Search…" />
 *     <OptionList>
 *       <Option value="a">Option A</Option>
 *       <Option value="b">Option B</Option>
 *     </OptionList>
 *   </ComboBox>
 *
 * The OptionList renders as an absolute-positioned dropdown when inside a ComboBox.
 * Keyboard navigation (ArrowDown/Up, Home, End, Enter, Escape) works from the input.
 *
 * ComboBox owns the open state and the shared highlighted value so that
 * the input and the dropdown stay in sync.
 */

export const ComboBoxContext = createContext(null);

const comboBoxCss = /* css */ `
  @layer navi {
    .navi_combobox {
      --dropdown-margin-top: 2px;
      --dropdown-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }

  .navi_combobox {
    display: inline-block;
    width: 100%;
  }

  /* Popover reset — browser adds border, background, padding by default */
  .navi_combobox_dropdown[popover] {
    position: fixed;
    inset: unset;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: var(--dropdown-shadow, 0 4px 12px rgba(0, 0, 0, 0.1));
    overflow: visible;
  }
`;

export const ComboBox = ({ value, onChange, children, ...rest }) => {
  import.meta.css = comboBoxCss;

  const [open, setOpen] = useState(false);
  // Highlighted value is lifted here so the input's keyboard shortcuts can drive it
  const [highlightedValue, setHighlightedValue] = useState(null);
  const registeredValuesRef = useRef([]);
  const registeredIdsRef = useRef(new Map());
  const listboxId = useId();
  const containerRef = useRef(null);

  // Refs for stable keyboard handler closures
  const highlightedValueRef = useRef(null);
  highlightedValueRef.current = highlightedValue;
  const openRef = useRef(false);
  openRef.current = open;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setHighlightedValue(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  const select = (optionValue) => {
    onChangeRef.current?.(optionValue);
    setOpen(false);
    setHighlightedValue(null);
  };

  const context = {
    // open state
    open,
    setOpen,
    // shared keyboard navigation state
    highlightedValue,
    setHighlightedValue,
    highlightedValueRef,
    registeredValuesRef,
    registeredIdsRef,
    // selection
    selectedValue: value,
    onSelect: select,
    // aria wiring
    listboxId,
    // keyboard helpers used by ComboBoxInput
    openRef,
    // positioning anchor for ComboBoxDropdown
    containerRef,
  };

  const optionListController = {
    value,
    onChange: select,
    highlightedValue,
    setHighlightedValue,
    highlightedValueRef,
    registeredValuesRef,
    registeredIdsRef,
  };

  return (
    <ComboBoxContext.Provider value={context}>
      <OptionListControllerContext.Provider value={optionListController}>
        <div ref={containerRef} className="navi_combobox" {...rest}>
          {children}
        </div>
      </OptionListControllerContext.Provider>
    </ComboBoxContext.Provider>
  );
};

/**
 * ComboBoxInput — the text input for a ComboBox.
 * Renders a native <input> with role="combobox" and all ARIA wiring.
 * Arrow keys navigate the dropdown; Enter selects; Escape closes.
 *
 * Pass any native input props (placeholder, onInput, value, etc.).
 */
export const ComboBoxInput = ({
  onInput,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}) => {
  const {
    open,
    setOpen,
    openRef,
    highlightedValue,
    highlightedValueRef,
    registeredValuesRef,
    registeredIdsRef,
    setHighlightedValue,
    selectedValue: _selectedValue,
    onSelect,
    listboxId,
  } = useContext(ComboBoxContext);

  const handleKeyDown = (e) => {
    const values = registeredValuesRef.current;
    const current = highlightedValueRef.current;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!openRef.current) {
        setOpen(true);
      }
      if (values.length === 0) {
        return;
      }
      const currentIndex = current === null ? -1 : values.indexOf(current);
      const nextIndex =
        currentIndex < values.length - 1 ? currentIndex + 1 : currentIndex;
      setHighlightedValue(values[nextIndex]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (values.length === 0) {
        return;
      }
      const currentIndex = current === null ? -1 : values.indexOf(current);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      setHighlightedValue(values[prevIndex]);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (values.length > 0) {
        setHighlightedValue(values[0]);
      }
    } else if (e.key === "End") {
      e.preventDefault();
      if (values.length > 0) {
        setHighlightedValue(values[values.length - 1]);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (current !== null) {
        onSelect(current);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (openRef.current) {
        setOpen(false);
        setHighlightedValue(null);
      }
    }
    onKeyDown?.(e);
  };

  const handleInput = (e) => {
    setOpen(true);
    setHighlightedValue(null);
    onInput?.(e);
  };

  const handleFocus = (e) => {
    setOpen(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    onBlur?.(e);
  };

  const activeDescendant =
    open && highlightedValue !== null
      ? registeredIdsRef.current.get(highlightedValue)
      : undefined;

  return (
    <Input
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={activeDescendant}
      autoComplete="off"
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
};

/**
 * ComboBoxDropdown — renders children in a popover anchored below the ComboBox input.
 * Uses the Popover API (popover="manual") so the dropdown escapes overflow/z-index constraints.
 * Position is updated via JS whenever the popover opens or the window resizes.
 */
const ComboBoxDropdown = ({ children, ...rest }) => {
  const { open, containerRef } = useContext(ComboBoxContext);
  const popoverRef = useRef(null);

  useEffect(() => {
    const el = popoverRef.current;
    if (!el) {
      return;
    }
    if (open) {
      positionDropdown(el, containerRef.current);
      el.showPopover();
    } else {
      try {
        el.hidePopover();
      } catch {
        // already hidden — ignore
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onResize = () => {
      positionDropdown(popoverRef.current, containerRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div
      ref={popoverRef}
      popover="manual"
      className="navi_combobox_dropdown"
      {...rest}
    >
      {children}
    </div>
  );
};
const positionDropdown = (el, anchor) => {
  if (!el || !anchor) {
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const marginTop = parseFloat(
    getComputedStyle(el).getPropertyValue("--dropdown-margin-top") || "2",
  );
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + marginTop}px`;
  el.style.width = `${rect.width}px`;
};
