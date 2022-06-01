import { createLog, startSpinner } from "@jsenv/log"

const log = createLog()
const spinner = startSpinner({
  log,
  text: "Loading and I would say event more",
  stopOnWriteFromOutside: true,
})

await new Promise((resolve) => setTimeout(resolve, 2500))

log.write("Hey")
spinner.stop()

await new Promise((resolve) => setTimeout(resolve, 500))
