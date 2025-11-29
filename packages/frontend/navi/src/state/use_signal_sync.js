import { useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

/**
 * Creates a signal that stays synchronized with an external value,
 * only updating the signal when the value actually changes.
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
 */

export const useSignalSync = (value, initialValue = value) => {
  const signal = useSignal(initialValue);
  const previousValueRef = useRef(value);

  // Only update signal when external value actually changes
  // This preserves user input between external changes
  if (previousValueRef.current !== value) {
    previousValueRef.current = value;
    signal.value = value; // Model takes precedence
  }

  return signal;
};
