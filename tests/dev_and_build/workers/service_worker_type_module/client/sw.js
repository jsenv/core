import "./a.js"

self.order = []

self.addEventListener("message", async (messageEvent) => {
  if (messageEvent.data === "inspect") {
    messageEvent.ports[0].postMessage({
      order: self.order,
      resourcesFromJsenvBuild: self.resourcesFromJsenvBuild,
    })
  }
})

// trigger jsenv dynamic import for slicedToArray
const fn = ([a]) => {
  console.log(a)
}
fn(["a"])
