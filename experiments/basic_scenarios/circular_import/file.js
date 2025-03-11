import { valueFromMain } from "./main.js"

export const valueFromFile = "valueFromFile"

// valueFromMain is undefined
setTimeout(() => {
  console.log({ valueFromMain })
})

if (import.meta.hot) {
  import.meta.hot.accept()
}
