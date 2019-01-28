import { answer } from "./answer.js"

const value = await import(answer === 42 ? "./42.js" : "./43.js")
console.log(value)
