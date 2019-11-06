const url = import.meta.url
const urlResolved = import.meta.resolve("./test-manual.js")
const originalUrl = import.meta.url
const assert = import.meta.require("assert")

assert(/https?:\/\/.*?\/\.dist\/.*?\/test\/manual\/file\.js/.test(url))
assert(/https?:\/\/.*?\/\.dist\/.*?\/test\/manual\/test-manual\.js/.test(urlResolved))
assert(/file:\/\/\/.*?\/test\/manual\/file\.js/.test(originalUrl))

export default 42
