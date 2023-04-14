console.log(globalThis)

import("./dep.js")

// Let browser time to log an eventual warning about preload link not used
await new Promise((resolve) => {
  setTimeout(resolve, 3_000)
})
window.resolveResultPromise(42)
