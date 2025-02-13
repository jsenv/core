import { createDynamicLog, startSpinner } from "@jsenv/humanize";

const dynamicLog = createDynamicLog();
const startMs = Date.now();
let msDuration = 0;
let text = "Doing something";
const spinner = startSpinner({
  dynamicLog,
  render: () => text,
  effect: () => {
    const intervalId = setInterval(() => {
      msDuration = Date.now() - startMs;
      text = `Doing something ${msDuration} ms`;
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  },
});
await new Promise((resolve) => setTimeout(resolve, 2500));

spinner.stop("Done");
console.log(`Done in ${msDuration} ms`);

await new Promise((resolve) => setTimeout(resolve, 500));
