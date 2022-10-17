import { comparisonToPath } from "../comparisonToPath.js"
import { valueToString } from "../valueToString.js"

export const notComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "not") return undefined

  const path = comparisonToPath(comparison)
  const actualValue = valueToString(comparison.actual)

  return createNotMessage({ path, actualValue })
}

const createNotMessage = ({ path, actualValue }) => `unexpected value
--- found ---
${actualValue}
--- expected ---
an other value
--- path ---
${path}`
