import {
  WELL_KNOWN_BROWSER_PLATFORM_PATHNAME,
  WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME,
  // eslint-disable-next-line import/no-unresolved
} from "BROWSING_BUNDLE_STATIC_DATA.js"

const filenameRelative = window.location.pathname.slice(1)

const [{ executeCompiledFile }, { compileInto, compileServerOrigin }] = await Promise.all([
  import(WELL_KNOWN_BROWSER_PLATFORM_PATHNAME),
  import(WELL_KNOWN_BROWSING_BUNDLE_DYNAMIC_DATA_PATHNAME),
])

executeCompiledFile({
  compileInto,
  compileServerOrigin,
  filenameRelative,
})
