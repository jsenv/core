const { answer } = await import("./dependency.js")

console.log(answer)

// eslint-disable-next-line no-debugger
debugger

window.__done__ = true
window.__value__ = answer
