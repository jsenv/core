import { comparisonToPath } from "../comparison_to_path.js";
import { valueToString } from "../value_to_string.js";

export const notComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "not") return undefined;

  const path = comparisonToPath(comparison);
  const actualValue = valueToString(comparison.actual);

  return createNotMessage({ path, actualValue });
};

const createNotMessage = ({ path, actualValue }) => `unexpected value
--- found ---
${actualValue}
--- expected ---
an other value
--- path ---
${path}`;
