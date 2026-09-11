/**
 * Reads of the layout gathered across effects, so that the browser brings its
 * styles and layout up to date once for all of them rather than once per
 * element.
 *
 * A layout effect that reads (a computed style, a rect) and then writes (an
 * attribute, a style) is fine on its own. A hundred of them in one commit are
 * not: every write dirties the tree, and the next element's read forces the
 * browser to recompute it — a style recalculation per element, each one over
 * everything dirtied since the last. Most of a long mount's time goes there,
 * not in the effects themselves.
 *
 * So an effect hands its read over instead of running it. Reads run together
 * in a microtask — still before the paint, so nothing shows uncorrected — and
 * each returns the write that depends on it, run after every read of the
 * round. A write that needs to read again returns that read: it joins the next
 * round, reads first, writes after, and so on until nothing is left.
 *
 * The cancel returned is for an element unmounted before its round: a write
 * on a node that is gone is at best wasted.
 *
 * @param {() => (undefined | (() => undefined | Function))} read
 * @returns {() => void} cancel
 */
export const scheduleLayoutRead = (read) => {
  const entry = { read, cancelled: false };
  round.push(entry);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flush);
  }
  return () => {
    entry.cancelled = true;
  };
};

let round = [];
let flushScheduled = false;

const flush = () => {
  flushScheduled = false;
  while (round.length > 0) {
    const entries = round;
    round = [];
    const writes = [];
    for (const entry of entries) {
      if (entry.cancelled) {
        continue;
      }
      const write = entry.read();
      if (typeof write === "function") {
        writes.push({ entry, write });
      }
    }
    for (const { entry, write } of writes) {
      if (entry.cancelled) {
        continue;
      }
      const readAgain = write();
      if (typeof readAgain === "function") {
        entry.read = readAgain;
        round.push(entry);
      }
    }
  }
};
