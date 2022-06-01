import { useState, useLayoutEffect } from "react"

import appStyleSheet from "./App.css" assert { type: "css" }

const logoUrl = new URL("./logo.svg", import.meta.url)

export const App = () => {
  const [count, setCount] = useState(0)

  useLayoutEffect(() => {
    document.adoptedStyleSheets = [
      ...document.adoptedStyleSheets,
      appStyleSheet,
    ]
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (s) => s !== appStyleSheet,
      )
    }
  }, [])

  return (
    <div className="app">
      <header className="app_header">
        <img src={logoUrl} className="app_logo" alt="logo" />
        <p>Hello jsenv + React!</p>
        <p>
          <button type="button" onClick={() => setCount((count) => count + 1)}>
            toto: {count}
          </button>
        </p>
        <p>
          Edit <code>app.jsx</code> and save to test HMR updates.
        </p>
        <p>
          <a
            className="app_link"
            href="https://github.com/jsenv/jsenv-core"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jsenv documentation
          </a>
        </p>
      </header>
    </div>
  )
}
