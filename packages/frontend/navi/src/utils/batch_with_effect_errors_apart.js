import { batch } from "@preact/signals";

/**
 * Runs `write` in one batch, where an effect it wakes up that throws is not
 * the writer's failure.
 *
 * At the end of the outermost batch preact runs the effects its writes woke
 * up, anywhere in the app, and rethrows the first one that threw to whoever
 * closed the batch: from there it would stop the writer half way — a run left
 * RUNNING, a navigation whose routes changed but whose page never landed. That
 * throw is the effect's, so it is reported on its own, as an error thrown from
 * a timer is, and the writer carries on. What `write` throws is the writer's,
 * and goes on.
 *
 * @param {() => void} write
 */
export const batchWithEffectErrorsApart = (write) => {
  let writeThrew = false;
  let writeError;
  try {
    batch(() => {
      try {
        write();
      } catch (e) {
        writeThrew = true;
        writeError = e;
      }
    });
  } catch (effectError) {
    setTimeout(() => {
      throw effectError;
    });
  }
  if (writeThrew) {
    throw writeError;
  }
};
