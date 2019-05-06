// eslint-disable-next-line import/no-unresolved
import { filenameRelative } from "/.jsenv-well-known/browser-self-execute-static-data.js"
import { loadUsingScript } from "../loadUsingScript.js"

// eslint-disable-next-line import/newline-after-import
;(async () => {
  await loadUsingScript("/.jsenv-well-known/system.js")
  const { System } = window

  const [{ compileInto, compileServerOrigin }, { execute }] = await Promise.all([
    System.import("/.jsenv-well-known/browser-self-execute-dynamic.data.js"),
    System.import("/.jsenv-well-known/browser-execute.js"),
  ])

  execute({
    filenameRelative,
    compileServerOrigin,
    compileInto,
  })
})()
