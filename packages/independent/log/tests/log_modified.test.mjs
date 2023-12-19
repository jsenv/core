import { createDynamicLog } from "@jsenv/log";

const dynamicLog = createDynamicLog({
  // newLine: false
});
dynamicLog.update("hello");
console.log("hey");
dynamicLog.update("world");
dynamicLog.update("!");
