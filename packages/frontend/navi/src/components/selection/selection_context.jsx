import { createContext } from "preact";
import { useContext, useRef } from "preact/hooks";

const SelectionContext = createContext(null);

export const Selection = ({ value = [], onChange, children }) => {
  const selection = value || [];
  const registryRef = useRef([]); // Array<{ value }>

  const contextValue = {
    selection,

    // Registry methods for tracking selectable items
    register: (value) => {
      const registry = registryRef.current;
      const existingIndex = registry.findIndex((item) => item.value === value);
      if (existingIndex >= 0) {
        // Item already exists, no need to update
        return;
      }
      registry.push({ value });
    },

    unregister: (value) => {
      const registry = registryRef.current;
      const index = registry.findIndex((item) => item.value === value);
      if (index >= 0) {
        registry.splice(index, 1);
      }
    },

    getAllItems: () => {
      return registryRef.current;
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

    addRange: (fromValue, toValue, event = null) => {
      const registry = registryRef.current;

      // Find indices of fromValue and toValue
      let fromIndex = -1;
      let toIndex = -1;

      registry.forEach((item, index) => {
        if (item.value === fromValue) {
          fromIndex = index;
        }
        if (item.value === toValue) {
          toIndex = index;
        }
      });

      if (fromIndex >= 0 && toIndex >= 0) {
        // Select all items between fromIndex and toIndex (inclusive)
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);

        const valuesToSelect = [];
        for (let i = start; i <= end; i++) {
          if (registry[i] && registry[i].value) {
            valuesToSelect.push(registry[i].value);
          }
        }

        contextValue.add(valuesToSelect, event);
      }
    }, // Helper method to find the last selected item (useful for shift-click)
    getLastSelectedValue: (excludeValue) => {
      const registry = registryRef.current;
      let lastSelected = null;

      registry.forEach((item) => {
        if (item.value !== excludeValue && selection.includes(item.value)) {
          lastSelected = item.value;
        }
      });

      return lastSelected;
    },

    // Convenience method for shift-click: add range from last selected to target value
    addFromLastSelectedTo: (value, event = null) => {
      const lastSelectedValue = contextValue.getLastSelectedValue(value);

      if (lastSelectedValue) {
        contextValue.addRange(lastSelectedValue, value, event);
      } else {
        // No previous selection, just select this one
        contextValue.add([value], event);
      }
    },

    // Convenience method for multi-select: toggle selection state
    toggle: (value, event = null) => {
      if (selection.includes(value)) {
        contextValue.remove([value], event);
      } else {
        contextValue.add([value], event);
      }
    },
    remove: (arrayOfValueToRemoveFromSelection, event = null) => {
      let modified = false;
      const selectionWithoutValues = [];
      for (const value of selection) {
        if (arrayOfValueToRemoveFromSelection.includes(value)) {
          modified = true;
        } else {
          selectionWithoutValues.push(value);
        }
      }

      if (modified) {
        onChange?.(selectionWithoutValues, event);
      }
    },

    set: (newSelection, event = null) => {
      onChange?.(newSelection, event);
    },

    isSelected: (itemValue) => {
      return selection.includes(itemValue);
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
