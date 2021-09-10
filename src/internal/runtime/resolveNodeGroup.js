import { detectNode } from "./detectNode/detectNode.js"
import { resolveGroup } from "./resolveGroup.js"

export const resolveNodeGroup = (groupMap) =>
  resolveGroup(detectNode(), groupMap)
