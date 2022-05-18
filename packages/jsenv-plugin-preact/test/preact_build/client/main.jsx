import { render } from "preact"

const App = () => {
  return <span>Hello world</span>
}

render(<App />, document.querySelector("#app"))

window.resolveResultPromise({
  spanContent: document.querySelector("#app span").innerHTML,
})
