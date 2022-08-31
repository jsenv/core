import { answer } from "./dep.js"

window.ask = () => answer

const [value] = [42]
console.log({
  ...{ value },
})
