import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

const SelectionContext = createContext(null);

export const Selection = ({ value = [], onChange, children }) => {
  const selection = value || [];
  const registryRef = useRef([]); // Array<value>
  const lastSelectedValueRef = useRef(
    selection.length > 0 ? selection[selection.length - 1] : null,
  );

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
    getAllItems: () => {
      return registryRef.current;
    },

    isSelected: (itemValue) => {
      return selection.includes(itemValue);
    },

    // basic methods to manipulate selection
    set: (newSelection, event = null) => {
      if (
        newSelection.length === selection.length &&
        newSelection.every((value, index) => value === selection[index])
      ) {
        return;
      }
      // Update the last selected value to the last item in the new selection
      if (newSelection.length > 0) {
        lastSelectedValueRef.current = newSelection[newSelection.length - 1];
      } else {
        lastSelectedValueRef.current = null;
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
        lastSelectedValueRef.current = valueToAdd;
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
          if (value === lastSelectedValueRef.current) {
            lastSelectedValueRef.current = null;
          }
        } else {
          selectionWithoutValues.push(value);
        }
      }

      // If we cleared the last selected value but still have items selected,
      // set the last selected to the last remaining item
      if (
        modified &&
        lastSelectedValueRef.current === null &&
        selectionWithoutValues.length > 0
      ) {
        lastSelectedValueRef.current =
          selectionWithoutValues[selectionWithoutValues.length - 1];
      }

      if (modified) {
        onChange?.(selectionWithoutValues, event);
      }
    },
    addRange: (fromValue, toValue, event = null) => {
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
        const valuesToSelect = registry.slice(start, end + 1);

        contextValue.add(valuesToSelect, event);
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
    addFromLastSelectedTo: (value, event = null) => {
      const lastSelectedValue = lastSelectedValueRef.current;

      // Make sure the last selected value is still in the current selection
      if (lastSelectedValue && selection.includes(lastSelectedValue)) {
        contextValue.addRange(lastSelectedValue, value, event);
      } else {
        // No valid previous selection, just select this one
        contextValue.add([value], event);
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
