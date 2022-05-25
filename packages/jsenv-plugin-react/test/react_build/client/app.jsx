import React from "react"
import { render } from "react-dom"

const { Root } = await import("./root.jsx")

render(<Root />, document.querySelector("#app"))

window.resolveResultPromise({
  spanContent: document.querySelector("#app span").innerHTML,
})
