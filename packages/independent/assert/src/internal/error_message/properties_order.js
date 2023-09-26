import { inspect } from "@jsenv/inspect";

import { comparisonToPath } from "../comparison_to_path.js";

export const propertiesOrderComparisonToErrorMessage = (comparison) => {
  if (comparison.type !== "properties-order") return undefined;

  const path = comparisonToPath(comparison);
  const expected = comparison.expected;
  const actual = comparison.actual;

  return createUnexpectedPropertiesOrderMessage({
    path,
    expectedPropertiesOrder: propertyNameArrayToString(expected),
    actualPropertiesOrder: propertyNameArrayToString(actual),
  });
};

const createUnexpectedPropertiesOrderMessage = ({
  path,
  expectedPropertiesOrder,
  actualPropertiesOrder,
}) => `unexpected properties order
--- properties order found ---
${actualPropertiesOrder.join(`
`)}
--- properties order expected ---
${expectedPropertiesOrder.join(`
`)}
--- path ---
${path}`;

const propertyNameArrayToString = (propertyNameArray) => {
  return propertyNameArray.map((propertyName) => inspect(propertyName));
};
