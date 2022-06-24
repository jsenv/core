import React from "react"
import ReactDOM from "react-dom/client"

const { Root } = await import("./root.jsx")

ReactDOM.createRoot(document.querySelector("#app")).render(
  <React.StrictMode>
    <Root
      onRender={() => {
        window.resolveResultPromise({
          spanContent: document.querySelector("#app span").innerHTML,
        })
      }}
    />
  </React.StrictMode>,
)
