import { findAfter, findBefore } from "@jsenv/dom";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { createCallbackController } from "../callback_controller.js";

const DEBUG = {
  registration: false, // Element registration/unregistration
  interaction: false, // Click and keyboard interactions
  selection: false, // Selection state changes (set, add, remove, toggle)
  navigation: false, // Arrow key navigation and element finding
  valueExtraction: false, // Value extraction from elements
};

const debug = (category, ...args) => {
  if (DEBUG[category]) {
    console.debug(`[selection:${category}]`, ...args);
  }
};

export const useSelectionController = ({
  elementRef,
  layout,
  value,
  onChange,
  multiple,
  selectAllName,
  dragToSelect,
}) => {
  if (!elementRef) {
    throw new Error("useSelectionController: elementRef is required");
  }

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const currentValueRef = useRef(value);
  currentValueRef.current = value;

  const lastInternalValueRef = useRef(null);

  const selectionController = useMemo(() => {
    const onChange = (newValue, ...args) => {
      lastInternalValueRef.current = newValue;
      onChangeRef.current(newValue, ...args);
    };

    const getCurrentValue = () => currentValueRef.current;

    if (layout === "grid") {
      return createGridSelection({
        getCurrentValue,
        onChange,
        elementRef,
        multiple,
        selectAllName,
        dragToSelect,
      });
    }
    return createLinearSelection({
      getCurrentValue,
      onChange,
      axis: layout,
      elementRef,
      multiple,
      selectAllName,
      dragToSelect,
    });
  }, [layout, multiple, elementRef]);

  useEffect(() => {
    selectionController.element = elementRef.current;
  }, [selectionController]);

  // Smart sync: only update selection when value changes externally
  useEffect(() => {
    // Check if this is an external change (not from our internal onChange)
    const isExternalChange = !compareTwoJsValues(
      value,
      lastInternalValueRef.current,
    );
    if (isExternalChange) {
      console.log("external value change detected, updating selection", value);
      selectionController.update(value);
    } else {
      console.log("internal value change, skipping update");
    }
  }, [value, selectionController]);

  return selectionController;
};
// Base Selection - shared functionality between grid and linear
const createBaseSelection = ({
  getCurrentValue,
  registry,
  onChange,
  type,
  multiple,
  selectAllName,
  navigationMethods: {
    getElementRange,
    getElementAfter,
    getElementBefore,
    getElementBelow,
    getElementAbove,
  },
}) => {
  const [change, triggerChange] = createCallbackController();

  const getElementByValue = (valueToFind) => {
    for (const element of registry) {
      if (getElementValue(element) === valueToFind) {
        return element;
      }
    }
    return null;
  };

  const update = (newValue, event) => {
    const currentValue = getCurrentValue();
    if (compareTwoJsValues(newValue, currentValue)) {
      return;
    }

    const oldSelectedSet = new Set(currentValue);
    const newSelectedSet = new Set(newValue);
    const willBeUnselectedSet = new Set();
    for (const item of oldSelectedSet) {
      if (!newSelectedSet.has(item)) {
        willBeUnselectedSet.add(item);
      }
    }
    const selectionSet = new Set(newValue);
    for (const newSelected of newSelectedSet) {
      const element = getElementByValue(newSelected);
      if (element._selectionImpact) {
        const impactedValues = element._selectionImpact();
        for (const impactedValue of impactedValues) {
          selectionSet.add(impactedValue);
        }
      }
    }
    for (const willBeUnselected of willBeUnselectedSet) {
      const element = getElementByValue(willBeUnselected);
      if (element._selectionImpact) {
        const impactedValues = element._selectionImpact();
        for (const impactedValue of impactedValues) {
          if (selectionSet.has(impactedValue)) {
            // want to be selected -> keep it
            // - might be explicit : initially part of newValue/selectionSet)
            // - or implicit: added to selectionSet by selectionImpact
            continue;
          }
          selectionSet.delete(impactedValue);
        }
      }
    }

    const finalValue = Array.from(selectionSet);
    debug(
      "selection",
      `${type} setSelection: calling onChange with:`,
      finalValue,
    );
    onChange(finalValue, event);
    triggerChange(finalValue, event);
  };
  let anchorElement = null;
  let activeElement = null;

  const registerElement = (element, options = {}) => {
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
    // Store the selectionImpact callback if provided
    if (options.selectionImpact) {
      element._selectionImpact = options.selectionImpact;
    }
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
  const setActiveElement = (element) => {
    activeElement = element;
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

    for (const valueToAdd of arrayOfValuesToAdd) {
      if (!selectionWithValues.includes(valueToAdd)) {
        modified = true;
        selectionWithValues.push(valueToAdd);
        debug("selection", `${type} addToSelection: adding value:`, valueToAdd);
      }
    }

    if (modified) {
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
    if (anchorElement) {
      const currentAnchor = anchorElement; // Preserve the current anchor
      const range = getElementRange(anchorElement, element);
      baseSelection.setSelection(range, event);
      // Restore the original anchor (setSelection changes it to the last element)
      anchorElement = currentAnchor;
    } else {
      baseSelection.setSelection([getElementValue(element)], event);
    }
  };
  const selectAll = (event) => {
    const allValues = [];
    for (const element of registry) {
      if (selectAllName && getElementSelectionName(element) !== selectAllName) {
        continue;
      }
      const value = getElementValue(element);
      allValues.push(value);
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
    multiple,
    get value() {
      return getCurrentValue();
    },
    registry,
    get anchorElement() {
      return anchorElement;
    },
    get activeElement() {
      return activeElement;
    },
    channels: {
      change,
    },
    update,
    useSelection: () => {
      const [selection, setSelection] = useState(baseSelection.value);
      useLayoutEffect(() => {
        setSelection(baseSelection.value);

        const unsubscribe = change.add((newSelection) => {
          setSelection(newSelection);
        });

        return unsubscribe;
      }, [baseSelection]);
      return selection;
    },

    registerElement,
    unregisterElement,
    setAnchorElement,
    setActiveElement,
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
const createGridSelection = ({ ...options }) => {
  const registry = new Set();
  const navigationMethods = {
    getElementRange: (fromElement, toElement) => {
      const fromPos = getElementPosition(fromElement);
      const toPos = getElementPosition(toElement);

      if (!fromPos || !toPos) {
        return [];
      }

      // Check selection types to ensure we only select compatible elements
      const fromSelectionName = getElementSelectionName(fromElement);
      const toSelectionName = getElementSelectionName(toElement);

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
          const elementSelectionName = getElementSelectionName(element);
          // Only include elements with matching selection type
          if (
            elementSelectionName === fromSelectionName &&
            elementSelectionName === toSelectionName
          ) {
            valuesInRange.push(getElementValue(element));
          }
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
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName =
          getElementSelectionName(candidateElement);

        if (pos && pos.x === nextX && pos.y === y) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },

    getElementBefore: (element) => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }

      const { x, y } = currentPos;
      const prevX = x - 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName =
          getElementSelectionName(candidateElement);

        if (pos && pos.x === prevX && pos.y === y) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },

    getElementBelow: (element) => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }

      const { x, y } = currentPos;
      const nextY = y + 1;
      const currentSelectionName = getElementSelectionName(element);

      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName =
          getElementSelectionName(candidateElement);

        if (pos && pos.x === x && pos.y === nextY) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },

    getElementAbove: (element) => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }

      const { x, y } = currentPos;
      const prevY = y - 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName =
          getElementSelectionName(candidateElement);

        if (pos && pos.x === x && pos.y === prevY) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },
  };
  const gridSelection = createBaseSelection({
    ...options,
    registry,
    type: "grid",
    navigationMethods,
  });

  return gridSelection;
};
// Linear Selection Provider - for 1D layouts like lists
const createLinearSelection = ({
  axis = "vertical", // "horizontal" or "vertical"
  elementRef, // Root element to scope DOM traversal
  ...options
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

      // Check selection types to ensure we only select compatible elements
      const fromSelectionName = getElementSelectionName(fromElement);
      const toSelectionName = getElementSelectionName(toElement);

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
          const elementSelectionName = getElementSelectionName(element);

          // Only include elements with matching selection type
          if (
            elementSelectionName === fromSelectionName &&
            elementSelectionName === toSelectionName
          ) {
            valuesInRange.push(getElementValue(element));
          }
        }
      }

      return valuesInRange;
    },
    getElementAfter: (element) => {
      if (!registry.has(element)) {
        return null;
      }

      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;

      const sameTypeElement = findAfter(
        element,
        (candidate) => {
          if (!registry.has(candidate)) {
            return false;
          }
          const candidateSelectionName = getElementSelectionName(candidate);
          // If same selection name, this is our preferred result
          if (candidateSelectionName === currentSelectionName) {
            return true;
          }
          // Different selection name - store as fallback but keep searching
          if (!fallbackElement) {
            fallbackElement = candidate;
          }
          return false;
        },
        {
          root: elementRef.current || document.body,
        },
      );

      return sameTypeElement || fallbackElement;
    },
    getElementBefore: (element) => {
      if (!registry.has(element)) {
        return null;
      }

      const currentSelectionName = getElementSelectionName(element);

      let fallbackElement = null;
      const sameTypeElement = findBefore(
        element,
        (candidate) => {
          if (!registry.has(candidate)) {
            return false;
          }
          const candidateSelectionName = getElementSelectionName(candidate);
          // If same selection name, this is our preferred result
          if (candidateSelectionName === currentSelectionName) {
            return true;
          }
          // Different selection name - store as fallback but keep searching
          if (!fallbackElement) {
            fallbackElement = candidate;
          }
          return false;
        },
        {
          root: elementRef.current || document.body,
        },
      );

      return sameTypeElement || fallbackElement;
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
    ...options,
    registry,
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
const getElementSelectionName = (element) => {
  return element.getAttribute("data-selection-name");
};

// Helper functions to find end elements for jump to end functionality
const getJumpToEndElement = (selection, element, keydownEvent) => {
  if (selection.type === "grid") {
    return getJumpToEndElementGrid(selection, element, keydownEvent);
  } else if (selection.type === "linear") {
    return getJumpToEndElementLinear(selection, element, keydownEvent);
  }
  return null;
};
const getJumpToEndElementGrid = (selection, element, keydownEvent) => {
  const currentPos = getElementPosition(element);
  if (!currentPos) {
    return null;
  }
  const { key } = keydownEvent;

  const { x, y } = currentPos;
  const currentSelectionName = getElementSelectionName(element);

  if (key === "ArrowRight") {
    // Jump to last element in current row with matching selection name
    let lastInRow = null;
    let fallbackElement = null;
    let maxX = -1;
    let fallbackMaxX = -1;

    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);

      if (pos && pos.y === y) {
        if (candidateSelectionName === currentSelectionName && pos.x > maxX) {
          maxX = pos.x;
          lastInRow = candidateElement;
        } else if (
          candidateSelectionName !== currentSelectionName &&
          pos.x > fallbackMaxX
        ) {
          fallbackMaxX = pos.x;
          fallbackElement = candidateElement;
        }
      }
    }
    return lastInRow || fallbackElement;
  }

  if (key === "ArrowLeft") {
    // Jump to first element in current row with matching selection name
    let firstInRow = null;
    let fallbackElement = null;
    let minX = Infinity;
    let fallbackMinX = Infinity;

    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);

      if (pos && pos.y === y) {
        if (candidateSelectionName === currentSelectionName && pos.x < minX) {
          minX = pos.x;
          firstInRow = candidateElement;
        } else if (
          candidateSelectionName !== currentSelectionName &&
          pos.x < fallbackMinX
        ) {
          fallbackMinX = pos.x;
          fallbackElement = candidateElement;
        }
      }
    }
    return firstInRow || fallbackElement;
  }

  if (key === "ArrowDown") {
    // Jump to last element in current column with matching selection name
    let lastInColumn = null;
    let fallbackElement = null;
    let maxY = -1;
    let fallbackMaxY = -1;

    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);

      if (pos && pos.x === x) {
        if (candidateSelectionName === currentSelectionName && pos.y > maxY) {
          maxY = pos.y;
          lastInColumn = candidateElement;
        } else if (
          candidateSelectionName !== currentSelectionName &&
          pos.y > fallbackMaxY
        ) {
          fallbackMaxY = pos.y;
          fallbackElement = candidateElement;
        }
      }
    }
    return lastInColumn || fallbackElement;
  }

  if (key === "ArrowUp") {
    // Jump to first element in current column with matching selection name
    let firstInColumn = null;
    let fallbackElement = null;
    let minY = Infinity;
    let fallbackMinY = Infinity;

    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);

      if (pos && pos.x === x) {
        if (candidateSelectionName === currentSelectionName && pos.y < minY) {
          minY = pos.y;
          firstInColumn = candidateElement;
        } else if (
          candidateSelectionName !== currentSelectionName &&
          pos.y < fallbackMinY
        ) {
          fallbackMinY = pos.y;
          fallbackElement = candidateElement;
        }
      }
    }
    return firstInColumn || fallbackElement;
  }

  return null;
};
const getJumpToEndElementLinear = (selection, element, direction) => {
  const currentSelectionName = getElementSelectionName(element);

  if (direction === "ArrowDown" || direction === "ArrowRight") {
    // Jump to last element in the registry with matching selection name
    let lastElement = null;
    let fallbackElement = null;

    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);

      if (candidateSelectionName === currentSelectionName) {
        if (
          !lastElement ||
          candidateElement.compareDocumentPosition(lastElement) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          lastElement = candidateElement;
        }
      } else if (!fallbackElement) {
        if (
          !fallbackElement ||
          candidateElement.compareDocumentPosition(fallbackElement) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          fallbackElement = candidateElement;
        }
      }
    }
    return lastElement || fallbackElement;
  }

  if (direction === "ArrowUp" || direction === "ArrowLeft") {
    // Jump to first element in the registry with matching selection name
    let firstElement = null;
    let fallbackElement = null;

    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);

      if (candidateSelectionName === currentSelectionName) {
        if (
          !firstElement ||
          firstElement.compareDocumentPosition(candidateElement) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          firstElement = candidateElement;
        }
      } else if (!fallbackElement) {
        if (
          !fallbackElement ||
          fallbackElement.compareDocumentPosition(candidateElement) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ) {
          fallbackElement = candidateElement;
        }
      }
    }
    return firstElement || fallbackElement;
  }

  return null;
};

