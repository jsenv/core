import { render } from "react"
import { App } from "./app.jsx"

render(<App />, document.getElementById("app"))

if (import.meta.hot) {
  import.meta.hot.accept()
}
