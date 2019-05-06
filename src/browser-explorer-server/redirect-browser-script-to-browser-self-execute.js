import { WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME } from "./serve-browser-self-execute.js"

// "/.jsenv-well-known/browser-script.js" is written inside
// the html template used to run js in the browser
// that we reuse here
const WELL_KNOWN_BROWSER_SCRIPT_PATHNAME = "/.jsenv-well-known/browser-script.js"

export const redirectBrowserScriptToBrowserSelfExecute = ({ request: { origin, ressource } }) => {
  if (ressource !== WELL_KNOWN_BROWSER_SCRIPT_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${origin}${WELL_KNOWN_BROWSER_SELF_EXECUTE_PATHNAME}`,
    },
  }
}
