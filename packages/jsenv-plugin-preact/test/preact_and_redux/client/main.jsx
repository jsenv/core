import { render } from "preact"
import { Provider } from "react-redux"

import { store } from "./store.js"
const { App } = await import("./app.jsx")

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.querySelector("#app"),
)

// increment
document.querySelector("#increment").click()
await new Promise((resolve) => {
  setTimeout(resolve, 100)
})
const spanContentAfterIncrement =
  document.querySelector("#counter_value").innerHTML
// decrement
document.querySelector("#decrement").click()
await new Promise((resolve) => {
  setTimeout(resolve, 100)
})
const spanContentAfterDecrement =
  document.querySelector("#counter_value").innerHTML
// resolve with what we found
window.resolveResultPromise({
  spanContentAfterIncrement,
  spanContentAfterDecrement,
})
