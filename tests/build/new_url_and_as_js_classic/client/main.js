const urlObject = new URL("./main.js", import.meta.url)

window.resolveResultPromise(urlObject.href)
