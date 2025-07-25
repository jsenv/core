import { createContext } from "preact";
import { useContext } from "preact/hooks";

const SelectionContext = createContext(null);

export const Selection = ({ value, onChange, children }) => {
  const contextValue = {
    selectedValues: new Set(value || []),
    onSelectionChange: (
      checked,
      { value: itemValue, shiftKey, metaKey, ctrlKey },
    ) => {
      const newSelection = new Set(value || []);

      const isMultiSelect = metaKey || ctrlKey;
      const isShiftSelect = shiftKey;
      const isSingleSelect = !isMultiSelect && !isShiftSelect;

      if (isSingleSelect) {
        // Single select - only this item
        newSelection.clear();
        if (checked) {
          newSelection.add(itemValue);
        }
      } else if (isMultiSelect) {
        // Multi-select - toggle this item
        if (checked) {
          newSelection.add(itemValue);
        } else {
          newSelection.delete(itemValue);
        }
      } else if (isShiftSelect) {
        // Range select - would need additional context for range logic
        // For now, just add this item
        newSelection.add(itemValue);
      }

      onChange?.(Array.from(newSelection));
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
