const jsUrl = new URL("./file.js", import.meta.url)

export const jsUrlInstanceOfUrl = jsUrl instanceof URL

export const jsUrlString = String(jsUrl)
