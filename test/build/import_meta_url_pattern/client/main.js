import "./file.js"

export const textFileUrl = new URL("file.txt", import.meta.url).href

console.log(textFileUrl)
