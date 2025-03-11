// import { assert } from "@jsenv/assert"

// import { startSpinner } from "@jsenv/humanize"
// import { spyStreamOutput } from "@jsenv/humanize/src/internal/spy_stream_output.js"

// let getOutput = spyStreamOutput(process.stdout)
// startSpinner({
//   frames: ["a", "b"],
//   text: "loading",
//   fps: 1,
// })

// {
//   const actual = getOutput()
//   const expect = `a loading\n`
//   assert({ actual, expect })
// }
// getOutput = spyStreamOutput(process.stdout)
// await new Promise((resolve) => setTimeout(resolve, 1500))

// {
//   const actual = getOutput()
//   const expect = `b loading\n`
//   assert({ actual, expect })
// }
// getOutput = spyStreamOutput(process.stdout)
// await new Promise((resolve) => setTimeout(resolve, 1500))

// {
//   const actual = getOutput()
//   const expect = `a loading\n`
//   assert({ actual, expect })
// }
