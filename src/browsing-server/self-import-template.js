import {
  WELL_KNOWN_BROWSER_PLATFORM_PATHNAME,
  WELL_KNOWN_SELF_IMPORT_DYNAMIC_DATA_PATHNAME,
  // eslint-disable-next-line import/no-unresolved
} from "SELF_IMPORT_STATIC_DATA.js"

const filenameRelative = window.location.pathname.slice(1)

;(async () => {
  const [{ executeCompiledFile }, { compileInto, compileServerOrigin }] = await Promise.all([
    window.System.import(WELL_KNOWN_BROWSER_PLATFORM_PATHNAME),
    window.System.import(WELL_KNOWN_SELF_IMPORT_DYNAMIC_DATA_PATHNAME),
  ])

  executeCompiledFile({
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
})()