// Helper function for grid positioning (moved here from createGridSelection)
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

export const useSelectableElement = (
  elementRef,
  { selectionController, selectionImpact },
) => {
  if (!selectionController) {
    throw new Error("useSelectableElement needs a selectionController");
  }

  const selection = selectionController.useSelection();

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const value = getElementValue(element);
    const selectionName = getElementSelectionName(element);
    debug(
      "registration",
      "useSelectableElement: registering element:",
      element,
      "value:",
      value,
      "selectionName:",
      selectionName,
    );

    selectionController.registerElement(element, { selectionImpact });
    element.setAttribute("data-selectable", "");
    return () => {
      debug(
        "registration",
        "useSelectableElement: unregistering element:",
        element,
        "value:",
        value,
      );
      selectionController.unregisterElement(element);
      element.removeAttribute("data-selectable");
    };
  }, [selectionController, selectionImpact]);

  const [selected, setSelected] = useState(false);
  debug("selection", "useSelectableElement: initial selected state:", selected);

  // Update selected state when selection value changes
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      debug(
        "selection",
        "useSelectableElement: no element, setting selected to false",
      );
      setSelected(false);
      return;
    }
    // Use selection values directly for better performance
    const elementValue = getElementValue(element);
    const isSelected = selection.includes(elementValue);
    debug(
      "selection",
      "useSelectableElement: updating selected state",
      element,
      "isSelected:",
      isSelected,
    );
    setSelected(isSelected);
  }, [selection]);

  // Add event listeners directly to the element
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    let isDragging = false;
    let dragStartElement = null;
    let cleanup = () => {};

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
        currentSelection: selectionController.value,
      });

      // Handle immediate selection based on modifier keys
      if (isSingleSelect) {
        // Single select - replace entire selection with just this item
        debug(
          "interaction",
          "mousedown: single select, setting selection to:",
          [value],
        );
        selectionController.setSelection([value], e);
      } else if (isMultiSelect && !isShiftSelect) {
        // Multi select without shift - toggle element
        debug("interaction", "mousedown: multi select, toggling element");
        selectionController.toggleElement(element, e);
      } else if (isShiftSelect) {
        e.preventDefault(); // Prevent navigation
        debug(
          "interaction",
          "mousedown: shift select, selecting from anchor to element",
        );
        selectionController.selectFromAnchorTo(element, e);
      }

      if (!selectionController.dragToSelect) {
        return;
      }

      // Set up for potential drag selection (now works with all modifier combinations)
      dragStartElement = element;
      isDragging = false; // Will be set to true if mouse moves beyond threshold

      // Store initial mouse position for drag threshold
      const startX = e.clientX;
      const startY = e.clientY;
      const dragThreshold = 5; // pixels

      const handleMouseMove = (e) => {
        if (!dragStartElement) {
          return;
        }

        if (!isDragging) {
          // Check if we've exceeded the drag threshold
          const deltaX = Math.abs(e.clientX - startX);
          const deltaY = Math.abs(e.clientY - startY);
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          if (distance < dragThreshold) {
            return; // Don't start dragging yet
          }

          isDragging = true;
          // mark it as drag-selecting
          selectionController.element.setAttribute("data-drag-selecting", "");
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
        while (true) {
          if (selectionController.registry.has(targetElement)) {
            break;
          }
          if (
            targetElement.hasAttribute("data-value") ||
            targetElement.hasAttribute("aria-selected")
          ) {
            break;
          }
          targetElement = targetElement.parentElement;
          if (!targetElement) {
            return;
          }
        }
        if (!selectionController.registry.has(targetElement)) {
          return;
        }
        // Check if we're mixing selection types (like row and cell selections)
        const dragStartSelectionName =
          getElementSelectionName(dragStartElement);
        const targetSelectionName = getElementSelectionName(targetElement);
        // Only allow drag between elements of the same selection type
        if (dragStartSelectionName !== targetSelectionName) {
          debug("interaction", "drag select: skipping mixed selection types", {
            dragStartSelectionName,
            targetSelectionName,
          });
          return;
        }

        // Get the range from anchor to current target
        const rangeValues = selectionController.getElementRange(
          dragStartElement,
          targetElement,
        );

        // Handle different drag behaviors based on modifier keys
        const isShiftSelect = e.shiftKey;
        const isMultiSelect = e.metaKey || e.ctrlKey;

        if (isShiftSelect) {
          // For shift drag, use selectFromAnchorTo behavior (replace selection with range from anchor)
          debug(
            "interaction",
            "shift drag select: selecting from anchor to target",
            rangeValues,
          );
          selectionController.selectFromAnchorTo(targetElement, e);
          return;
        }
        if (isMultiSelect) {
          // For multi-select drag, add to existing selection
          debug(
            "interaction",
            "multi-select drag: adding range to selection",
            rangeValues,
          );
          const currentSelection = [...selectionController.value];
          const newSelection = [
            ...new Set([...currentSelection, ...rangeValues]),
          ];
          selectionController.setSelection(newSelection, e);
          return;
        }
        // For normal drag, replace selection
        debug(
          "interaction",
          "drag select: setting selection to range",
          rangeValues,
        );
        selectionController.setSelection(rangeValues, e);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Remove drag-selecting state from table
        if (isDragging) {
          selectionController.element.removeAttribute("data-drag-selecting");
        }

        // Reset drag state
        dragStartElement = null;
        isDragging = false;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      cleanup = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    };

    element.addEventListener("mousedown", handleMouseDown);
    return () => {
      element.removeEventListener("mousedown", handleMouseDown);
      cleanup();
    };
  }, [selectionController]);

  return {
    selected,
  };
};

