/* eslint-env browser */
import React, { useEffect } from "react"
import * as reactAll from "react"
import * as reactDOM from "react-dom"

const App = ({ onFirstMount }) => {
  useEffect(() => {
    onFirstMount()
  }, [])

  return <Hello />
}

const Hello = () => {
  return <div>Hello world</div>
}

const firstMountPromise = new Promise((resolve) => {
  reactDOM.render(
    <App
      onFirstMount={() => {
        resolve(42)
      }}
    />,
    document.querySelector("#app"),
  )
})

export const ready = await firstMountPromise

export const reactExportNames = Object.keys(reactAll).sort()
