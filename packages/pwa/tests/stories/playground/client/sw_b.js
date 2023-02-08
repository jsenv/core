/* eslint-env serviceworker */

// toto
self.addEventListener("install", (installEvent) => {
  // throw new Error("here")
  //   installEvent.waitUntil(
  //     new Promise((resolve, reject) => {
  //       self.addEventListener("message", async ({ data, ports }) => {
  //         if (data === "throw_on_install") {
  //           reject(new Error("here"))
  //           ports[0].postMessage({ status: "resolved" })
  //         }
  //       })
  //     }),
  //   )
})
