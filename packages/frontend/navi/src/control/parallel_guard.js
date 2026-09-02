import { signal } from "@preact/signals";
import { createContext } from "preact";
import { useRef } from "preact/hooks";

/**
 * How many runs a surface lets happen at once.
 *
 * A list whose rows each carry their own action is a place to act, row by row,
 * and nothing about it stops someone from starting a run on every row before
 * any of them comes back: a dozen requests in flight, a dozen rows waiting, and
 * a server asked to do a dozen things at once because a list happened to be
 * long. The guard is what makes the surface say "not yet" instead — the rows
 * that are not running go read-only and say what they are waiting for, and the
 * next press is possible again the moment one of the runs comes back.
 *
 * It counts runs, not values — which is what separates it from
 * `maxLengthGuard`, the one that says how many things a selection may HOLD.
 * Both refuse a gesture; they refuse it for unrelated reasons and a surface can
 * carry either, or both.
 */
export const ParallelGuardContext = createContext(null);

/**
 * @param {number} max - how many runs may be in flight at once. `Infinity`
 *   lifts the guard without taking it out of the tree.
 */
export const useParallelGuard = (max) => {
  const guardRef = useRef(null);
  if (!guardRef.current) {
    // A Set rather than a counter: a control asks about ITSELF (its own run is
    // never what blocks it), and a start that arrives twice for one run must
    // not be counted twice.
    const runningSet = new Set();
    const runningCountSignal = signal(0);
    const guard = {
      max,
      runningCountSignal,
      claim: (controller) => {
        if (runningSet.has(controller)) {
          return;
        }
        runningSet.add(controller);
        runningCountSignal.value = runningSet.size;
      },
      release: (controller) => {
        if (!runningSet.delete(controller)) {
          return;
        }
        runningCountSignal.value = runningSet.size;
      },
      blocks: (controller) => {
        if (guard.max === Infinity) {
          return false;
        }
        if (runningSet.has(controller)) {
          return false;
        }
        // Read through the signal so a control held back re-renders — and
        // becomes pressable again — the moment one of the runs comes back.
        return runningCountSignal.value >= guard.max;
      },
    };
    guardRef.current = guard;
  }
  guardRef.current.max = max;
  return guardRef.current;
};
