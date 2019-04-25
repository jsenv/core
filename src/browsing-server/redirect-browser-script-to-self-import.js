import { WELL_KNOWN_SELF_IMPORT_PATHNAME } from "./serve-self-import.js"

// "/.jsenv-well-known/browser-script.js" is written inside
// the html template used to run js in the browser
// that we reuse here
const WELL_KNOWN_BROWSER_SCRIPT_PATHNAME = "/.jsenv-well-known/browser-script.js"

export const redirectBrowserScriptToSelfImport = ({ request: { origin, ressource } }) => {
  if (ressource !== WELL_KNOWN_BROWSER_SCRIPT_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${origin}${WELL_KNOWN_SELF_IMPORT_PATHNAME}`,
    },
  }
}
