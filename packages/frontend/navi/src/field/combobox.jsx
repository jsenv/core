import { createContext, toChildArray } from "preact";
import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Input } from "./input.jsx";
import { OptionListControllerContext } from "./option_list.jsx";

/**
 * ComboBox: wraps a ComboBoxInput + OptionList to create an accessible combobox widget.
 *
 * Usage:
 *   <ComboBox>
 *     <ComboBoxInput value={selected} action={setSelected} placeholder="Search…" />
 *     <OptionList>
 *       <Option value="a">Option A</Option>
 *       <Option value="b">Option B</Option>
 *     </OptionList>
 *   </ComboBox>
 *
 * ComboBoxInput carries the selected value and action.
 * The OptionList renders inside an auto-managed popover dropdown.
 * Keyboard navigation (ArrowDown/Up, Home, End, Enter, Escape) works from the input.
 */

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

const ComboBoxContext = createContext(null);
export const ComboBox = ({ children, ...rest }) => {
  import.meta.css = comboBoxCss;

  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(null);
  const [highlightedValue, setHighlightedValue] = useState(null);
  const registeredValuesRef = useRef([]);
  const registeredIdsRef = useRef(new Map());
  const listboxId = useId();
  const containerRef = useRef(null);

  const highlightedValueRef = useRef(null);
  highlightedValueRef.current = highlightedValue;
  const openRef = useRef(false);
  openRef.current = open;
  const actionRef = useRef(null);
  const keyboardTargetRef = useRef(null);

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
    actionRef.current?.(optionValue);
    setSelectedValue(optionValue);
    setOpen(false);
    setHighlightedValue(null);
  };

  const context = {
    open,
    setOpen,
    highlightedValue,
    setHighlightedValue,
    highlightedValueRef,
    registeredValuesRef,
    registeredIdsRef,
    selectedValue,
    setSelectedValue,
    actionRef,
    onSelect: select,
    listboxId,
    openRef,
    containerRef,
    keyboardTargetRef,
  };

  const optionListController = {
    value: selectedValue,
    onChange: select,
    highlightedValue,
    setHighlightedValue,
    highlightedValueRef,
    registeredValuesRef,
    registeredIdsRef,
    keyboardTargetRef,
  };

  const childArray = toChildArray(children);
  const [inputChild, ...dropdownChildren] = childArray;

  return (
    <Box ref={containerRef} baseClassName="navi_combobox" {...rest}>
      <ComboBoxContext.Provider value={context}>
        {inputChild}
        <ComboBoxDropdown>
          <OptionListControllerContext.Provider value={optionListController}>
            {dropdownChildren}
          </OptionListControllerContext.Provider>
        </ComboBoxDropdown>
      </ComboBoxContext.Provider>
    </Box>
  );
};

/**
 * ComboBoxInput — the text input for a ComboBox.
 * Carries the selected value and action (onChange) for the combobox.
 * Renders an <Input> with role="combobox" and all ARIA wiring.
 * Arrow keys navigate the dropdown; Enter selects; Escape closes.
 */
export const ComboBoxInput = ({
  value,
  action,
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
    registeredIdsRef,
    setHighlightedValue,
    setSelectedValue,
    actionRef,
    listboxId,
    keyboardTargetRef,
  } = useContext(ComboBoxContext);

  const inputRef = useRef(null);

  // Point keyboardTargetRef to the native <input> so OptionList installs shortcuts there
  useLayoutEffect(() => {
    keyboardTargetRef.current = inputRef.current;
    return () => {
      keyboardTargetRef.current = null;
    };
  }, []);

  // Sync value and action from props into ComboBox state/refs
  useLayoutEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);

  useLayoutEffect(() => {
    actionRef.current = action ?? null;
  }, [action]);

  // Open dropdown on ArrowDown when closed — navigation itself is handled by OptionList shortcuts
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown" && !openRef.current) {
      e.preventDefault();
      setOpen(true);
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
      ref={inputRef}
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
