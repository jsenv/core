import { snapshotTests } from "@jsenv/snapshot";

export const snapshotTableTests = (url, fn) => {
  return snapshotTests(url, fn, {
    // logEffects: false,
    // logEffects: {
    //   group: false,
    // },
  });
};
