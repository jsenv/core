import { render } from "preact"
import { App } from "./app.jsx"

render(<App />, document.getElementById("app"))

if (import.meta.hot) {
  import.meta.hot.accept()
}
