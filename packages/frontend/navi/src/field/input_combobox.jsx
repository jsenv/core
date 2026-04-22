import { useEffect, useId, useRef, useState } from "preact/hooks";

/**
 * Generic accessible combobox (role="combobox" + role="listbox") component.
 *
 * Props:
 * - options: Array of option objects (or strings)
 * - value: currently selected option (or null)
 * - onChange(option): called when selection changes (null when cleared)
 * - getOptionKey(option): returns a unique key per option (default: index)
 * - getOptionLabel(option): returns the display string for an option (default: String(option))
 * - filterOptions(options, query): returns filtered array (default: label includes query)
 * - renderOption(option, { isActive }): renders option content (default: label string)
 * - placeholder: input placeholder text
 * - loading: when true, renders a disabled input
 * - loadingPlaceholder: placeholder shown while loading
 */
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
