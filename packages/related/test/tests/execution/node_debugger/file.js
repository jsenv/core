/* globals window */

console.log("before");
debugger;
console.log("after");

// to trigger babel transform-typeof
console.log(typeof window === "object");
