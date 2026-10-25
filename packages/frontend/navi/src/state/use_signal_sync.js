import { useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

/**
 * Creates a signal that stays synchronized with an external value,
 * only updating the signal when the value actually changes — compared by
 * content, so a record read again as a new but equal object or array is not a
 * change and leaves what is being typed alone.
 *
 * This hook solves a common reactive UI pattern where:
 * 1. A signal controls a UI element (like an input field)
 * 2. The UI element can be modified by user interaction
 * 3. When the external "source of truth" changes, it should take precedence
 *
 * @param {any} value - The external value to sync with (the "source of truth")
 * @param {any} [initialValue] - Optional initial value for the signal (defaults to value)
 * @returns {Signal} A signal that tracks the external value but allows temporary local changes
 *
 * @example
 * const FileNameEditor = ({ file }) => {
 *   // Signal stays in sync with file.name, but allows user editing
 *   const nameSignal = useSignalSync(file.name);
 *
 *   return (
 *     <Editable
 *       valueSignal={nameSignal}  // User can edit this
 *       action={renameFileAction} // Saves changes
 *     />
 *   );
 * };
 *
 * // Scenario:
 * // 1. file.name = "doc.txt", nameSignal.value = "doc.txt"
 * // 2. User types "report" -> nameSignal.value = "report.txt"
 * // 3. External update: file.name = "shared-doc.txt"
 * // 4. Next render: nameSignal.value = "shared-doc.txt" (model wins!)
 *
 * The model winning costs something when the model is fed by what the control
 * saves: the answer of a write changes the value, the control walks to it and
 * tells its callback about that walk, and the callback saves again. With two
 * writes in flight that circle never closes — see
 * docs/state_binding.md#the-callback-also-fires-for-the-states-own-changes for
 * the three ways out.
 */

export const useSignalSync = (value, initialValue = value) => {
  const signal = useSignal(initialValue);
  const previousValueRef = useRef(value);

  // Only update signal when external value actually changes
  // This preserves user input between external changes
  const previousValue = previousValueRef.current;
  previousValueRef.current = value;
  if (!compareTwoJsValues(previousValue, value)) {
    signal.value = value; // Model takes precedence
  }

  return signal;
};
