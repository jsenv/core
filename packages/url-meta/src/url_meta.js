import { resolveAssociations } from "./resolve_associations.js"
import { applyAssociations } from "./associations.js"
import { applyAliases } from "./aliases.js"
import { applyPatternMatching } from "./pattern_matching.js"
import { urlChildMayMatch } from "./url_child_may_match.js"

export const URL_META = {
  resolveAssociations,
  applyAssociations,
  urlChildMayMatch,
  applyPatternMatching,
  applyAliases,
}
