import { createDynamicLog, startSpinner } from "@jsenv/log";

const dynamicLog = createDynamicLog();
const spinner = startSpinner({
  dynamicLog,
  render: () => "Loading and I would say event more",
  stopOnWriteFromOutside: true,
});

await new Promise((resolve) => setTimeout(resolve, 2500));

dynamicLog.update("Hey");
spinner.stop();

await new Promise((resolve) => setTimeout(resolve, 500));
