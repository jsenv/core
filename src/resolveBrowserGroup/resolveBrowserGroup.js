import { resolveGroup } from "../resolvePlatformGroup/resolveGroup.js"
import { detectBrowser } from "./detectBrowser.js"

export const resolveBrowserGroup = ({ groupMap }) => resolveGroup(detectBrowser(), { groupMap })
