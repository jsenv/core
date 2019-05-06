import {
  WELL_KNOWN_SYSTEM_PATHNAME,
  WELL_KNOWN_BROWSER_PLATFORM_PATHNAME,
  WELL_KNOWN_BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME,
  // eslint-disable-next-line import/no-unresolved
} from "BROWSER_SELF_EXECUTE_STATIC_DATA.js"
import { loadUsingScript } from "../loadUsingScript.js"

const filenameRelative = window.location.pathname.slice(1)

;(async () => {
  await loadUsingScript(WELL_KNOWN_SYSTEM_PATHNAME)

  const [{ executeCompiledFile }, { compileInto, compileServerOrigin }] = await Promise.all([
    window.System.import(WELL_KNOWN_BROWSER_PLATFORM_PATHNAME),
    window.System.import(WELL_KNOWN_BROWSER_SELF_EXECUTE_DYNAMIC_DATA_PATHNAME),
  ])

  executeCompiledFile({
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
})()
