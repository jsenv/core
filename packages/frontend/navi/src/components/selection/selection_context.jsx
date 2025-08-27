import { canInterceptKeys } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

const SelectionContext = createContext(null);

export const SelectionProvider = ({
  value = [],
  onChange,
  layout = "vertical",
  children,
}) => {
  if (layout === "grid") {
    return (
      <GridSelectionProvider value={value} onChange={onChange}>
        {children}
      </GridSelectionProvider>
    );
  }

  return (
    <LinearSelectionProvider value={value} onChange={onChange} axis={layout}>
      {children}
    </LinearSelectionProvider>
  );
};

// Grid Selection Provider - for 2D layouts like tables
const GridSelectionProvider = ({ value = [], onChange, children }) => {
  const selection = value || [];
  const registryRef = useRef(new Map()); // Map<value, {x, y, element}>
  const anchorRef = useRef(null);

  const contextValue = {
    selection,
    layout: "grid",

    register: (value, { x, y }, element = null) => {
      if (typeof x !== "number" || typeof y !== "number") {
        throw new Error(
          `GridSelectionProvider: Both x and y coordinates are required for value "${value}".`,
        );
      }

      const registry = registryRef.current;
      registry.set(value, { x, y, element });
    },
    unregister: (value) => {
      const registry = registryRef.current;
      registry.delete(value);
    },
    updatePosition: (value, { x, y }) => {
      const registry = registryRef.current;
      const existing = registry.get(value);
      if (!existing) return;

      if (x !== undefined && typeof x !== "number") {
        throw new Error(
          `GridSelectionProvider: x coordinate must be a number for value "${value}".`,
        );
      }
      if (y !== undefined && typeof y !== "number") {
        throw new Error(
          `GridSelectionProvider: y coordinate must be a number for value "${value}".`,
        );
      }

      registry.set(value, { ...existing, x, y });
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
      const { x: fromX, y: fromY } = fromItem;
      const { x: toX, y: toY } = toItem;
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);

      // Find all items within the rectangular area
      const itemsInRange = [];
      for (const [value, { x, y }] of registry) {
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          itemsInRange.push(value);
        }
      }

      return itemsInRange;
    },

    // Navigation methods for grid
    getValueAfter: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      const { x, y } = currentItem;
      const nextX = x + 1;

      for (const [candidateValue, item] of registry) {
        if (item.x === nextX && item.y === y) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueBefore: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      const { x, y } = currentItem;
      const prevX = x - 1;

      for (const [candidateValue, item] of registry) {
        if (item.x === prevX && item.y === y) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueBelow: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      const { x, y } = currentItem;
      const nextY = y + 1;

      for (const [candidateValue, item] of registry) {
        if (item.x === x && item.y === nextY) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueAbove: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      const { x, y } = currentItem;
      const prevY = y - 1;

      for (const [candidateValue, item] of registry) {
        if (item.x === x && item.y === prevY) {
          return candidateValue;
        }
      }
      return null;
    },

    // Selection manipulation methods
    set: (newSelection, event = null) => {
      if (
        newSelection.length === selection.length &&
        newSelection.every((value, index) => value === selection[index])
      ) {
        return;
      }
      if (newSelection.length > 0) {
        anchorRef.current = newSelection[newSelection.length - 1];
      }
      onChange?.(newSelection, event);
    },
    add: (arrayOfValueToAddToSelection, event = null) => {
      const selectionWithValues = [...selection];
      let modified = false;
      let lastAdded = null;

      for (const valueToAdd of arrayOfValueToAddToSelection) {
        if (!selectionWithValues.includes(valueToAdd)) {
          modified = true;
          selectionWithValues.push(valueToAdd);
          lastAdded = valueToAdd;
        }
      }

      if (modified) {
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
    toggle: (value, event = null) => {
      if (selection.includes(value)) {
        contextValue.remove([value], event);
      } else {
        contextValue.add([value], event);
      }
    },
    setFromAnchorTo: (value, event = null) => {
      const anchorValue = anchorRef.current;

      if (anchorValue && selection.includes(anchorValue)) {
        const range = contextValue.getRange(anchorValue, value);
        contextValue.set(range, event);
      } else {
        contextValue.set([value], event);
      }
    },
  };

  return (
    <SelectionContext.Provider value={contextValue}>
      {children}
    </SelectionContext.Provider>
  );
};
// Linear Selection Provider - for 1D layouts like lists
const LinearSelectionProvider = ({
  value = [],
  onChange,
  axis = "vertical", // "horizontal" or "vertical"
  children,
}) => {
  const selection = value || [];
  const registryRef = useRef(new Map()); // Map<value, {index, element}>
  const anchorRef = useRef(null);

  if (!["horizontal", "vertical"].includes(axis)) {
    throw new Error(
      `LinearSelectionProvider: Invalid axis "${axis}". Must be "horizontal" or "vertical".`,
    );
  }

  const contextValue = {
    selection,
    layout: axis,

    register: (value, index, element = null) => {
      if (typeof index !== "number") {
        throw new Error(
          `LinearSelectionProvider: index must be a number for value "${value}".`,
        );
      }

      const registry = registryRef.current;
      registry.set(value, { index, element });
    },
    unregister: (value) => {
      const registry = registryRef.current;
      registry.delete(value);
    },
    updatePosition: (value, index) => {
      const registry = registryRef.current;
      const existing = registry.get(value);
      if (!existing) return;

      if (typeof index !== "number") {
        throw new Error(
          `LinearSelectionProvider: index must be a number for value "${value}".`,
        );
      }

      registry.set(value, { ...existing, index });
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
      return item ? { index: item.index } : null;
    },
    getRange: (fromValue, toValue) => {
      const registry = registryRef.current;
      const fromItem = registry.get(fromValue);
      const toItem = registry.get(toValue);

      if (!fromItem || !toItem) {
        return [];
      }

      const { index: fromPos } = fromItem;
      const { index: toPos } = toItem;
      const minPos = Math.min(fromPos, toPos);
      const maxPos = Math.max(fromPos, toPos);

      const itemsInRange = [];
      for (const [value, { index }] of registry) {
        if (index >= minPos && index <= maxPos) {
          itemsInRange.push(value);
        }
      }

      return itemsInRange;
    },

    // Navigation methods for linear layout
    getValueAfter: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      const { index } = currentItem;
      const nextPos = index + 1;

      for (const [candidateValue, item] of registry) {
        if (item.index === nextPos) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueBefore: (value) => {
      const registry = registryRef.current;
      const currentItem = registry.get(value);
      if (!currentItem) return null;

      const { index } = currentItem;
      const prevPos = index - 1;

      for (const [candidateValue, item] of registry) {
        if (item.index === prevPos) {
          return candidateValue;
        }
      }
      return null;
    },
    getValueBelow: (value) => {
      return axis === "vertical" ? contextValue.getValueAfter(value) : null;
    },
    getValueAbove: (value) => {
      return axis === "vertical" ? contextValue.getValueBefore(value) : null;
    },

    // Selection manipulation methods (same as grid)
    set: (newSelection, event = null) => {
      if (
        newSelection.length === selection.length &&
        newSelection.every((value, index) => value === selection[index])
      ) {
        return;
      }
      if (newSelection.length > 0) {
        anchorRef.current = newSelection[newSelection.length - 1];
      }
      onChange?.(newSelection, event);
    },
    add: (arrayOfValueToAddToSelection, event = null) => {
      const selectionWithValues = [...selection];
      let modified = false;
      let lastAdded = null;

      for (const valueToAdd of arrayOfValueToAddToSelection) {
        if (!selectionWithValues.includes(valueToAdd)) {
          modified = true;
          selectionWithValues.push(valueToAdd);
          lastAdded = valueToAdd;
        }
      }

      if (modified) {
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
    toggle: (value, event = null) => {
      if (selection.includes(value)) {
        contextValue.remove([value], event);
      } else {
        contextValue.add([value], event);
      }
    },
    setFromAnchorTo: (value, event = null) => {
      const anchorValue = anchorRef.current;

      if (anchorValue && selection.includes(anchorValue)) {
        const range = contextValue.getRange(anchorValue, value);
        contextValue.set(range, event);
      } else {
        contextValue.set([value], event);
      }
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

export const useRegisterSelectionValue = (value, position) => {
  const selectionContext = useSelectionContext();
  const elementRef = useRef(null);

  useLayoutEffect(() => {
    if (selectionContext) {
      selectionContext.register(value, position, elementRef.current);
      return () => selectionContext.unregister(value);
    }
    return undefined;
  }, [selectionContext, value, position]);

  // Update position if it changes
  useLayoutEffect(() => {
    if (selectionContext) {
      selectionContext.updatePosition(value, position);
    }
  }, [selectionContext, value, position]);

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
    if (selectionContext.layout === "horizontal") {
      return; // No down navigation in horizontal layout
    }
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
    if (selectionContext.layout === "horizontal") {
      return; // No up navigation in horizontal layout
    }
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
    if (selectionContext.layout === "vertical") {
      return; // No left navigation in vertical layout
    }
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
    if (selectionContext.layout === "vertical") {
      return; // No right navigation in vertical layout
    }
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
