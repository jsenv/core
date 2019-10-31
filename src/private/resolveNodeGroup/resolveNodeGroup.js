import { resolveGroup } from "../resolvePlatformGroup/resolveGroup.js"
import { detectNode } from "./detectNode.js"

export const resolveNodeGroup = ({ groupMap }) => resolveGroup(detectNode(), { groupMap })
