import { createTaskLog } from "@jsenv/humanize";

const task = createTaskLog("Doing something");
setTimeout(() => {
  task.done();
}, 1_000);
