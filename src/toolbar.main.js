import { createLivereloading } from "./internal/toolbar/livereloading/livereloading.js"

const livereloading = createLivereloading(window.parent.document.location.pathname.slice(1), {
  onFileChanged: () => console.log("onFileChanged"),
  onFileRemoved: () => console.log("onFileRemoved"),
  onConnecting: () => console.log("onConnecting"),
  onAborted: () => console.log("onAborted"),
  onConnectionFailed: () => console.log("onConnectionFailed"),
  onConnected: () => console.log("onConnected"),
})
livereloading.connect()

console.log("hello from jsenv toolbar")
