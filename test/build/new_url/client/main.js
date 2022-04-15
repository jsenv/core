import "./file.js"

export const textFileUrl = new URL("file.txt", import.meta.url).href
console.log(textFileUrl)

export const absoluteUrl = new URL(
  "http://example.com/file.txt",
  "https://jsenv.dev",
).href
console.log(absoluteUrl)

export const windowOriginRelativeUrl = new URL("./file.txt", window.origin).href

export const absoluteBaseUrl = new URL("./file.txt", "http://jsenv.dev").href
