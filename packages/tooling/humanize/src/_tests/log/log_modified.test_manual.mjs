import { createDynamicLog } from "@jsenv/humanize";

const dynamicLog = createDynamicLog();
dynamicLog.update("hello");
console.log("hey");
dynamicLog.update("world");
dynamicLog.update("!");
