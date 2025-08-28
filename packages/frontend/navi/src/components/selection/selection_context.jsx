import { canInterceptKeys } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

const DEBUG = {
  registration: false, // Element registration/unregistration
  interaction: true, // Click and keyboard interactions
  selection: false, // Selection state changes (set, add, remove, toggle)
  navigation: true, // Arrow key navigation and element finding
  valueExtraction: false, // Value extraction from elements
};

const debug = (category, ...args) => {
  if (DEBUG[category]) {
    console.debug(`[SelectionContext:${category}]`, ...args);
  }
};

const SelectionContext = createContext(null);

// Helper function to extract value from an element
const getElementValue = (element) => {
  let value;
  if (element.value !== undefined) {
    value = element.value;
  } else if (element.hasAttribute("data-value")) {
    value = element.getAttribute("data-value");
  } else {
    value = element;
  }
  debug("valueExtraction", "getElementValue:", element, "->", value);
  return value;
};

export const SelectionProvider = ({
  selectedValues = [],
  onChange,
  layout = "vertical",
  children,
}) => {
  if (layout === "grid") {
    return (
      <GridSelectionProvider
        selectedValues={selectedValues}
        onChange={onChange}
      >
        {children}
      </GridSelectionProvider>
    );
  }

  return (
    <LinearSelectionProvider
      selectedValues={selectedValues}
      onChange={onChange}
      axis={layout}
    >
      {children}
    </LinearSelectionProvider>
  );
};
// Grid Selection Provider - for 2D layouts like tables
const GridSelectionProvider = ({ selectedValues = [], onChange, children }) => {
  const selection = selectedValues || [];
  const registryRef = useRef(new Set()); // Set<element>
  const anchorRef = useRef(null);

  const contextValue = {
    selection,
    layout: "grid",

    registerElement: (element) => {
      const registry = registryRef.current;
      const value = getElementValue(element);
      debug(
        "registration",
        "Grid registerElement:",
        element,
        "value:",
        value,
        "registry size before:",
        registry.size,
      );
      registry.add(element);
      debug(
        "registration",
        "Grid registerElement: registry size after:",
        registry.size,
      );
    },
    unregisterElement: (element) => {
      const registry = registryRef.current;
      const value = getElementValue(element);
      debug(
        "registration",
        "Grid unregisterElement:",
        element,
        "value:",
        value,
        "registry size before:",
        registry.size,
      );
      registry.delete(element);
      debug(
        "registration",
        "Grid unregisterElement: registry size after:",
        registry.size,
      );
    },
    setAnchorElement: (element) => {
      const value = getElementValue(element);
      debug("selection", "Grid setAnchorElement:", element, "value:", value);
      anchorRef.current = element;
    },
    isElementSelected: (element) => {
      const value = getElementValue(element);
      const isSelected = selection.includes(value);
      return isSelected;
    },
    isValueSelected: (value) => {
      const isSelected = selection.includes(value);
      return isSelected;
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
      const valuesInRange = [];
      for (const element of registryRef.current) {
        const pos = contextValue.getElementPosition(element);
        if (
          pos &&
          pos.x >= minX &&
          pos.x <= maxX &&
          pos.y >= minY &&
          pos.y <= maxY
        ) {
          valuesInRange.push(getElementValue(element));
        }
      }

      return valuesInRange;
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
      debug(
        "selection",
        "Grid setSelection called with:",
        newSelection,
        "current selection:",
        selection,
      );
      if (
        newSelection.length === selection.length &&
        newSelection.every((value, index) => value === selection[index])
      ) {
        debug("selection", "Grid setSelection: no change, returning early");
        return;
      }
      if (newSelection.length > 0) {
        // Find the element for the last selected value to set as anchor
        const lastValue = newSelection[newSelection.length - 1];
        debug(
          "selection",
          "Grid setSelection: finding element for anchor value:",
          lastValue,
        );
        for (const element of registryRef.current) {
          element.setAttribute("aria-selected", "true");
          if (getElementValue(element) === lastValue) {
            debug(
              "selection",
              "Grid setSelection: setting anchor element:",
              element,
            );
            anchorRef.current = element;
            break;
          }
        }
      } else {
        debug(
          "selection",
          "Grid setSelection: clearing anchor (empty selection)",
        );
        anchorRef.current = null;
      }
      debug(
        "selection",
        "Grid setSelection: calling onChange with:",
        newSelection,
      );
      onChange?.(newSelection, event);
    },
    addToSelection: (arrayOfValuesToAdd, event = null) => {
      debug(
        "selection",
        "Grid addToSelection called with:",
        arrayOfValuesToAdd,
        "current selection:",
        selection,
      );
      const selectionWithValues = [...selection];
      let modified = false;
      let lastAddedElement = null;

      for (const valueToAdd of arrayOfValuesToAdd) {
        if (!selectionWithValues.includes(valueToAdd)) {
          modified = true;
          selectionWithValues.push(valueToAdd);
          debug("selection", "Grid addToSelection: adding value:", valueToAdd);
          // Find the element for this value
          for (const element of registryRef.current) {
            if (getElementValue(element) === valueToAdd) {
              lastAddedElement = element;
              debug(
                "selection",
                "Grid addToSelection: found element for value:",
                element,
              );
              break;
            }
          }
        }
      }

      if (modified) {
        if (lastAddedElement) {
          debug(
            "selection",
            "Grid addToSelection: setting anchor element:",
            lastAddedElement,
          );
          anchorRef.current = lastAddedElement;
        }
        debug(
          "selection",
          "Grid addToSelection: calling onChange with:",
          selectionWithValues,
        );
        onChange?.(selectionWithValues, event);
      } else {
        debug("selection", "Grid addToSelection: no changes made");
      }
    },
    removeFromSelection: (arrayOfValuesToRemove, event = null) => {
      let modified = false;
      const selectionWithoutValues = [];

      for (const value of selection) {
        if (arrayOfValuesToRemove.includes(value)) {
          modified = true;
          // Check if we're removing the anchor element
          if (
            anchorRef.current &&
            getElementValue(anchorRef.current) === value
          ) {
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
    toggleElement: (element, event = null) => {
      const value = getElementValue(element);
      if (selection.includes(value)) {
        contextValue.removeFromSelection([value], event);
      } else {
        contextValue.addToSelection([value], event);
      }
    },
    selectFromAnchorTo: (element, event = null) => {
      const anchorElement = anchorRef.current;

      if (anchorElement && selection.includes(getElementValue(anchorElement))) {
        const range = contextValue.getElementRange(anchorElement, element);
        contextValue.setSelection(range, event);
      } else {
        contextValue.setSelection([getElementValue(element)], event);
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
  selectedValues = [],
  onChange,
  axis = "vertical", // "horizontal" or "vertical"
  children,
}) => {
  const selection = selectedValues || [];
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
      const value = getElementValue(element);
      debug(
        "registration",
        "Linear registerElement:",
        element,
        "value:",
        value,
        "registry size before:",
        registry.size,
      );
      registry.add(element);
      debug(
        "registration",
        "Linear registerElement: registry size after:",
        registry.size,
      );
    },
    unregisterElement: (element) => {
      const registry = registryRef.current;
      const value = getElementValue(element);
      debug(
        "registration",
        "Linear unregisterElement:",
        element,
        "value:",
        value,
        "registry size before:",
        registry.size,
      );
      registry.delete(element);
      debug(
        "registration",
        "Linear unregisterElement: registry size after:",
        registry.size,
      );
    },
    setAnchorElement: (element) => {
      const value = getElementValue(element);
      debug("selection", "Linear setAnchorElement:", element, "value:", value);
      anchorRef.current = element;
    },
    isElementSelected: (element) => {
      const value = getElementValue(element);
      const isSelected = selection.includes(value);
      return isSelected;
    },
    isValueSelected: (value) => {
      const isSelected = selection.includes(value);
      return isSelected;
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
        return [getElementValue(fromElement)];
      }

      const valuesInRange = [];

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
          valuesInRange.push(getElementValue(element));
        }
      }

      return valuesInRange;
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
        newSelection.every((value, index) => value === selection[index])
      ) {
        return;
      }
      if (newSelection.length > 0) {
        // Find the element for the last selected value to set as anchor
        const lastValue = newSelection[newSelection.length - 1];
        for (const element of registryRef.current) {
          if (getElementValue(element) === lastValue) {
            anchorRef.current = element;
            break;
          }
        }
      }
      onChange?.(newSelection, event);
    },
    addToSelection: (arrayOfValuesToAdd, event = null) => {
      const selectionWithValues = [...selection];
      let modified = false;
      let lastAddedElement = null;

      for (const valueToAdd of arrayOfValuesToAdd) {
        if (!selectionWithValues.includes(valueToAdd)) {
          modified = true;
          selectionWithValues.push(valueToAdd);
          // Find the element for this value
          for (const element of registryRef.current) {
            if (getElementValue(element) === valueToAdd) {
              lastAddedElement = element;
              break;
            }
          }
        }
      }

      if (modified) {
        if (lastAddedElement) {
          anchorRef.current = lastAddedElement;
        }
        onChange?.(selectionWithValues, event);
      }
    },
    removeFromSelection: (arrayOfValuesToRemove, event = null) => {
      let modified = false;
      const selectionWithoutValues = [];

      for (const value of selection) {
        if (arrayOfValuesToRemove.includes(value)) {
          modified = true;
          // Check if we're removing the anchor element
          if (
            anchorRef.current &&
            getElementValue(anchorRef.current) === value
          ) {
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
    toggleElement: (element, event = null) => {
      const value = getElementValue(element);
      if (selection.includes(value)) {
        contextValue.removeFromSelection([value], event);
      } else {
        contextValue.addToSelection([value], event);
      }
    },
    selectFromAnchorTo: (element, event = null) => {
      const anchorElement = anchorRef.current;

      if (anchorElement && selection.includes(getElementValue(anchorElement))) {
        const range = contextValue.getElementRange(anchorElement, element);
        contextValue.setSelection(range, event);
      } else {
        contextValue.setSelection([getElementValue(element)], event);
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

export const useRegisterSelectableElement = (elementRef) => {
  const selectionContext = useSelectionContext();

  useLayoutEffect(() => {
    if (selectionContext && elementRef.current) {
      const element = elementRef.current;
      const value = getElementValue(element);
      debug(
        "registration",
        "useRegisterSelectableElement: registering element:",
        element,
        "value:",
        value,
      );
      selectionContext.registerElement(element);
      return () => {
        debug(
          "registration",
          "useRegisterSelectableElement: unregistering element:",
          element,
          "value:",
          value,
        );
        selectionContext.unregisterElement(element);
      };
    }
    return undefined;
  }, [selectionContext]);

  return {
    clickToSelect: (e) => {
      clickToSelect(e, { selectionContext, element: elementRef.current });
    },
    keydownToSelect: (e) => {
      keydownToSelect(e, { selectionContext, element: elementRef.current });
    },
  };
};

export const clickToSelect = (clickEvent, { selectionContext, element }) => {
  if (clickEvent.defaultPrevented) {
    // If the click was prevented by another handler, do not interfere
    debug("interaction", "clickToSelect: event already prevented, skipping");
    return;
  }

  const isMultiSelect = clickEvent.metaKey || clickEvent.ctrlKey;
  const isShiftSelect = clickEvent.shiftKey;
  const isSingleSelect = !isMultiSelect && !isShiftSelect;
  const value = getElementValue(element);

  debug("interaction", "clickToSelect:", {
    element,
    value,
    isMultiSelect,
    isShiftSelect,
    isSingleSelect,
    currentSelection: selectionContext.selection,
  });

  if (isSingleSelect) {
    // Single select - replace entire selection with just this item
    debug(
      "interaction",
      "clickToSelect: single select, setting selection to:",
      [value],
    );
    selectionContext.setSelection([value], clickEvent);
    return;
  }
  if (isMultiSelect) {
    // here no need to prevent nav on <a> but it means cmd + click will both multi select
    // and open in a new tab
    debug("interaction", "clickToSelect: multi select, toggling element");
    selectionContext.toggleElement(element, clickEvent);
    return;
  }
  if (isShiftSelect) {
    clickEvent.preventDefault(); // Prevent navigation
    debug(
      "interaction",
      "clickToSelect: shift select, selecting from anchor to element",
    );
    selectionContext.selectFromAnchorTo(element, clickEvent);
    return;
  }
};

export const keydownToSelect = (
  keydownEvent,
  { selectionContext, element },
) => {
  if (!canInterceptKeys(keydownEvent)) {
    debug("interaction", "keydownToSelect: cannot intercept keys, skipping");
    return;
  }

  const value = getElementValue(element);
  debug("interaction", "keydownToSelect:", {
    key: keydownEvent.key,
    element,
    value,
    currentSelection: selectionContext.selection,
    layout: selectionContext.layout,
  });

  if (keydownEvent.key === "Shift") {
    debug("interaction", "keydownToSelect: Shift key, setting anchor element");
    selectionContext.setAnchorElement(element);
    return;
  }

  const isMultiSelect = keydownEvent.metaKey || keydownEvent.ctrlKey;
  const isShiftSelect = keydownEvent.shiftKey;
  const { key } = keydownEvent;

  if (key === "a") {
    if (!isMultiSelect) {
      debug(
        "interaction",
        'keydownToSelect: "a" key without multi-select modifier, skipping',
      );
      return;
    }
    keydownEvent.preventDefault(); // prevent default select all text behavior
    const allValues = selectionContext.getAllElements().map(getElementValue);
    debug(
      "interaction",
      "keydownToSelect: Select All - setting selection to all values:",
      allValues,
    );
    selectionContext.setSelection(allValues, keydownEvent);
    return;
  }

  if (key === "ArrowDown") {
    if (selectionContext.layout === "horizontal") {
      debug(
        "navigation",
        "keydownToSelect: ArrowDown in horizontal layout, skipping",
      );
      return; // No down navigation in horizontal layout
    }
    const nextElement = selectionContext.getElementBelow(element);
    if (!nextElement) {
      debug("navigation", "keydownToSelect: ArrowDown - no next element found");
      return; // No next element to select
    }
    const nextValue = getElementValue(nextElement);
    debug(
      "navigation",
      "keydownToSelect: ArrowDown - found next element:",
      nextElement,
      "value:",
      nextValue,
    );
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      debug(
        "interaction",
        "keydownToSelect: ArrowDown with Shift - selecting from anchor to next element",
      );
      selectionContext.selectFromAnchorTo(nextElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      debug(
        "interaction",
        "keydownToSelect: ArrowDown with multi-select - adding to selection",
      );
      selectionContext.addToSelection([nextValue], keydownEvent);
      return;
    }
    debug(
      "interaction",
      "keydownToSelect: ArrowDown - setting selection to next element",
    );
    selectionContext.setSelection([nextValue], keydownEvent);
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
      selectionContext.addToSelection(
        [getElementValue(previousElement)],
        keydownEvent,
      );
      return;
    }
    selectionContext.setSelection(
      [getElementValue(previousElement)],
      keydownEvent,
    );
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
      selectionContext.addToSelection(
        [getElementValue(previousElement)],
        keydownEvent,
      );
      return;
    }
    selectionContext.setSelection(
      [getElementValue(previousElement)],
      keydownEvent,
    );
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
      selectionContext.addToSelection(
        [getElementValue(nextElement)],
        keydownEvent,
      );
      return;
    }
    selectionContext.setSelection([getElementValue(nextElement)], keydownEvent);
    return;
  }
};
