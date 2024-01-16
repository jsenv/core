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
//   const expected = `a loading\n`
//   assert({ actual, expected })
// }
// getOutput = spyStreamOutput(process.stdout)
// await new Promise((resolve) => setTimeout(resolve, 1500))

// {
//   const actual = getOutput()
//   const expected = `b loading\n`
//   assert({ actual, expected })
// }
// getOutput = spyStreamOutput(process.stdout)
// await new Promise((resolve) => setTimeout(resolve, 1500))

// {
//   const actual = getOutput()
//   const expected = `a loading\n`
//   assert({ actual, expected })
// }
