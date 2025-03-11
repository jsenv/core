import value from "./file.js"

console.log(value)

// eslint-disable-next-line no-debugger
// debugger

console.log("bar")

console.log(typeof window === "object")

if (import.meta.hot) {
  import.meta.hot.accept()
}

export default 42
