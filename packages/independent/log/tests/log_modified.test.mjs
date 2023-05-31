import { createLog } from "@jsenv/log";

const log = createLog({
  // newLine: false
});
log.write("hello");
console.log("hey");
log.write("world");
log.write("!");
