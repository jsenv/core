/*
 * Asking an action again on a timer, for what the server moves on its own (an
 * email that may bounce, an account linked in another app). Two doors share
 * these rules: `useAsyncData(action, { poll })`, for as long as a reader is
 * mounted, and `action.poll()`, for code that awaits the answer — a gesture
 * waiting for a link made in another app, after the sheet it came from closed.
 *
 * The ticks follow the action's own runs rather than a clock: the next one is
 * set when a run settles, so a slow answer never has a second request stacked
 * behind it, and a run someone else started counts as a tick. Reading the
 * document's visibility and the network policy at each tick is what keeps a
 * screen nobody looks at, or one that is offline, from talking. A failure ends
 * the poll: retrying it on a timer would retry it while the network is down,
 * which is rerun()'s job.
 */

import { COMPLETED, FAILED, RUNNING } from "./action_run_states.js";
import { peekNetworkPolicy } from "./network_policy.js";
import { runUnwatched } from "./run_unwatched.js";

/**
 * Follows `action` on the poll `readPoll()` describes, read again at each tick
 * so a reader's latest options count. Ends on its own when `until` accepts the
 * data ("until"), when `for` ran out ("for") or when a run fails ("failed"),
 * and calls `onEnd` with that reason; the function returned ends it silently.
 *
 * `askWhenUnanswered`: the poll asks an action that holds no answer (nobody ran
 * it, or its last run was called off) instead of waiting for someone else to.
 * `failureCarried`: whoever started the poll is handed a failure through
 * `onEnd`, so the run's own rejection is not reported as one nobody displays.
 */
export const startPolling = (
  action,
  readPoll,
  {
    askWhenUnanswered = false,
    failureCarried = false,
    onEnd = () => {},
    reason = "poll",
  } = {},
) => {
  const startedAt = Date.now();
  let timeout = null;
  let over = false;
  const stop = () => {
    if (over) {
      return;
    }
    over = true;
    clearTimeout(timeout);
    timeout = null;
    unsubscribeFromRunningState();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
  const end = (endReason) => {
    stop();
    onEnd(endReason);
  };
  const readDone = () => {
    const { until, for: duration } = readPoll();
    const data = action.dataSignal.peek();
    if (until && data !== undefined && until(data)) {
      return "until";
    }
    if (duration !== undefined && Date.now() - startedAt >= duration) {
      return "for";
    }
    return null;
  };
  const schedule = () => {
    clearTimeout(timeout);
    timeout = setTimeout(tick, readPoll().every);
  };
  const settle = () => {
    const doneReason = readDone();
    if (doneReason) {
      end(doneReason);
      return;
    }
    schedule();
  };
  const tick = () => {
    timeout = null;
    if (over) {
      return;
    }
    if (document.visibilityState !== "visible") {
      // Taken back by visibilitychange below.
      return;
    }
    const runningState = action.runningStateSignal.peek();
    if (runningState === RUNNING) {
      // Its end sets the next tick.
      return;
    }
    if (runningState === COMPLETED) {
      const doneReason = readDone();
      if (doneReason) {
        end(doneReason);
        return;
      }
    } else if (!askWhenUnanswered) {
      // None answered yet: the run someone starts sets the next tick.
      return;
    }
    if (peekNetworkPolicy()?.readsFromStore) {
      // Paused, not failed: the next tick asks once the policy lets reads out.
      schedule();
      return;
    }
    markPollRun(action);
    if (failureCarried) {
      runCarried(() => action.rerun({ reason }));
    } else {
      runUnwatched(() => action.rerun({ reason }));
    }
  };
  const unsubscribeFromRunningState = subscribeToChanges(
    action.runningStateSignal,
    (state) => {
      if (over) {
        return;
      }
      if (state === COMPLETED) {
        settle();
        return;
      }
      if (state === FAILED) {
        end("failed");
        return;
      }
      if (askWhenUnanswered && state !== RUNNING) {
        // The run was called off or the action reset: asked again at the
        // next tick.
        schedule();
      }
    },
  );
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      tick();
      return;
    }
    clearTimeout(timeout);
    timeout = null;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  const runningState = action.runningStateSignal.peek();
  if (runningState === COMPLETED) {
    settle();
  } else if (askWhenUnanswered && runningState !== RUNNING) {
    tick();
  }
  return stop;
};

const pendingPollWeakMap = new WeakMap();
/**
 * `action.poll(options)`: asks the action again every `every` ms until the
 * answer is the one awaited, and resolves with it. See the action's JSDoc.
 */
export const pollAction = (action, options = {}) => {
  const { every, until, for: duration, signal } = options;
  if (typeof every !== "number" || every <= 0) {
    throw new TypeError(
      `${action}.poll() needs "every", the milliseconds between two asks, received ${every}.`,
    );
  }
  return new Promise((resolve, reject) => {
    const previousPoll = pendingPollWeakMap.get(action);
    if (previousPoll) {
      previousPoll.cancel(
        new DOMException(
          `A newer ${action}.poll() replaced this one.`,
          "AbortError",
        ),
      );
    }
    if (signal && signal.aborted) {
      reject(signal.reason);
      return;
    }
    let stopPolling = null;
    const onAbort = () => {
      cancel(signal.reason);
    };
    const release = () => {
      if (pendingPollWeakMap.get(action) === pendingPoll) {
        pendingPollWeakMap.delete(action);
      }
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };
    const cancel = (abortReason) => {
      if (stopPolling) {
        stopPolling();
      }
      release();
      reject(abortReason);
    };
    const pendingPoll = { cancel };
    pendingPollWeakMap.set(action, pendingPoll);
    if (signal) {
      signal.addEventListener("abort", onAbort);
    }
    stopPolling = startPolling(
      action,
      () => ({ every, until, for: duration }),
      {
        askWhenUnanswered: true,
        failureCarried: true,
        reason: "poll()",
        onEnd: (endReason) => {
          release();
          if (endReason === "failed") {
            reject(action.errorSignal.peek());
            return;
          }
          resolve(action.dataSignal.peek());
        },
      },
    );
  });
};

/**
 * Whether the run in progress was started by a poll: its readers draw it as a
 * revalidation, the answer held kept on screen and nothing loading.
 */
export const isPollRun = (action) => pollRunActionWeakSet.has(action);
// The mark ends with the run, whatever ends it, and not with whoever polls: a
// reader unmounting mid-run leaves the others reading a run that is still a
// revalidation.
const pollRunActionWeakSet = new WeakSet();
const markPollRun = (action) => {
  pollRunActionWeakSet.add(action);
  const unsubscribe = subscribeToChanges(action.runningStateSignal, (state) => {
    if (state === RUNNING) {
      return;
    }
    pollRunActionWeakSet.delete(action);
    unsubscribe();
  });
};

// The failure reaches the action's errorSignal, which the poll reads when the
// run ends FAILED; the run's own rejection has nobody else to tell.
const runCarried = (startRun) => {
  let result;
  try {
    result = startRun();
  } catch {
    return;
  }
  if (result && typeof result.catch === "function") {
    result.catch(() => {});
  }
};

// subscribe() calls back at once with the value the signal holds; what these
// subscriptions are for is what changes after.
const subscribeToChanges = (signal, onChange) => {
  let initial = true;
  return signal.subscribe((value) => {
    if (initial) {
      initial = false;
      return;
    }
    onChange(value);
  });
};
