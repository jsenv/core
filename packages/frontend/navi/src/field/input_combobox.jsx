import { createContext } from "preact";
import { useContext, useEffect, useId, useRef, useState } from "preact/hooks";

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
      --dropdown-z-index: 100;
      --dropdown-margin-top: 2px;
      --dropdown-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }

  .navi_combobox {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .navi_combobox_dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    z-index: var(--dropdown-z-index, 100);
    margin-top: var(--dropdown-margin-top, 2px);
    box-shadow: var(--dropdown-shadow, 0 4px 12px rgba(0, 0, 0, 0.1));
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
  };

  const optionListController = {
    value,
    onChange: select,
    hidden: !open,
    highlightedValue,
    setHighlightedValue,
    highlightedValueRef,
    registeredValuesRef,
    registeredIdsRef,
  };

  return (
    <ComboBoxContext.Provider value={context}>
      <OptionListControllerContext.Provider value={optionListController}>
        <div ref={containerRef} class="navi_combobox" {...rest}>
          {children}
        </div>
      </OptionListControllerContext.Provider>
    </ComboBoxContext.Provider>
  );
};

const comboBoxInputCss = /* css */ `
  .navi_combobox_input {
    box-sizing: border-box;
    width: 100%;
  }
`;

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
  import.meta.css = comboBoxInputCss;

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
    <input
      class="navi_combobox_input"
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

export const InputCombobox = ({
  options = [],
  value = null,
  onChange,
  getOptionKey = defaultGetOptionKey,
  getOptionLabel = defaultGetOptionLabel,
  filterOptions = defaultFilterOptions,
  renderOption = defaultRenderOption,
  placeholder = "Search…",
  loading = false,
  loadingPlaceholder = "Loading…",
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = useId();
  const getOptionId = (i) => `${listboxId}-option-${i}`;

  // Keep input text in sync when value changes externally
  useEffect(() => {
    if (!loading) {
      setQuery(
        value !== null && value !== undefined ? getOptionLabel(value) : "",
      );
    }
  }, [value, loading]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll active option into view when navigating by keyboard
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) {
      return;
    }
    const option = listRef.current.querySelector(
      `[id="${getOptionId(activeIndex)}"]`,
    );
    if (option) {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (loading) {
    return <input disabled placeholder={loadingPlaceholder} />;
  }

  const filtered = filterOptions(options, query, getOptionLabel);

  const select = (option) => {
    onChange(option !== undefined ? option : null);
    setQuery(option !== undefined ? getOptionLabel(option) : "");
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < filtered.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex] !== undefined) {
        select(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const activeDescendant =
    open && activeIndex >= 0 ? getOptionId(activeIndex) : undefined;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setActiveIndex(-1);
        }}
        onInput={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (!e.target.value) {
            onChange(null);
          }
        }}
        onKeyDown={handleKeyDown}
      />
      <ul
        id={listboxId}
        ref={listRef}
        role="listbox"
        hidden={!open || filtered.length === 0}
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          margin: "2px 0 0",
          padding: 0,
          listStyle: "none",
          background: "var(--color-background, #fff)",
          border: "1px solid var(--color-border, #ccc)",
          borderRadius: "4px",
          boxShadow: "0 4px 12px rgba(0,0,0,.1)",
          maxHeight: "240px",
          overflowY: "auto",
          zIndex: 100,
        }}
      >
        {filtered.map((option, i) => (
          <li
            key={getOptionKey(option, i)}
            id={getOptionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              select(option);
            }}
            onMouseEnter={() => setActiveIndex(i)}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              background:
                i === activeIndex
                  ? "var(--color-primary-light, #f0f0f0)"
                  : "transparent",
            }}
          >
            {renderOption(option, { isActive: i === activeIndex })}
          </li>
        ))}
      </ul>
    </div>
  );
};

const defaultGetOptionKey = (option, index) => index;

const defaultGetOptionLabel = (option) => String(option);

const defaultFilterOptions = (options, query, getOptionLabel) => {
  const q = query.toLowerCase();
  if (!q) {
    return options;
  }
  return options.filter((option) =>
    getOptionLabel(option).toLowerCase().includes(q),
  );
};

const defaultRenderOption = (option, { isActive: _isActive }) => {
  return <span>{defaultGetOptionLabel(option)}</span>;
};
