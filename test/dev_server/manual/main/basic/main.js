import { answer } from "./question.js"

console.log(answer)

if (import.meta.hot) {
  import.meta.hot.accept()
}
