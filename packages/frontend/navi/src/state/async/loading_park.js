import { createContext } from "preact";

/*
 * Whether a <Loading> has parked what it holds. A delegated wait below it
 * suspended, and preact/compat took the subtree out of the document: its
 * components stay alive with their hooks, their effects are all cleaned up and
 * run again at the reveal (detachedClone in preact/compat's suspense.js). What
 * lives in the layout does not come back with them — a scroll box returns at
 * its start, the document clamps to the fallback.
 *
 * A component cannot tell a park from a leave from inside an effect cleanup:
 * both run it. What it measures while parked is measured out of the document,
 * so this is where it asks whether it is.
 *
 * Parked from the commit that shows the boundary's fallback to the one that
 * takes the fallback down — the reveal takes it down before the subtree renders
 * again. The park starts after the cleanups it runs: a cleanup asking now hears
 * "no". A boundary under a parked one is parked with it.
 */
export const LoadingParkContext = createContext(null);

export const createLoadingPark = (parentPark) => {
  let parked = false;
  return {
    isParked: () => parked || (parentPark !== null && parentPark.isParked()),
    park: () => {
      parked = true;
    },
    reveal: () => {
      parked = false;
    },
  };
};
