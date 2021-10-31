/* eslint-env browser, node */

console.log("before")
// eslint-disable-next-line no-debugger
debugger
console.log("after")

// to trigger babel transform-typeof
console.log(typeof window === "object")
