/**
 * Custom hook creating a stable callback that doesn't trigger re-renders.
 *
 * PROBLEM: Callback functions create new references on every render, causing
 * unnecessary re-renders of child components and re-execution of effects.
 *
 * SOLUTION: Returns a callback with a stable reference that always calls
 * the latest version of your function, preventing cascade re-renders while
 * avoiding stale closures.
 *
 * USAGE:
 * ```js
 * // Parent component creates new callback on every render
 * const Parent = () => {
 *   const [count, setCount] = useState(0);
 *   
 *   // Parent naturally creates new function reference each render
 *   return <ExpensiveChild onClick={(e) => setCount(count + 1)} />;
 * };
 * 
 * // Child component uses useStableCallback to avoid re-renders
 * const ExpensiveChild = ({ onClick }) => {
 *   // ✅ Create stable reference from parent's changing callback
 *   const stableClick = useStableCallback(onClick);
 *   
 *   // Now internal components won't re-render when parent updates
 *   return <VeryExpensiveButton onClick={stableClick} />;
 * };
 * 
 * // Deep child gets stable reference, avoiding cascade re-renders
 * const VeryExpensiveButton = memo(({ onClick }) => {
 *   // This won't re-render when Parent's count changes
 *   // But onClick will always call the latest Parent callback
 *   return <button onClick={onClick}>Click me</button>;
 * });
 * ```
 *
 * Ideal for expensive child components, context providers, and effect dependencies.
 */

import { useRef } from "preact/hooks";

export const useStableCallback = (callback) => {
  const callbackRef = useRef();
  callbackRef.current = callback;

  const facadeCallbackRef = useRef();
  let facadeCallback = facadeCallbackRef.current;
  if (facadeCallback) {
    return facadeCallback;
  }
  facadeCallback = (...args) => {
    return callbackRef.current?.(...args);
  };
  facadeCallbackRef.current = facadeCallback;
  return facadeCallback;
};
