import { createContext } from "preact";
import { useContext } from "preact/hooks";

const SelectionContext = createContext(null);

export const Selection = ({ value = [], onChange, children }) => {
  const selection = value || [];

  const contextValue = {
    selection,

    add: (...arrayOfValueToAddToSelection) => {
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
        onChange?.(selectionWithValues);
      }
    },

    remove: (...arrayOfValueToRemoveFromSelection) => {
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
        onChange?.(selectionWithoutValues);
      }
    },

    isSelected: (itemValue) => {
      return (value || []).includes(itemValue);
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
