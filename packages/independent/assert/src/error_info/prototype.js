import { humanize } from "@jsenv/humanize";

import { comparisonToPath } from "./utils/comparison_to_path.js";
import { valueToWellKnown } from "./utils/well_known_value.js";
import { findSelfOrAncestorComparison } from "./utils/find_self_or_ancestor_comparison.js";

export const getPrototypeErrorInfo = (comparison) => {
  const prototypeComparison = findSelfOrAncestorComparison(
    comparison,
    ({ type }) => type === "prototype",
  );
  if (!prototypeComparison) {
    return null;
  }

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
    return humanize(prototype);
  };
  const expectedPrototype = prototypeComparison.expected;
  const actualPrototype = prototypeComparison.actual;

  return {
    type: "PrototypeAssertionError",
    message: `unequal prototypes
--- prototype found ---
${prototypeToString(actualPrototype)}
--- prototype expected ---
${prototypeToString(expectedPrototype)}
--- path ---
${path}`,
  };
};

const comparisonToRootComparison = (comparison) => {
  let current = comparison;
  while (current) {
    if (current.parent) {
      current = current.parent;
    } else {
      break;
    }
  }
  return current;
};
