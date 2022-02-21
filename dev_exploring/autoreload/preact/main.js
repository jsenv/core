import { h, render } from "preact"

import { App } from "./app.jsx"

let root
const renderApp = () => {
  root = render(h(App), document.querySelector("#app"), root)
}
renderApp()

if (import.meta.hot) {
  window.renderApp = renderApp
  import.meta.hot.accept(() => {
    requestAnimationFrame(renderApp)
  })
}
