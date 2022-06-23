import { createLog, startSpinner } from "@jsenv/log"

const log = createLog()
const startMs = Date.now()
let msDuration = 0
const spinner = startSpinner({
  log,
  text: "Doing something",
  effect: () => {
    const intervalId = setInterval(() => {
      msDuration = Date.now() - startMs
      spinner.text = `Doing something ${msDuration} ms`
    }, 100)
    return () => {
      clearInterval(intervalId)
    }
  },
})

await new Promise((resolve) => setTimeout(resolve, 2500))

spinner.stop("Done")
console.log(`Done in ${msDuration} ms`)

await new Promise((resolve) => setTimeout(resolve, 500))
