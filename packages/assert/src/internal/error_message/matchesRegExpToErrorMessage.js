import { comparisonToPath } from "../comparisonToPath.js"
import { valueToString } from "../valueToString.js"

export const matchesRegExpToErrorMessage = (comparison) => {
  if (comparison.type !== "matchesRegExp") {
    return undefined
  }

  const path = comparisonToPath(comparison)
  const actualValue = valueToString(comparison.actual)
  const expectedRegexp = valueToString(comparison.expected)

  return createMatchesRegExpMessage({ path, actualValue, expectedRegexp })
}

const createMatchesRegExpMessage = ({
  path,
  expectedRegexp,
  actualValue,
}) => `unexpected value
--- found ---
${actualValue}
--- expected ---
matchesRegExp(${expectedRegexp})
--- path ---
${path}`
