import { comparisonToPath } from "../comparisonToPath.js"

export const setSizeComparisonToMessage = (comparison) => {
  if (comparison.type !== "set-size") return undefined

  if (comparison.actual > comparison.expected)
    return createBiggerThanExpectedMessage(comparison)

  return createSmallerThanExpectedMessage(comparison)
}

const createBiggerThanExpectedMessage = (
  comparison,
) => `a set is bigger than expected
--- set size found ---
${comparison.actual}
--- set size expected ---
${comparison.expected}
--- path ---
${comparisonToPath(comparison.parent)}`

const createSmallerThanExpectedMessage = (
  comparison,
) => `a set is smaller than expected
--- set size found ---
${comparison.actual}
--- set size expected ---
${comparison.expected}
--- path ---
${comparisonToPath(comparison.parent)}`
