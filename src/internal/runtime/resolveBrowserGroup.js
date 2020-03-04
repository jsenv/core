import { detectBrowser } from "./detectBrowser/detectBrowser.js"
import { resolveGroup } from "./resolveGroup.js"

export const resolveBrowserGroup = (groupMap) => resolveGroup(detectBrowser(), groupMap)
