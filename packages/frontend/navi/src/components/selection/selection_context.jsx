import { canInterceptKeys } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

const SelectionContext = createContext(null);

export const SelectionProvider = ({ value = [], onChange, children }) => {
  const selection = value || [];
  const registryRef = useRef(new Map()); // Map<value, {x, y, element}>
  const anchorRef = useRef(null);

  const contextValue = {
    selection,

    register: (value, coordinates = null, element = null) => {
      const registry = registryRef.current;
      if (registry.has(value)) {
        // Update existing entry with new coordinates/element
        const existing = registry.get(value);
        registry.set(value, {
          x: coordinates?.x ?? existing.x,
          y: coordinates?.y ?? existing.y,
          element: element ?? existing.element,
        });
        return;
      }
      registry.set(value, {
        x: coordinates?.x ?? 0,
        y: coordinates?.y ?? 0,
        element,
      });
    },
    unregister: (value) => {
      const registry = registryRef.current;
      registry.delete(value);
    },
    updateCoordinates: (value, coordinates) => {
      const registry = registryRef.current;
      const existing = registry.get(value);
      if (existing) {
        registry.set(value, { ...existing, ...coordinates });
      }
    },
    setAnchor: (value) => {
      anchorRef.current = value;
    },
    isSelected: (itemValue) => {
      return selection.includes(itemValue);
    },
    getAllItems: () => {
      return Array.from(registryRef.current.keys());
    },
    getItemCoordinates: (value) => {
      const item = registryRef.current.get(value);
      return item ? { x: item.x, y: item.y } : null;
    },
    getRange: (fromValue, toValue) => {
      const registry = registryRef.current;
      const fromItem = registry.get(fromValue);
      const toItem = registry.get(toValue);

      if (!fromItem || !toItem) {
        return [];
      }

      // Calculate rectangular selection area
      const minX = Math.min(fromItem.x, toItem.x);
      const maxX = Math.max(fromItem.x, toItem.x);
      const minY = Math.min(fromItem.y, toItem.y);
      const maxY = Math.max(fromItem.y, toItem.y);

      // Find all items within the rectangular area
      const itemsInRange = [];
      for (const [value, item] of registry) {
        if (
          item.x >= minX &&
          item.x <= maxX &&
          item.y >= minY &&
          item.y <= maxY
        ) {
          itemsInRange.push(value);
        }
      }

      return itemsInRange;
    },

    // basic methods to manipulate selection
    set: (newSelection, event = null) => {
      if (
        newSelection.length === selection.length &&
        newSelection.every((value, index) => value === selection[index])
      ) {
        return;
      }
      // Set anchor to the last item in the new selection
      if (newSelection.length > 0) {
        anchorRef.current = newSelection[newSelection.length - 1];
      }
      onChange?.(newSelection, event);
    },
    add: (arrayOfValueToAddToSelection, event = null) => {
      const selectionWithValues = [];
      for (const value of selection) {
        selectionWithValues.push(value);
      }
      let modified = false;
      let lastAdded = null;
      for (const valueToAdd of arrayOfValueToAddToSelection) {
        if (selectionWithValues.includes(valueToAdd)) {
          continue;
        }
        modified = true;
        selectionWithValues.push(valueToAdd);
        lastAdded = valueToAdd;
      }
      if (modified) {
        // Set anchor to the last added item
        if (lastAdded) {
          anchorRef.current = lastAdded;
        }
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
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      // Find the next item in the same row (x + 1)
      const nextX = currentItem.x + 1;
      for (const [candidateValue, item] of registry) {
        if (item.x === nextX && item.y === currentItem.y) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueBefore: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      // Find the previous item in the same row (x - 1)
      const prevX = currentItem.x - 1;
      for (const [candidateValue, item] of registry) {
        if (item.x === prevX && item.y === currentItem.y) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueBelow: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      // Find the item below in the same column (y + 1)
      const nextY = currentItem.y + 1;
      for (const [candidateValue, item] of registry) {
        if (item.x === currentItem.x && item.y === nextY) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueAbove: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      // Find the item above in the same column (y - 1)
      const prevY = currentItem.y - 1;
      for (const [candidateValue, item] of registry) {
        if (item.x === currentItem.x && item.y === prevY) {
          return candidateValue;
        }
      }
      return null;
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

export const useRegisterSelectionValue = (value, coordinates = null) => {
  const selectionContext = useSelectionContext();
  const elementRef = useRef(null);

  useLayoutEffect(() => {
    if (selectionContext) {
      selectionContext.register(value, coordinates, elementRef.current);
      return () => selectionContext.unregister(value);
    }
    return undefined;
  }, [selectionContext, value, coordinates?.x, coordinates?.y]);

  // Update coordinates if they change
  useLayoutEffect(() => {
    if (selectionContext && coordinates) {
      selectionContext.updateCoordinates(value, coordinates);
    }
  }, [selectionContext, value, coordinates?.x, coordinates?.y]);

  return elementRef;
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
    // here no need to prevent nav on <a> but it means cmd + click will both multi select
    // and open in a new tab
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
  if (!canInterceptKeys(keydownEvent)) {
    return;
  }

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
    const nextValue = selectionContext.getValueBelow(value);
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
    const previousValue = selectionContext.getValueAbove(value);
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
  if (key === "ArrowLeft") {
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
  if (key === "ArrowRight") {
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
};
