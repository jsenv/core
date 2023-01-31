import { createTaskLog } from "@jsenv/log"

const task = createTaskLog("Doing something")
setTimeout(() => {
  task.done()
}, 1_000)
