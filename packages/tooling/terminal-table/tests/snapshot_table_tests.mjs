import { snapshotTests } from "@jsenv/snapshot";

export const snapshotTableTests = (url, fn) => {
  return snapshotTests(url, fn, {
    logEffects: {
      prevent: true,
    },
    executionEffects: {
      catch: false,
    },
    // logEffects: false,
    // logEffects: {
    //   group: false,
    // },
  });
};
