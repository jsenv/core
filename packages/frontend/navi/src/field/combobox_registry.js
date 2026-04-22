/**
 * Module-level registry that links an OptionList (popover) to an InputTextual (combobox).
 * OptionList registers a controller keyed by its id.
 * InputTextual reads that controller to drive navigation and selection.
 *
 * Controller shape:
 *   {
 *     navigate: (direction: "up"|"down"|"first"|"last") => void,
 *     selectHighlighted: () => boolean,
 *     clearHighlight: () => void,
 *     onSelectRef: { current: ((value: any) => void) | null },
 *   }
 */

const controllers = new Map();

export const registerComboboxController = (id, controller) => {
  controllers.set(id, controller);
  return () => {
    controllers.delete(id);
  };
};

export const getComboboxController = (id) => {
  return controllers.get(id);
};
