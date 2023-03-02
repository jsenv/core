/* eslint-env serviceworker */

self.addEventListener("install", () => {
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
