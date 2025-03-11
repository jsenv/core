import { valueFromFile } from "./file.js"

export const valueFromMain = "valueFromMain2"

console.log({ valueFromFile })

if (import.meta.hot) {
  import.meta.hot.accept()
}
