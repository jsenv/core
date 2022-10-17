import { comparisonToPath } from "../comparisonToPath.js"
import { valueToString } from "../valueToString.js"

export const anyComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "any") return undefined

  const path = comparisonToPath(comparison)
  const actualValue = valueToString(comparison.actual)
  const expectedConstructor = comparison.expected

  return createAnyMessage({ path, expectedConstructor, actualValue })
}

const createAnyMessage = ({
  path,
  expectedConstructor,
  actualValue,
}) => `unexpected value
--- found ---
${actualValue}
--- expected ---
any(${expectedConstructor.name})
--- path ---
${path}`
