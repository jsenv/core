import { snapshotTests } from "@jsenv/snapshot";

export const snapshotTableTests = (url, fn) => {
  return snapshotTests(url, fn, {
    executionEffects: {
      catch: false,
    },
    // logEffects: false,
    // logEffects: {
    //   group: false,
    // },
  });
};
