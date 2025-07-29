import { effect } from "@preact/signals";

/**
 * Creates an effect that uses WeakRef to prevent garbage collection of referenced values.
 *
 * This utility is useful when you want to create reactive effects that watch objects
 * without preventing those objects from being garbage collected. If any of the referenced
 * values is collected, the effect automatically disposes itself.
 *
 * @param {Array} values - Array of values to create weak references for
 * @param {Function} callback - Function to call when the effect runs, receives dereferenced values as arguments
 * @returns {Function} dispose - Function to manually dispose the effect
 *
 * @example
 * ```js
 * const objectA = { name: "A" };
 * const objectB = { name: "B" };
 * const prefixSignal = signal('demo');
 *
 * const dispose = weakEffect([objectA, objectB], (a, b) => {
 *   const prefix = prefixSignal.value
 *   console.log(prefix, a.name, b.name);
 * });
 *
 * // Effect will auto-dispose if objectA or objectB where garbage collected
 * // or can be manually disposed:
 * dispose();
 * ```
 */
export const weakEffect = (values, callback) => {
  const weakRefSet = new Set();
  for (const value of values) {
    weakRefSet.add(new WeakRef(value));
  }
  const dispose = effect(() => {
    const values = [];
    for (const weakRef of weakRefSet) {
      const value = weakRef.deref();
      if (value === undefined) {
        dispose();
        return;
      }
      values.push(value);
    }
    callback(...values);
  });
  return dispose;
};
