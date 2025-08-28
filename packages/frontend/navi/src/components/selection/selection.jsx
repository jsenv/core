import { canInterceptKeys } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { createCallbackController } from "../callback_controller.js";

const DEBUG = {
  registration: false, // Element registration/unregistration
  interaction: true, // Click and keyboard interactions
  selection: true, // Selection state changes (set, add, remove, toggle)
  navigation: true, // Arrow key navigation and element finding
  valueExtraction: false, // Value extraction from elements
};

const debug = (category, ...args) => {
  if (DEBUG[category]) {
    console.debug(`[selection:${category}]`, ...args);
  }
};

const SelectionContext = createContext(null);
const SelectionProvider = ({ selection, children }) => {
  return (
    <SelectionContext.Provider value={selection}>
      {children}
    </SelectionContext.Provider>
  );
};
export const useSelectionProvider = ({ layout, value, onChange }) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const selection = useMemo(() => {
    const onChange = (...args) => {
      onChangeRef.current(...args);
    };

    if (layout === "grid") {
      return createGridSelection({
        value,
        onChange,
      });
    }
    return createLinearSelection({
      value,
      onChange,
      axis: layout,
    });
  }, [layout]);

  // Update the selection's internal values when external value changes
  useEffect(() => {
    selection.update(value);
  }, [selection, value]);

  const LocalSelectionProvider = useMemo(() => {
    const Stuff = ({ children }) => {
      return (
        <SelectionProvider selection={selection}>{children}</SelectionProvider>
      );
    };
    return Stuff;
  }, [selection]);

  return LocalSelectionProvider;
};
// Base Selection - shared functionality between grid and linear
const createBaseSelection = ({
  registry,
  value = [],
  onChange,
  type,
  navigationMethods: {
    getElementRange,
    getElementAfter,
    getElementBefore,
    getElementBelow,
    getElementAbove,
  },
}) => {
  const [change, triggerChange] = createCallbackController();
  change.add(onChange);
  const update = (newValue, event) => {
    debug(
      "selection",
      `${type} setSelection: calling onChange with:`,
      newValue,
    );
    value = newValue;
    triggerChange(value, event);
  };
  let anchorElement = null;

  // Element registration methods
  const registerElement = (element) => {
    const elementValue = getElementValue(element);
    debug(
      "registration",
      `${type} registerElement:`,
      element,
      "value:",
      elementValue,
      "registry size before:",
      registry.size,
    );
    registry.add(element);
    debug(
      "registration",
      `${type} registerElement: registry size after:`,
      registry.size,
    );
  };
  const unregisterElement = (element) => {
    const elementValue = getElementValue(element);
    debug(
      "registration",
      `${type} unregisterElement:`,
      element,
      "value:",
      elementValue,
      "registry size before:",
      registry.size,
    );
    registry.delete(element);
    debug(
      "registration",
      `${type} unregisterElement: registry size after:`,
      registry.size,
    );
  };
  const setAnchorElement = (element) => {
    const elementValue = getElementValue(element);
    debug(
      "selection",
      `${type} setAnchorElement:`,
      element,
      "value:",
      elementValue,
    );
    anchorElement = element;
  };
  const isElementSelected = (element) => {
    const elementValue = getElementValue(element);
    const isSelected = baseSelection.value.includes(elementValue);
    return isSelected;
  };
  const isValueSelected = (value) => {
    const isSelected = baseSelection.value.includes(value);
    return isSelected;
  };
  // Selection manipulation methods
  const setSelection = (newSelection, event = null) => {
    debug(
      "selection",
      `${type} setSelection called with:`,
      newSelection,
      "current selection:",
      baseSelection.value,
    );
    if (
      newSelection.length === baseSelection.value.length &&
      newSelection.every((value, index) => value === baseSelection.value[index])
    ) {
      debug("selection", `${type} setSelection: no change, returning early`);
      return;
    }
    if (newSelection.length > 0) {
      // Find the element for the last selected value to set as anchor
      const lastValue = newSelection[newSelection.length - 1];
      debug(
        "selection",
        `${type} setSelection: finding element for anchor value:`,
        lastValue,
      );
      for (const element of registry) {
        if (getElementValue(element) === lastValue) {
          debug(
            "selection",
            `${type} setSelection: setting anchor element:`,
            element,
          );
          anchorElement = element;
          break;
        }
      }
    } else {
      debug(
        "selection",
        `${type} setSelection: clearing anchor (empty selection)`,
      );
      anchorElement = null;
    }

    update(newSelection, event);
  };
  const addToSelection = (arrayOfValuesToAdd, event = null) => {
    debug(
      "selection",
      `${type} addToSelection called with:`,
      arrayOfValuesToAdd,
      "current selection:",
      baseSelection.value,
    );
    const selectionWithValues = [...baseSelection.value];
    let modified = false;
    let lastAddedElement = null;

    for (const valueToAdd of arrayOfValuesToAdd) {
      if (!selectionWithValues.includes(valueToAdd)) {
        modified = true;
        selectionWithValues.push(valueToAdd);
        debug("selection", `${type} addToSelection: adding value:`, valueToAdd);
        // Find the element for this value
        for (const element of registry) {
          if (getElementValue(element) === valueToAdd) {
            lastAddedElement = element;
            debug(
              "selection",
              `${type} addToSelection: found element for value:`,
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
          `${type} addToSelection: setting anchor element:`,
          lastAddedElement,
        );
        anchorElement = lastAddedElement;
      }
      update(selectionWithValues, event);
    } else {
      debug("selection", `${type} addToSelection: no changes made`);
    }
  };
  const removeFromSelection = (arrayOfValuesToRemove, event = null) => {
    let modified = false;
    const selectionWithoutValues = [];

    for (const elementValue of baseSelection.value) {
      if (arrayOfValuesToRemove.includes(elementValue)) {
        modified = true;
        // Check if we're removing the anchor element
        if (anchorElement && getElementValue(anchorElement) === elementValue) {
          anchorElement = null;
        }
      } else {
        selectionWithoutValues.push(elementValue);
      }
    }

    if (modified) {
      update(selectionWithoutValues, event);
    }
  };
  const toggleElement = (element, event = null) => {
    const elementValue = getElementValue(element);
    if (baseSelection.value.includes(elementValue)) {
      baseSelection.removeFromSelection([elementValue], event);
    } else {
      baseSelection.addToSelection([elementValue], event);
    }
  };
  const selectFromAnchorTo = (element, event = null) => {
    if (
      anchorElement &&
      baseSelection.value.includes(getElementValue(anchorElement))
    ) {
      const range = getElementRange(anchorElement, element);
      baseSelection.setSelection(range, event);
    } else {
      baseSelection.setSelection([getElementValue(element)], event);
    }
  };
  const selectAll = (event) => {
    const allValues = [];
    for (const element of registry) {
      allValues.push(getElementValue(element));
    }
    debug(
      "interaction",
      "Select All - setting selection to all values:",
      allValues,
    );
    baseSelection.setSelection(allValues, event);
  };

  const baseSelection = {
    type,
    get value() {
      return value;
    },
    registry,
    get anchorElement() {
      return anchorElement;
    },
    channels: {
      change,
    },
    update,

    registerElement,
    unregisterElement,
    setAnchorElement,
    isElementSelected,
    isValueSelected,
    setSelection,
    addToSelection,
    removeFromSelection,
    toggleElement,
    selectFromAnchorTo,
    selectAll,

    // Navigation methods (will be overridden by specific implementations)
    getElementRange,
    getElementAfter,
    getElementBefore,
    getElementBelow,
    getElementAbove,
  };

  return baseSelection;
};
// Grid Selection Provider - for 2D layouts like tables
const createGridSelection = ({ value = [], onChange }) => {
  const registry = new Set();
  const getElementPosition = (element) => {
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
  };
  const navigationMethods = {
    getElementRange: (fromElement, toElement) => {
      const fromPos = getElementPosition(fromElement);
      const toPos = getElementPosition(toElement);

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
      for (const element of registry) {
        const pos = getElementPosition(element);
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

    getElementAfter: (element) => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }

      const { x, y } = currentPos;
      const nextX = x + 1;

      // Find element at next position in same row
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        if (pos && pos.x === nextX && pos.y === y) {
          return candidateElement;
        }
      }
      return null;
    },

    getElementBefore: (element) => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }

      const { x, y } = currentPos;
      const prevX = x - 1;

      // Find element at previous position in same row
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        if (pos && pos.x === prevX && pos.y === y) {
          return candidateElement;
        }
      }
      return null;
    },

    getElementBelow: (element) => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }

      const { x, y } = currentPos;
      const nextY = y + 1;

      // Find element at next position in same column
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        if (pos && pos.x === x && pos.y === nextY) {
          return candidateElement;
        }
      }
      return null;
    },

    getElementAbove: (element) => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }

      const { x, y } = currentPos;
      const prevY = y - 1;

      // Find element at previous position in same column
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        if (pos && pos.x === x && pos.y === prevY) {
          return candidateElement;
        }
      }
      return null;
    },
  };
  const gridSelection = createBaseSelection({
    registry,
    value,
    onChange,
    type: "grid",
    navigationMethods,
  });

  return gridSelection;
};
// Linear Selection Provider - for 1D layouts like lists
const createLinearSelection = ({
  value = [],
  onChange,
  axis = "vertical", // "horizontal" or "vertical"
}) => {
  if (!["horizontal", "vertical"].includes(axis)) {
    throw new Error(
      `useLinearSelection: Invalid axis "${axis}". Must be "horizontal" or "vertical".`,
    );
  }

  const registry = new Set();
  // Define navigation methods that need access to registry
  const navigationMethods = {
    getElementRange: (fromElement, toElement) => {
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
    getElementAfter: (element) => {
      if (!registry.has(element)) {
        return null;
      }
      let nextElement = null;
      // Find the element that comes immediately after in DOM order
      for (const candidateElement of registry) {
        if (candidateElement === element) {
          continue;
        }

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
      if (!registry.has(element)) {
        return null;
      }

      let prevElement = null;

      // Find the element that comes immediately before in DOM order
      for (const candidateElement of registry) {
        if (candidateElement === element) {
          continue;
        }

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
    // Add axis-dependent methods
    getElementBelow: (element) => {
      if (axis === "vertical") {
        return navigationMethods.getElementAfter(element);
      }
      return null;
    },
    getElementAbove: (element) => {
      if (axis === "vertical") {
        return navigationMethods.getElementBefore(element);
      }
      return null;
    },
  };

  // Create base selection with navigation methods
  const linearSelection = createBaseSelection({
    registry,
    value,
    onChange,
    type: "linear",
    navigationMethods,
  });
  linearSelection.axis = axis;

  return linearSelection;
};
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

export const useSelection = () => {
  return useContext(SelectionContext);
};

export const useSelectableElement = (elementRef) => {
  const selection = useSelection();
  if (!selection) {
    throw new Error(
      "useSelectableElement must be used within a SelectionProvider",
    );
  }

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const value = getElementValue(element);
    debug(
      "registration",
      "useSelectableElement: registering element:",
      element,
      "value:",
      value,
    );
    selection.registerElement(element);
    return () => {
      debug(
        "registration",
        "useSelectableElement: unregistering element:",
        element,
        "value:",
        value,
      );
      selection.unregisterElement(element);
    };
  }, [selection]);

  const [selected, setSelected] = useState(false);
  debug("selection", "useSelectableElement: initial selected state:", selected);

  // Update selected state when selection changes
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      debug(
        "selection",
        "useSelectableElement: no element, setting selected to false",
      );
      setSelected(false);
      return null;
    }
    const isSelected = selection.isElementSelected(element);
    setSelected(isSelected);
    return selection.channels.change.add(() => {
      const isSelected = selection.isElementSelected(element);
      setSelected(isSelected);
    });
  }, [selection]);

  // Add event listeners directly to the element
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    let isDragging = false;
    let dragStartElement = null;

    const handleKeyDown = (e) => {
      keydownToSelect(e, { selection, element });
    };

    const handleMouseDown = (e) => {
      if (e.button !== 0) {
        // Only handle left mouse button
        return;
      }

      if (e.defaultPrevented) {
        // If the event was prevented by another handler, do not interfere
        debug("interaction", "mousedown: event already prevented, skipping");
        return;
      }

      const isMultiSelect = e.metaKey || e.ctrlKey;
      const isShiftSelect = e.shiftKey;
      const isSingleSelect = !isMultiSelect && !isShiftSelect;
      const value = getElementValue(element);

      debug("interaction", "mousedown:", {
        element,
        value,
        isMultiSelect,
        isShiftSelect,
        isSingleSelect,
        currentSelection: selection.value,
      });

      // Handle immediate selection based on modifier keys
      if (isSingleSelect) {
        // Single select - replace entire selection with just this item
        debug(
          "interaction",
          "mousedown: single select, setting selection to:",
          [value],
        );
        selection.setSelection([value], e);
      } else if (isMultiSelect && !isShiftSelect) {
        // Multi select without shift - toggle element
        debug("interaction", "mousedown: multi select, toggling element");
        selection.toggleElement(element, e);
      } else if (isShiftSelect) {
        e.preventDefault(); // Prevent navigation
        debug(
          "interaction",
          "mousedown: shift select, selecting from anchor to element",
        );
        selection.selectFromAnchorTo(element, e);
      }

      // Set up for potential drag selection (now works with all modifier combinations)
      dragStartElement = element;
      isDragging = false; // Will be set to true if mouse moves

      const handleMouseMove = (e) => {
        if (!dragStartElement) {
          return;
        }

        if (!isDragging) {
          isDragging = true;
          // Find the table container and mark it as drag-selecting
          const table = element.closest("table");
          if (table) {
            table.setAttribute("data-drag-selecting", "");
          }
        }

        // Find the element under the current mouse position
        const elementUnderMouse = document.elementFromPoint(
          e.clientX,
          e.clientY,
        );
        if (!elementUnderMouse) {
          return;
        }

        // Find the closest selectable element (look for element with data-value or in registry)
        let targetElement = elementUnderMouse;
        while (targetElement) {
          if (selection.registry.has(targetElement)) {
            break;
          }
          if (
            targetElement.hasAttribute("data-value") ||
            targetElement.hasAttribute("aria-selected")
          ) {
            break;
          }
          targetElement = targetElement.parentElement;
        }

        if (targetElement && selection.registry.has(targetElement)) {
          // Set anchor to drag start if not already set
          if (
            !selection.anchorElement ||
            getElementValue(selection.anchorElement) !==
              getElementValue(dragStartElement)
          ) {
            selection.setAnchorElement(dragStartElement);
          }

          // Get the range from anchor to current target
          const rangeValues = selection.getElementRange(
            dragStartElement,
            targetElement,
          );

          // Check if we're using modifier keys for additive selection
          const isAdditive = e.metaKey || e.ctrlKey || e.shiftKey;

          if (isAdditive) {
            // For modifier key drag, add to existing selection
            debug(
              "interaction",
              "drag select with modifiers: adding range to selection",
              rangeValues,
            );
            const currentSelection = [...selection.value];
            const newSelection = [
              ...new Set([...currentSelection, ...rangeValues]),
            ];
            selection.setSelection(newSelection, e);
          } else {
            // For normal drag, replace selection
            debug(
              "interaction",
              "drag select: setting selection to range",
              rangeValues,
            );
            selection.setSelection(rangeValues, e);
          }
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Remove drag-selecting state from table
        if (isDragging) {
          const table = element.closest("table");
          if (table) {
            table.removeAttribute("data-drag-selecting");
          }
        }

        // Reset drag state
        dragStartElement = null;
        isDragging = false;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    element.addEventListener("keydown", handleKeyDown);
    element.addEventListener("mousedown", handleMouseDown);

    return () => {
      element.removeEventListener("keydown", handleKeyDown);
      element.removeEventListener("mousedown", handleMouseDown);
    };
  }, [selection]);

  return {
    selected,
  };
};
const keydownToSelect = (keydownEvent, { selection, element }) => {
  if (!canInterceptKeys(keydownEvent)) {
    debug("interaction", "keydownToSelect: cannot intercept keys, skipping");
    return;
  }

  const value = getElementValue(element);
  debug("interaction", "keydownToSelect:", {
    key: keydownEvent.key,
    element,
    value,
    currentSelection: selection.value,
    type: selection.type,
  });

  if (keydownEvent.key === "Shift") {
    debug("interaction", "keydownToSelect: Shift key, setting anchor element");
    selection.setAnchorElement(element);
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
    selection.selectAll(keydownEvent);
    return;
  }

  if (key === "ArrowDown") {
    if (selection.axis === "horizontal") {
      debug(
        "navigation",
        "keydownToSelect: ArrowDown in horizontal layout, skipping",
      );
      return; // No down navigation in horizontal layout
    }
    const nextElement = selection.getElementBelow(element);
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
      selection.selectFromAnchorTo(nextElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      debug(
        "interaction",
        "keydownToSelect: ArrowDown with multi-select - adding to selection",
      );
      selection.addToSelection([nextValue], keydownEvent);
      return;
    }
    debug(
      "interaction",
      "keydownToSelect: ArrowDown - setting selection to next element",
    );
    selection.setSelection([nextValue], keydownEvent);
    return;
  }

  if (key === "ArrowUp") {
    if (selection.axis === "horizontal") {
      return; // No up navigation in horizontal layout
    }
    const previousElement = selection.getElementAbove(element);
    if (!previousElement) {
      return; // No previous element to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selection.selectFromAnchorTo(previousElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selection.addToSelection(
        [getElementValue(previousElement)],
        keydownEvent,
      );
      return;
    }
    selection.setSelection([getElementValue(previousElement)], keydownEvent);
    return;
  }

  if (key === "ArrowLeft") {
    if (selection.axis === "vertical") {
      return; // No left navigation in vertical layout
    }
    const previousElement = selection.getElementBefore(element);
    if (!previousElement) {
      return; // No previous element to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selection.selectFromAnchorTo(previousElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selection.addToSelection(
        [getElementValue(previousElement)],
        keydownEvent,
      );
      return;
    }
    selection.setSelection([getElementValue(previousElement)], keydownEvent);
    return;
  }

  if (key === "ArrowRight") {
    if (selection.axis === "vertical") {
      return; // No right navigation in vertical layout
    }
    const nextElement = selection.getElementAfter(element);
    if (!nextElement) {
      return; // No next element to select
    }
    keydownEvent.preventDefault(); // Prevent default scrolling behavior
    if (isShiftSelect) {
      selection.selectFromAnchorTo(nextElement, keydownEvent);
      return;
    }
    if (isMultiSelect) {
      selection.addToSelection([getElementValue(nextElement)], keydownEvent);
      return;
    }
    selection.setSelection([getElementValue(nextElement)], keydownEvent);
    return;
  }
};
