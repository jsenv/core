import { createDynamicLog, startSpinner } from "@jsenv/humanize";

const dynamicLog = createDynamicLog();
const spinner = startSpinner({
  dynamicLog,
  render: () => "Loading and I would say even more",
  stopOnWriteFromOutside: true,
});

await new Promise((resolve) => setTimeout(resolve, 2500));

dynamicLog.update("Hey");
spinner.stop();

await new Promise((resolve) => setTimeout(resolve, 500));
