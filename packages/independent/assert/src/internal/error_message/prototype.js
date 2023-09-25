import { inspect } from "@jsenv/inspect";
import { comparisonToPath } from "../comparisonToPath.js";
import { valueToWellKnown } from "../wellKnownValue.js";
import { comparisonToRootComparison } from "../comparisonToRootComparison.js";
import { findSelfOrAncestorComparison } from "../findSelfOrAncestorComparison.js";

export const prototypeComparisonToErrorMessage = (comparison) => {
  const prototypeComparison = findSelfOrAncestorComparison(
    comparison,
    ({ type }) => type === "prototype",
  );
  if (!prototypeComparison) return null;

  const rootComparison = comparisonToRootComparison(comparison);
  const path = comparisonToPath(prototypeComparison);
  const prototypeToString = (prototype) => {
    const wellKnown = valueToWellKnown(prototype);
    if (wellKnown) return wellKnown;
    // we could check in the whole comparison tree, not only for actual/expected
    // but any reference to that prototype
    // to have a better name for it
    // if anything refer to it except himself
    // it would be a better name for that object no ?
    if (prototype === rootComparison.expected) return "expected";
    if (prototype === rootComparison.actual) return "actual";
    return inspect(prototype);
  };
  const expectedPrototype = prototypeComparison.expected;
  const actualPrototype = prototypeComparison.actual;

  return createUnequalPrototypesMessage({
    path,
    expectedPrototype: prototypeToString(expectedPrototype),
    actualPrototype: prototypeToString(actualPrototype),
  });
};

const createUnequalPrototypesMessage = ({
  path,
  expectedPrototype,
  actualPrototype,
}) => `unequal prototypes
--- prototype found ---
${actualPrototype}
--- prototype expected ---
${expectedPrototype}
--- path ---
${path}`;
