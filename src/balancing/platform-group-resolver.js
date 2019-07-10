import { resolveBrowserGroup } from "./browser-group-resolver.js"
import { resolveNodeGroup } from "./node-group-resolver.js"

export const resolvePlatformGroup = ({ groupMap }) => {
  if (typeof window === "object") return resolveBrowserGroup({ groupMap })
  if (typeof process === "object") return resolveNodeGroup({ groupMap })
  // we should certainly throw with unknown platform
  return undefined
}
