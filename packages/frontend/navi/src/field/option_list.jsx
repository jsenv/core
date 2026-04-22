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
 * and exposes active/selected state to each Option via context.
 */

const optionListCss = /* css */ `
  .navi_option_list {
    margin: 0;
    padding: 0;
    list-style: none;
    outline: none;
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
  import.meta.css = optionListCss;

  const [activeValue, setActiveValue] = useState(null);
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

  // Scroll active option into view
  useEffect(() => {
    if (activeValue === null || !listRef.current) {
      return;
    }
    const el = listRef.current.querySelector("[data-active]");
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeValue]);

  const handleKeyDown = (e) => {
    const values = registeredValuesRef.current;
    if (values.length === 0) {
      return;
    }
    const currentIndex =
      activeValue === null ? -1 : values.indexOf(activeValue);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex =
        currentIndex < values.length - 1 ? currentIndex + 1 : currentIndex;
      setActiveValue(values[nextIndex]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      setActiveValue(values[prevIndex]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveValue(values[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveValue(values[values.length - 1]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeValue !== null && onChange) {
        onChange(activeValue);
      }
    } else if (e.key === "Escape") {
      setActiveValue(null);
    }
  };

  const contextValue = {
    selectedValue,
    activeValue,
    setActiveValue,
    onSelect: onChange,
    register,
  };

  return (
    <Box
      as="ul"
      baseClassName="navi_option_list"
      ref={listRef}
      id={id}
      tabIndex={0}
      hidden={hidden}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <OptionListContext.Provider value={contextValue}>
        {children}
      </OptionListContext.Provider>
    </Box>
  );
};

const optionCss = /* css */ `
  .navi_option {
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
  }
`;
export const Option = ({ value, children, style, ...rest }) => {
  import.meta.css = optionCss;

  const optionId = useId();
  const { selectedValue, activeValue, setActiveValue, onSelect, register } =
    useContext(OptionListContext);

  useEffect(() => {
    return register(value);
  }, [value]);

  const isSelected = selectedValue === value;
  const isActive = activeValue === value;

  return (
    <Box
      as="li"
      baseClassName="navi_option"
      id={optionId}
      role="option"
      aria-selected={isSelected}
      data-active={isActive || undefined}
      onMouseEnter={() => setActiveValue(value)}
      onMouseLeave={() => setActiveValue(null)}
      onMouseDown={(e) => {
        e.preventDefault();
        if (onSelect) {
          onSelect(value);
        }
      }}
      style={{
        background: isActive
          ? "var(--option-active-background, #f0f0f0)"
          : isSelected
            ? "var(--option-selected-background, #e8f0fe)"
            : "transparent",
        color: isSelected ? "var(--option-selected-color, #1a73e8)" : "inherit",
        fontWeight: isSelected ? 500 : "inherit",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};