// Helper function to handle cross-type navigation
const handleCrossTypeNavigation = (
  currentElement,
  targetElement,
  isMultiSelect,
) => {
  const currentSelectionName = getElementSelectionName(currentElement);
  const targetSelectionName = getElementSelectionName(targetElement);

  // Check if we're switching between different selection types
  if (currentSelectionName !== targetSelectionName) {
    debug(
      "navigation",
      "Cross-type navigation detected:",
      currentSelectionName,
      "->",
      targetSelectionName,
    );

    // Return info about cross-type navigation for caller to handle
    return {
      isCrossType: true,
      shouldClearPreviousSelection: !isMultiSelect,
    };
  }

  return {
    isCrossType: false,
    shouldClearPreviousSelection: false,
  };
};

export const createSelectionKeyboardShortcuts = (
  selectionController,
  { toggleEnabled, toggleKey = "space" } = {},
) => {
  const getSelectableElement = (keydownEvent) => {
    return keydownEvent.target.closest("[data-selectable]");
  };
  const moveSelection = (keyboardEvent, getElementToSelect) => {
    const selectableElement = getSelectableElement(keyboardEvent);
    const elementToSelect = getElementToSelect(
      selectableElement,
      keyboardEvent,
    );

    if (!elementToSelect) {
      return false;
    }

    const { key } = keyboardEvent;
    const isMetaOrCtrlPressed = keyboardEvent.metaKey || keyboardEvent.ctrlKey;
    const isShiftSelect = keyboardEvent.shiftKey;
    const isMultiSelect = isMetaOrCtrlPressed && isShiftSelect; // Only add to selection when BOTH are pressed
    const targetValue = getElementValue(elementToSelect);
    const { isCrossType, shouldClearPreviousSelection } =
      handleCrossTypeNavigation(
        selectableElement,
        elementToSelect,
        isMultiSelect,
      );

    if (isShiftSelect) {
      debug(
        "interaction",
        `keydownToSelect: ${key} with Shift - selecting from anchor to target element`,
      );
      selectionController.setActiveElement(elementToSelect);
      selectionController.selectFromAnchorTo(elementToSelect, keyboardEvent);
      return true;
    }
    if (isMultiSelect && !isCrossType) {
      debug(
        "interaction",
        `keydownToSelect: ${key} with multi-select - adding to selection`,
      );
      selectionController.addToSelection([targetValue], keyboardEvent);
      return true;
    }
    // Handle cross-type navigation
    if (shouldClearPreviousSelection) {
      debug(
        "interaction",
        `keydownToSelect: ${key} - cross-type navigation, clearing and setting new selection`,
      );
      selectionController.setSelection([targetValue], keyboardEvent);
      return true;
    }
    if (isCrossType && !shouldClearPreviousSelection) {
      debug(
        "interaction",
        `keydownToSelect: ${key} - cross-type navigation with Cmd, adding to selection`,
      );
      selectionController.addToSelection([targetValue], keyboardEvent);
      return true;
    }
    debug(
      "interaction",
      `keydownToSelect: ${key} - setting selection to target element`,
    );
    selectionController.setSelection([targetValue], keyboardEvent);
    return true;
  };

  return [
    {
      description: "Add element above to selection",
      key: "command+shift+up",
      enabled: selectionController.axis !== "horizontal",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, getJumpToEndElement);
      },
    },
    {
      description: "Select element above",
      key: "up",
      enabled: selectionController.axis !== "horizontal",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, (selectableElement) =>
          selectionController.getElementAbove(selectableElement),
        );
      },
    },
    {
      description: "Add element below to selection",
      key: "command+shift+down",
      enabled: selectionController.axis !== "horizontal",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, getJumpToEndElement);
      },
    },
    {
      description: "Select element below",
      key: "down",
      enabled: selectionController.axis !== "horizontal",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, (selectableElement) => {
          return selectionController.getElementBelow(selectableElement);
        });
      },
    },
    {
      description: "Add left element to selection",
      key: "command+shift+left",
      enabled: selectionController.axis !== "horizontal",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, getJumpToEndElement);
      },
    },
    {
      description: "Select left element",
      key: "left",
      enabled: selectionController.axis !== "vertical",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, (selectableElement) => {
          return selectionController.getElementBefore(selectableElement);
        });
      },
    },
    {
      description: "Add right element to selection",
      key: "command+shift+right",
      enabled: selectionController.axis !== "vertical",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, getJumpToEndElement);
      },
    },
    {
      description: "Select right element",
      key: "right",
      enabled: selectionController.axis !== "vertical",
      handler: (keyboardEvent) => {
        return moveSelection(keyboardEvent, (selectableElement) => {
          return selectionController.getElementAfter(selectableElement);
        });
      },
    },
    {
      description: "Set element as anchor for shift selections",
      key: "shift",
      handler: (keyboardEvent) => {
        const element = getSelectableElement(keyboardEvent);
        selectionController.setAnchorElement(element);
        return true;
      },
    },
    {
      description: "Select all",
      key: "command+a",
      handler: (keyboardEvent) => {
        selectionController.selectAll(keyboardEvent);
        return true;
      },
    },
    {
      description: "Toggle element selected state",
      enabled: (keyboardEvent) => {
        if (!toggleEnabled) {
          return false;
        }
        const elementWithToggleShortcut = keyboardEvent.target.closest(
          "[data-selection-keyboard-toggle]",
        );
        return Boolean(elementWithToggleShortcut);
      },
      key: toggleKey,
      handler: (keyboardEvent) => {
        const element = getSelectableElement(keyboardEvent);
        const elementValue = getElementValue(element);
        const isCurrentlySelected =
          selectionController.isElementSelected(element);
        if (isCurrentlySelected) {
          selectionController.removeFromSelection(
            [elementValue],
            keyboardEvent,
          );
          return true;
        }
        selectionController.addToSelection([elementValue], keyboardEvent);
        return true;
      },
    },
  ];
};
