import "./file.js"

const textFileUrl = new URL("./file.txt", import.meta.url).href
console.log(textFileUrl)
const absoluteUrl = new URL("http://example.com/file.txt", "https://jsenv.dev")
  .href
console.log(absoluteUrl)

const windowLocationRelativeUrl = {
  toto: new URL("./file.txt", window.location).href,
}.toto
const windowOriginRelativeUrl = new URL("./src/file.txt", window.origin).href
const absoluteBaseUrl = new URL("./file.txt", "http://jsenv.dev").href

window.resolveResultPromise({
  textFileUrl,
  absoluteUrl,
  windowLocationRelativeUrl,
  windowOriginRelativeUrl,
  absoluteBaseUrl,
})
