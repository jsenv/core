import { createDynamicLog } from "@jsenv/log";

const dynamicLog = createDynamicLog();
dynamicLog.update("hello");
console.log("hey");
dynamicLog.update("world");
dynamicLog.update("!");
