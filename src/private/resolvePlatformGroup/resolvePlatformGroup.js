import { resolveGroup } from "./resolveGroup.js"
import { detectBrowser } from "../resolveBrowserGroup/detectBrowser.js"
import { detectNode } from "../resolveNodeGroup/detectNode.js"

export const resolvePlatformGroup = ({ groupMap }) => {
  if (typeof window === "object") return resolveGroup(detectBrowser(), { groupMap })
  if (typeof process === "object") return resolveGroup(detectNode(), { groupMap })
  // we should certainly throw with unknown platform
  return null
}
