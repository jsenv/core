import { performance } from "node:perf_hooks";

performance.mark("start");
await new Promise((resolve) => {
  setTimeout(() => {
    performance.measure("timeout", "start");
    resolve();
  }, 100);
});
