/*
 * The two announcements around a navigation (step 02):
 * - a navigation asked while another is applied is part of it: one before, one
 *   after, for the outer one;
 * - a listener that throws is reported apart, the others are told, the after is
 *   said whatever the applying did.
 */

import { snapshotTests } from "@jsenv/snapshot";

import {
  announceRouting,
  observeAfterRouting,
  observeBeforeRouting,
} from "../browser_integration/before_routing.js";

const catchReportedErrors = (callback) => {
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
    return { value: callback(), reported };
  } finally {
    globalThis.setTimeout = setTimeoutBefore;
  }
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("a navigation asked during another is part of it", () => {
    const heard = [];
    const stopBefore = observeBeforeRouting((details) =>
      heard.push(`before ${details.url}`),
    );
    const stopAfter = observeAfterRouting((details) =>
      heard.push(`after ${details.url}`),
    );
    try {
      const result = announceRouting({ url: "/outer" }, () => {
        heard.push("apply /outer");
        return announceRouting({ url: "/nested" }, () => {
          heard.push("apply /nested");
          return "nested result";
        });
      });
      return { heard, result };
    } finally {
      stopBefore();
      stopAfter();
    }
  });

  test("a listener that throws is reported apart, the navigation goes on", () => {
    const heard = [];
    const stops = [
      observeBeforeRouting(() => {
        throw new Error("before listener failed");
      }),
      observeBeforeRouting(() => heard.push("before, second listener")),
      observeAfterRouting(() => heard.push("after")),
    ];
    try {
      const { value, reported } = catchReportedErrors(() => {
        let applyThrew = null;
        try {
          announceRouting({ url: "/a" }, () => {
            heard.push("apply");
            throw new Error("routing failed");
          });
        } catch (error) {
          applyThrew = error.message;
        }
        // the next navigation is announced again: nothing was left applying
        announceRouting({ url: "/b" }, () => heard.push("apply /b"));
        return applyThrew;
      });
      return { heard, caller_hears: value, reported };
    } finally {
      for (const stop of stops) {
        stop();
      }
    }
  });
});
