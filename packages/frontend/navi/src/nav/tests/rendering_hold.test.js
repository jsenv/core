/*
 * The rendering hold, driven the way Preact drives it: a drain handed to
 * `options.debounceRendering`. What it pins (route transitions, step 02):
 * - a drain asked for under a hold runs once, when the last share is given back;
 * - a navigation's hold taken over by an animator is that animator's share;
 * - a drain that throws is reported apart: giving the hold back does not throw,
 *   and what waits on the hold runs all the same.
 * The turn-round walk that once left a share taken for good lives in
 * route_transition.jsx: tests/route_transition_list_revisit drives it.
 */

import { snapshotTests } from "@jsenv/snapshot";
import { options } from "preact";

import {
  holdRendering,
  holdRenderingForRouting,
  releaseRoutingRenderingHold,
  takeoverRoutingRenderingHold,
  whenRenderingResumes,
} from "../rendering_hold.js";

const nextMicrotask = () => new Promise((resolve) => queueMicrotask(resolve));

// What an error reported apart (thrown from a timer) says, caught here
// instead of reaching the process.
const catchReportedErrors = async (callback) => {
  const reported = [];
  const setTimeoutBefore = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => {
    try {
      fn();
    } catch (error) {
      reported.push(error.message);
    }
  };
  try {
    const value = await callback();
    return { value, reported };
  } finally {
    globalThis.setTimeout = setTimeoutBefore;
  }
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("a drain asked for under a hold runs when the last share is given back", async () => {
    const log = [];
    const releaseA = holdRendering();
    const releaseB = holdRendering();
    options.debounceRendering(() => log.push("drain"));
    await nextMicrotask();
    const after_asked = [...log];
    releaseA();
    const after_first_share = [...log];
    releaseA(); // given twice: counts once
    const after_first_share_again = [...log];
    releaseB();
    const after_last_share = [...log];
    options.debounceRendering(() => log.push("drain without hold"));
    await nextMicrotask();
    return {
      after_asked,
      after_first_share,
      after_first_share_again,
      after_last_share,
      without_hold: [...log],
    };
  });

  test("a navigation's hold taken over is the animator's share", async () => {
    const log = [];
    holdRenderingForRouting();
    holdRenderingForRouting(); // one navigation, one share
    options.debounceRendering(() => log.push("drain"));
    await nextMicrotask();
    const releaseTakenOver = takeoverRoutingRenderingHold();
    // nothing left for the navigation to give back
    releaseRoutingRenderingHold();
    const after_routing_release = [...log];
    releaseTakenOver();
    return { after_routing_release, after_animator_release: [...log] };
  });

  test("a drain that throws is reported apart and what waits still runs", async () => {
    const log = [];
    const { value, reported } = await catchReportedErrors(async () => {
      const release = holdRendering();
      whenRenderingResumes(() => log.push("waiter 1"));
      whenRenderingResumes(() => {
        throw new Error("waiter 2 failed");
      });
      whenRenderingResumes(() => log.push("waiter 3"));
      options.debounceRendering(() => {
        throw new Error("render failed");
      });
      await nextMicrotask();
      let releaseThrew = null;
      try {
        release();
      } catch (error) {
        releaseThrew = error.message;
      }
      return { releaseThrew };
    });
    const resumed = [];
    whenRenderingResumes(() => resumed.push("ran at once"));
    return {
      release_threw: value.releaseThrew,
      waiters: log,
      reported,
      no_hold_left: resumed,
    };
  });
});
