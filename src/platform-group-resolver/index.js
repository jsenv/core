import { resolveNodeGroup } from "./node-group-resolver/index.js"
import { resolveBrowserGroup } from "./browser-group-resolver/index.js"

export const resolveGroup = ({ groupMap }) => {
  if (typeof window === "object") return resolveBrowserGroup({ groupMap })
  if (typeof process === "object") return resolveNodeGroup({ groupMap })
  // we should certainly throw with unknown platform
  return undefined
}
