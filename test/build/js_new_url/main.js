import "./file.js"

export const textFileUrl = new URL("file.txt", import.meta.url).href
console.log(textFileUrl)

export const absoluteUrl = new URL("http://example.com/file.txt").href
console.log(absoluteUrl)
