import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

const SelectionContext = createContext(null);

export const SelectionProvider = ({ value = [], onChange, children }) => {
  const selection = value || [];
  const registryRef = useRef([]); // Array<value>
  const anchorRef = useRef(null);

  const contextValue = {
    selection,

    register: (value) => {
      const registry = registryRef.current;
      const existingIndex = registry.indexOf(value);
      if (existingIndex >= 0) {
        console.warn(
          `SelectionContext: Attempted to register an already registered value: ${value}. All values must be unique.`,
        );
        return;
      }
      registry.push(value);
    },
    unregister: (value) => {
      const registry = registryRef.current;
      const index = registry.indexOf(value);
      if (index >= 0) {
        registry.splice(index, 1);
      }
    },
    setAnchor: (value) => {
      anchorRef.current = value;
    },
    isSelected: (itemValue) => {
      return selection.includes(itemValue);
    },
    getAllItems: () => {
      return registryRef.current;
    },
    getRange: (fromValue, toValue) => {
      const registry = registryRef.current;

      // Find indices of fromValue and toValue
      let fromIndex = -1;
      let toIndex = -1;
      let index = 0;
      for (const valueCandidate of registry) {
        if (valueCandidate === fromValue) {
          fromIndex = index;
        }
        if (valueCandidate === toValue) {
          toIndex = index;
        }
        index++;
      }

      if (fromIndex >= 0 && toIndex >= 0) {
        // Select all items between fromIndex and toIndex (inclusive)
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        const valueInRangeArray = registry.slice(start, end + 1);
        return valueInRangeArray;
      }
      return [];
    },

    // basic methods to manipulate selection
    set: (newSelection, event = null) => {
      if (
        newSelection.length === selection.length &&
        newSelection.every((value, index) => value === selection[index])
      ) {
        return;
      }
      onChange?.(newSelection, event);
    },
    add: (arrayOfValueToAddToSelection, event = null) => {
      const selectionWithValues = [];
      for (const value of selection) {
        selectionWithValues.push(value);
      }
      let modified = false;
      for (const valueToAdd of arrayOfValueToAddToSelection) {
        if (selectionWithValues.includes(valueToAdd)) {
          continue;
        }
        modified = true;
        selectionWithValues.push(valueToAdd);
      }
      if (modified) {
        onChange?.(selectionWithValues, event);
      }
    },
    remove: (arrayOfValueToRemoveFromSelection, event = null) => {
      let modified = false;
      const selectionWithoutValues = [];
      for (const value of selection) {
        if (arrayOfValueToRemoveFromSelection.includes(value)) {
          modified = true;
          // If we're removing the last selected value, clear it
          if (value === anchorRef.current) {
            anchorRef.current = null;
          }
        } else {
          selectionWithoutValues.push(value);
        }
      }

      if (modified) {
        onChange?.(selectionWithoutValues, event);
      }
    },

    // Convenience method for multi-select: toggle, addFromLastSelectedTo
    toggle: (value, event = null) => {
      if (selection.includes(value)) {
        contextValue.remove([value], event);
      } else {
        contextValue.add([value], event);
      }
    },
    // Convenience method for shift-click: add range from last selected to target value
    setFromAnchorTo: (value, event = null) => {
      const anchorValue = anchorRef.current;

      // Make sure the last selected value is still in the current selection
      if (anchorValue && selection.includes(anchorValue)) {
        const range = contextValue.getRange(anchorValue, value);
        contextValue.set(range, event);
      } else {
        // No valid previous selection, just select this one
        contextValue.set([value], event);
      }
    },

    getValueAfter: (value) => {
      const registry = registryRef.current;
      const index = registry.indexOf(value);
      if (index < 0 || index >= registry.length - 1) {
        return null; // No next value
      }
      return registry[index + 1];
    },
    getValueBefore: (value) => {
      const registry = registryRef.current;
      const index = registry.indexOf(value);
      if (index <= 0) {
        return null; // No previous value
      }
      return registry[index - 1];
    },
  };

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
};

export const useSelectionContext = () => {
  return useContext(SelectionContext);
};

export const useRegisterSelectionValue = (value) => {
  const selectionContext = useSelectionContext();

  useLayoutEffect(() => {
    if (selectionContext) {
      selectionContext.register(value);
      return () => selectionContext.unregister(value);
    }
    return undefined;
  }, [selectionContext, value]);
};

export const clickToSelect = (clickEvent, { selectionContext, value }) => {
  if (clickEvent.defaultPrevented) {
    // If the click was prevented by another handler, do not interfere
    return;
  }

  const isMultiSelect = clickEvent.metaKey || clickEvent.ctrlKey;
  const isShiftSelect = clickEvent.shiftKey;
  const isSingleSelect = !isMultiSelect && !isShiftSelect;

  if (isSingleSelect) {
    // Single select - replace entire selection with just this item
    selectionContext.set([value], clickEvent);
    return;
  }
  if (isMultiSelect) {
    clickEvent.preventDefault(); // Prevent navigation
    selectionContext.toggle(value, clickEvent);
    return;
  }
  if (isShiftSelect) {
    clickEvent.preventDefault(); // Prevent navigation
    selectionContext.setFromAnchorTo(value, clickEvent);
    return;
  }
};

export const keydownToSelect = (keydownEvent, { selectionContext, value }) => {
  if (keydownEvent.key === "Shift") {
    selectionContext.setAnchor(value);
    return;
  }

  const isMultiSelect = keydownEvent.metaKey || keydownEvent.ctrlKey;
  const isShiftSelect = keydownEvent.shiftKey;
  const { key } = keydownEvent;
  if (key === "a") {
    if (!isMultiSelect) {
      return;
    }
    keydownEvent.preventDefault(); // prevent default select all text behavior
    selectionContext.set(selectionContext.getAllItems(), keydownEvent);
    return;
  }
  if (key === "ArrowDown") {
    const nextValue = selectionContext.getValueAfter(value);
    if (!nextValue) {
      return; // No next value to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selectionContext.setFromAnchorTo(nextValue, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selectionContext.add([nextValue], keydownEvent);
      return;
    }
    selectionContext.set([nextValue], keydownEvent);
    return;
  }
  if (key === "ArrowUp") {
    const previousValue = selectionContext.getValueBefore(value);
    if (!previousValue) {
      return; // No previous value to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selectionContext.setFromAnchorTo(previousValue, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selectionContext.add([previousValue], keydownEvent);
      return;
    }
    selectionContext.set([previousValue], keydownEvent);
    return;
  }
};
