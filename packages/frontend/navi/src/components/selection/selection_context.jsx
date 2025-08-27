import { canInterceptKeys } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

const SelectionContext = createContext(null);

export const SelectionProvider = ({
  selectedElements = [],
  onChange,
  layout = "vertical",
  children,
}) => {
  if (layout === "grid") {
    return (
      <GridSelectionProvider
        selectedElements={selectedElements}
        onChange={onChange}
      >
        {children}
      </GridSelectionProvider>
    );
  }

  return (
    <LinearSelectionProvider
      selectedElements={selectedElements}
      onChange={onChange}
      axis={layout}
    >
      {children}
    </LinearSelectionProvider>
  );
};

// Grid Selection Provider - for 2D layouts like tables
const GridSelectionProvider = ({
  selectedElements = [],
  onChange,
  children,
}) => {
  const selection = selectedElements || [];
  const registryRef = useRef(new Set()); // Set<element>
  const anchorRef = useRef(null);

  const contextValue = {
    selection,
    layout: "grid",

    registerElement: (element) => {
      const registry = registryRef.current;
      registry.add(element);
    },
    unregisterElement: (element) => {
      const registry = registryRef.current;
      registry.delete(element);
    },
    updateElementPosition: () => {
      // No-op for grid since position is determined by DOM structure
    },
    setAnchorElement: (element) => {
      anchorRef.current = element;
    },
    isElementSelected: (element) => {
      return selection.includes(element);
    },
    getAllElements: () => {
      return Array.from(registryRef.current);
    },
    getElementPosition: (element) => {
      // Get position by checking element's position in table structure
      const cell = element.closest("td, th");
      if (!cell) return null;

      const row = cell.closest("tr");
      if (!row) return null;

      const table = row.closest("table");
      if (!table) return null;

      const rows = Array.from(table.rows);
      const cells = Array.from(row.cells);

      return {
        x: cells.indexOf(cell),
        y: rows.indexOf(row),
      };
    },
    getElementRange: (fromElement, toElement) => {
      const fromPos = contextValue.getElementPosition(fromElement);
      const toPos = contextValue.getElementPosition(toElement);

      if (!fromPos || !toPos) {
        return [];
      }

      // Calculate rectangular selection area
      const { x: fromX, y: fromY } = fromPos;
      const { x: toX, y: toY } = toPos;
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);

      // Find all registered elements within the rectangular area
      const itemsInRange = [];
      for (const element of registryRef.current) {
        const pos = contextValue.getElementPosition(element);
        if (
          pos &&
          pos.x >= minX &&
          pos.x <= maxX &&
          pos.y >= minY &&
          pos.y <= maxY
        ) {
          itemsInRange.push(element);
        }
      }

      return itemsInRange;
    },

    // Navigation methods for grid
    getElementAfter: (element) => {
      const currentPos = contextValue.getElementPosition(element);
      if (!currentPos) return null;

      const { x, y } = currentPos;
      const nextX = x + 1;

      // Find element at next position in same row
      for (const candidateElement of registryRef.current) {
        const pos = contextValue.getElementPosition(candidateElement);
        if (pos && pos.x === nextX && pos.y === y) {
          return candidateElement;
        }
      }
      return null;
    },
    getElementBefore: (element) => {
      const currentPos = contextValue.getElementPosition(element);
      if (!currentPos) return null;

      const { x, y } = currentPos;
      const prevX = x - 1;

      // Find element at previous position in same row
      for (const candidateElement of registryRef.current) {
        const pos = contextValue.getElementPosition(candidateElement);
        if (pos && pos.x === prevX && pos.y === y) {
          return candidateElement;
        }
      }
      return null;
    },
    getElementBelow: (element) => {
      const currentPos = contextValue.getElementPosition(element);
      if (!currentPos) return null;

      const { x, y } = currentPos;
      const nextY = y + 1;

      // Find element at next position in same column
      for (const candidateElement of registryRef.current) {
        const pos = contextValue.getElementPosition(candidateElement);
        if (pos && pos.x === x && pos.y === nextY) {
          return candidateElement;
        }
      }
      return null;
    },
    getElementAbove: (element) => {
      const currentPos = contextValue.getElementPosition(element);
      if (!currentPos) return null;

      const { x, y } = currentPos;
      const prevY = y - 1;

      // Find element at previous position in same column
      for (const candidateElement of registryRef.current) {
        const pos = contextValue.getElementPosition(candidateElement);
        if (pos && pos.x === x && pos.y === prevY) {
          return candidateElement;
        }
      }
      return null;
    },

    // Selection manipulation methods
    setSelection: (newSelection, event = null) => {
      if (
        newSelection.length === selection.length &&
        newSelection.every((element, index) => element === selection[index])
      ) {
        return;
      }
      if (newSelection.length > 0) {
        anchorRef.current = newSelection[newSelection.length - 1];
      }
      onChange?.(newSelection, event);
    },
    addToSelection: (arrayOfElementsToAdd, event = null) => {
      const selectionWithElements = [...selection];
      let modified = false;
      let lastAdded = null;

      for (const elementToAdd of arrayOfElementsToAdd) {
        if (!selectionWithElements.includes(elementToAdd)) {
          modified = true;
          selectionWithElements.push(elementToAdd);
          lastAdded = elementToAdd;
        }
      }

      if (modified) {
        if (lastAdded) {
          anchorRef.current = lastAdded;
        }
        onChange?.(selectionWithElements, event);
      }
    },
    removeFromSelection: (arrayOfElementsToRemove, event = null) => {
      let modified = false;
      const selectionWithoutElements = [];

      for (const element of selection) {
        if (arrayOfElementsToRemove.includes(element)) {
          modified = true;
          if (element === anchorRef.current) {
            anchorRef.current = null;
          }
        } else {
          selectionWithoutElements.push(element);
        }
      }

      if (modified) {
        onChange?.(selectionWithoutElements, event);
      }
    },
    toggleElement: (element, event = null) => {
      if (selection.includes(element)) {
        contextValue.removeFromSelection([element], event);
      } else {
        contextValue.addToSelection([element], event);
      }
    },
    selectFromAnchorTo: (element, event = null) => {
      const anchorElement = anchorRef.current;

      if (anchorElement && selection.includes(anchorElement)) {
        const range = contextValue.getElementRange(anchorElement, element);
        contextValue.setSelection(range, event);
      } else {
        contextValue.setSelection([element], event);
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
  selectedElements = [],
  onChange,
  axis = "vertical", // "horizontal" or "vertical"
  children,
}) => {
  const selection = selectedElements || [];
  const registryRef = useRef(new Set()); // Set<element>
  const anchorRef = useRef(null);

  if (!["horizontal", "vertical"].includes(axis)) {
    throw new Error(
      `LinearSelectionProvider: Invalid axis "${axis}". Must be "horizontal" or "vertical".`,
    );
  }

  const contextValue = {
    selection,
    layout: axis,

    registerElement: (element) => {
      const registry = registryRef.current;
      registry.add(element);
    },
    unregisterElement: (element) => {
      const registry = registryRef.current;
      registry.delete(element);
    },
    updateElementPosition: () => {
      // No-op for linear layout since elements are already tracked
    },
    setAnchorElement: (element) => {
      anchorRef.current = element;
    },
    isElementSelected: (element) => {
      return selection.includes(element);
    },
    getAllElements: () => {
      return Array.from(registryRef.current);
    },
    getElementPosition: (element) => {
      return registryRef.current.has(element) ? element : null;
    },
    getElementRange: (fromElement, toElement) => {
      const registry = registryRef.current;

      if (!registry.has(fromElement) || !registry.has(toElement)) {
        return [];
      }

      // Use compareDocumentPosition to determine order
      const comparison = fromElement.compareDocumentPosition(toElement);
      let startElement;
      let endElement;

      if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
        // toElement comes after fromElement
        startElement = fromElement;
        endElement = toElement;
      } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
        // toElement comes before fromElement
        startElement = toElement;
        endElement = fromElement;
      } else {
        // Same element
        return [fromElement];
      }

      const elementsInRange = [];

      // Check all registered elements to see if they're in the range
      for (const element of registry) {
        // Check if element is between startElement and endElement
        const afterStart =
          startElement.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING;
        const beforeEnd =
          element.compareDocumentPosition(endElement) &
          Node.DOCUMENT_POSITION_FOLLOWING;

        if (
          element === startElement ||
          element === endElement ||
          (afterStart && beforeEnd)
        ) {
          elementsInRange.push(element);
        }
      }

      return elementsInRange;
    },

    // Navigation methods for linear layout using DOM order
    getElementAfter: (element) => {
      const registry = registryRef.current;
      if (!registry.has(element)) return null;

      let nextElement = null;

      // Find the element that comes immediately after in DOM order
      for (const candidateElement of registry) {
        if (candidateElement === element) continue;

        // Check if this element comes after current
        if (
          element.compareDocumentPosition(candidateElement) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          // If we don't have a next element yet, or this one is closer than our current next
          if (
            !nextElement ||
            candidateElement.compareDocumentPosition(nextElement) &
              Node.DOCUMENT_POSITION_PRECEDING
          ) {
            nextElement = candidateElement;
          }
        }
      }

      return nextElement;
    },
    getElementBefore: (element) => {
      const registry = registryRef.current;
      if (!registry.has(element)) return null;

      let prevElement = null;

      // Find the element that comes immediately before in DOM order
      for (const candidateElement of registry) {
        if (candidateElement === element) continue;

        // Check if this element comes before current
        if (
          element.compareDocumentPosition(candidateElement) &
          Node.DOCUMENT_POSITION_PRECEDING
        ) {
          // If we don't have a prev element yet, or this one is closer than our current prev
          if (
            !prevElement ||
            prevElement.compareDocumentPosition(candidateElement) &
              Node.DOCUMENT_POSITION_PRECEDING
          ) {
            prevElement = candidateElement;
          }
        }
      }

      return prevElement;
    },
    getElementBelow: (element) => {
      return axis === "vertical" ? contextValue.getElementAfter(element) : null;
    },
    getElementAbove: (element) => {
      return axis === "vertical"
        ? contextValue.getElementBefore(element)
        : null;
    },

    // Selection manipulation methods
    setSelection: (newSelection, event = null) => {
      if (
        newSelection.length === selection.length &&
        newSelection.every((element, index) => element === selection[index])
      ) {
        return;
      }
      if (newSelection.length > 0) {
        anchorRef.current = newSelection[newSelection.length - 1];
      }
      onChange?.(newSelection, event);
    },
    addToSelection: (arrayOfElementsToAdd, event = null) => {
      const selectionWithElements = [...selection];
      let modified = false;
      let lastAdded = null;

      for (const elementToAdd of arrayOfElementsToAdd) {
        if (!selectionWithElements.includes(elementToAdd)) {
          modified = true;
          selectionWithElements.push(elementToAdd);
          lastAdded = elementToAdd;
        }
      }

      if (modified) {
        if (lastAdded) {
          anchorRef.current = lastAdded;
        }
        onChange?.(selectionWithElements, event);
      }
    },
    removeFromSelection: (arrayOfElementsToRemove, event = null) => {
      let modified = false;
      const selectionWithoutElements = [];

      for (const element of selection) {
        if (arrayOfElementsToRemove.includes(element)) {
          modified = true;
          if (element === anchorRef.current) {
            anchorRef.current = null;
          }
        } else {
          selectionWithoutElements.push(element);
        }
      }

      if (modified) {
        onChange?.(selectionWithoutElements, event);
      }
    },
    toggleElement: (element, event = null) => {
      if (selection.includes(element)) {
        contextValue.removeFromSelection([element], event);
      } else {
        contextValue.addToSelection([element], event);
      }
    },
    selectFromAnchorTo: (element, event = null) => {
      const anchorElement = anchorRef.current;

      if (anchorElement && selection.includes(anchorElement)) {
        const range = contextValue.getElementRange(anchorElement, element);
        contextValue.setSelection(range, event);
      } else {
        contextValue.setSelection([element], event);
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

export const useRegisterSelectionElement = () => {
  const selectionContext = useSelectionContext();
  const elementRef = useRef(null);

  useLayoutEffect(() => {
    if (selectionContext && elementRef.current) {
      selectionContext.registerElement(elementRef.current);
      return () => selectionContext.unregisterElement(elementRef.current);
    }
    return undefined;
  }, [selectionContext]);

  // Update element reference when it changes
  useLayoutEffect(() => {
    if (selectionContext && elementRef.current) {
      selectionContext.updateElementPosition();
    }
  }, [selectionContext]);

  return elementRef;
};

export const clickToSelect = (clickEvent, { selectionContext, element }) => {
  if (clickEvent.defaultPrevented) {
    // If the click was prevented by another handler, do not interfere
    return;
  }

  const isMultiSelect = clickEvent.metaKey || clickEvent.ctrlKey;
  const isShiftSelect = clickEvent.shiftKey;
  const isSingleSelect = !isMultiSelect && !isShiftSelect;

  if (isSingleSelect) {
    // Single select - replace entire selection with just this item
    selectionContext.setSelection([element], clickEvent);
    return;
  }
  if (isMultiSelect) {
    // here no need to prevent nav on <a> but it means cmd + click will both multi select
    // and open in a new tab
    selectionContext.toggleElement(element, clickEvent);
    return;
  }
  if (isShiftSelect) {
    clickEvent.preventDefault(); // Prevent navigation
    selectionContext.selectFromAnchorTo(element, clickEvent);
    return;
  }
};

export const keydownToSelect = (
  keydownEvent,
  { selectionContext, element },
) => {
  if (!canInterceptKeys(keydownEvent)) {
    return;
  }

  if (keydownEvent.key === "Shift") {
    selectionContext.setAnchorElement(element);
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
    selectionContext.setSelection(
      selectionContext.getAllElements(),
      keydownEvent,
    );
    return;
  }

  if (key === "ArrowDown") {
    if (selectionContext.layout === "horizontal") {
      return; // No down navigation in horizontal layout
    }
    const nextElement = selectionContext.getElementBelow(element);
    if (!nextElement) {
      return; // No next element to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selectionContext.selectFromAnchorTo(nextElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selectionContext.addToSelection([nextElement], keydownEvent);
      return;
    }
    selectionContext.setSelection([nextElement], keydownEvent);
    return;
  }

  if (key === "ArrowUp") {
    if (selectionContext.layout === "horizontal") {
      return; // No up navigation in horizontal layout
    }
    const previousElement = selectionContext.getElementAbove(element);
    if (!previousElement) {
      return; // No previous element to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selectionContext.selectFromAnchorTo(previousElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selectionContext.addToSelection([previousElement], keydownEvent);
      return;
    }
    selectionContext.setSelection([previousElement], keydownEvent);
    return;
  }

  if (key === "ArrowLeft") {
    if (selectionContext.layout === "vertical") {
      return; // No left navigation in vertical layout
    }
    const previousElement = selectionContext.getElementBefore(element);
    if (!previousElement) {
      return; // No previous element to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selectionContext.selectFromAnchorTo(previousElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selectionContext.addToSelection([previousElement], keydownEvent);
      return;
    }
    selectionContext.setSelection([previousElement], keydownEvent);
    return;
  }

  if (key === "ArrowRight") {
    if (selectionContext.layout === "vertical") {
      return; // No right navigation in vertical layout
    }
    const nextElement = selectionContext.getElementAfter(element);
    if (!nextElement) {
      return; // No next element to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selectionContext.selectFromAnchorTo(nextElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selectionContext.addToSelection([nextElement], keydownEvent);
      return;
    }
    selectionContext.setSelection([nextElement], keydownEvent);
    return;
  }
};
