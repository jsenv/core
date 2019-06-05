import { detectNode } from "./detectNode.js"
import { nodeToCompileId } from "./nodeToCompileId.js"

export const resolveNodeGroup = ({ groupMap }) => {
  const node = detectNode()
  return nodeToCompileId(node, groupMap)
}
