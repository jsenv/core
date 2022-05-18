import { render } from "react-dom"

const { App } = await import("./app.jsx")

render(<App />, document.querySelector("#app"))

window.resolveResultPromise({
  spanContent: document.querySelector("#app span").innerHTML,
})
