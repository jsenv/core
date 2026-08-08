/*
 * Every dev server response says where its time went (server-timing header,
 * shown by devtools under Network > Timing):
 * - a cooked file details the cook (the transform phase, at least, since
 *   cooking a js module always transforms it) plus the overall
 *   "time to start responding"
 * - a repeat request served from the in-memory graph says "memory" instead —
 *   there was no cook to detail
 */

import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
  // every timing entry, whatever it took: the assertions below read the header
  serverTiming: { minDuration: 0 },
  port: 0,
});
try {
  const fetchServerTiming = async () => {
    const response = await fetch(`${devServer.origin}/main.js`);
    await response.arrayBuffer();
    return response.headers.get("server-timing") || "";
  };

  // first request: cooked
  {
    const serverTiming = await fetchServerTiming();
    const actual = {
      hasTransformPhase: serverTiming.includes(`desc="transform";dur=`),
      hasTimeToStartResponding: serverTiming.includes(
        `desc="time to start responding"`,
      ),
      servedFromMemory: serverTiming.includes(
        `desc="served from memory cache"`,
      ),
    };
    const expect = {
      hasTransformPhase: true,
      hasTimeToStartResponding: true,
      servedFromMemory: false,
    };
    assert({ actual, expect });
  }

  // same request again: served from memory
  {
    const serverTiming = await fetchServerTiming();
    const actual = {
      hasTimeToStartResponding: serverTiming.includes(
        `desc="time to start responding"`,
      ),
      servedFromMemory: serverTiming.includes(
        `desc="served from memory cache"`,
      ),
    };
    const expect = {
      hasTimeToStartResponding: true,
      servedFromMemory: true,
    };
    assert({ actual, expect });
  }
} finally {
  await devServer.stop();
}
