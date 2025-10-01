/**
 * Custom hook creating a stable callback that doesn't trigger re-renders.
 *
 * PROBLEM: Parent components often forget to use useCallback, causing library
 * components to re-render unnecessarily when receiving callback props.
 *
 * SOLUTION: Library components can use this hook to create stable callback
 * references internally, making them defensive against parents who don't
 * optimize their callbacks. This ensures library components don't force
 * consumers to think about useCallback.
 *
 * USAGE:
 * ```js
 * // Parent component (consumer) - no useCallback needed
 * const Parent = () => {
 *   const [count, setCount] = useState(0);
 *
 *   // Parent naturally creates new function reference each render
 *   // (forgetting useCallback is common and shouldn't break performance)
 *   return <LibraryButton onClick={(e) => setCount(count + 1)} />;
 * };
 *
 * // Library component - defensive against changing callbacks
 * const LibraryButton = ({ onClick }) => {
 *   // ✅ Create stable reference from parent's potentially changing callback
 *   const stableClick = useStableCallback(onClick);
 *
 *   // Internal expensive components won't re-render when parent updates
 *   return <ExpensiveInternalButton onClick={stableClick} />;
 * };
 *
 * // Deep internal component gets stable reference
 * const ExpensiveInternalButton = memo(({ onClick }) => {
 *   // This won't re-render when Parent's count changes
 *   // But onClick will always call the latest Parent callback
 *   return <button onClick={onClick}>Click me</button>;
 * });
 * ```
 *
 * Perfect for library components that need performance without burdening consumers.
 */

import { useRef } from "preact/hooks";

export const useStableCallback = (callback) => {
  const callbackRef = useRef();
  callbackRef.current = callback;

  const stableCallbackRef = useRef();
  const existingStableCallback = stableCallbackRef.current;
  if (existingStableCallback) {
    return existingStableCallback;
  }
  const stableCallback = (...args) => {
    return callbackRef.current?.(...args);
  };
  stableCallbackRef.current = stableCallback;
  return stableCallback;
};
