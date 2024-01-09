import { inspect } from "@jsenv/inspect";

import { createDetailedMessage } from "./utils/detailed_message.js";
import { comparisonToPath } from "./utils/comparison_to_path.js";

export const getPropertiesErrorInfo = (comparison) => {
  if (comparison.type !== "properties") {
    return null;
  }

  const path = comparisonToPath(comparison.parent);
  const missing = comparison.actual.missing;
  const extra = comparison.actual.extra;
  const missingCount = missing.length;
  const extraCount = extra.length;
  const unexpectedProperties = {};
  extra.forEach((propertyName) => {
    unexpectedProperties[propertyName] = comparison.parent.actual[propertyName];
  });
  const missingProperties = {};
  missing.forEach((propertyName) => {
    missingProperties[propertyName] = comparison.parent.expected[propertyName];
  });

  if (missingCount === 1 && extraCount === 0) {
    return {
      type: "MissingPropertyAssertionError",
      message: createDetailedMessage("1 missing property", {
        "missing property": inspect(missingProperties),
        path,
      }),
    };
  }

  if (missingCount > 1 && extraCount === 0) {
    return {
      type: "MissingPropertyAssertionError",
      message: createDetailedMessage(`${missingCount} missing properties`, {
        "missing properties": inspect(missingProperties),
        path,
      }),
    };
  }

  if (missingCount === 0 && extraCount === 1) {
    return {
      type: "ExtraPropertyAssertionError",
      message: createDetailedMessage(`1 unexpected property`, {
        "unexpected property": inspect(unexpectedProperties),
        path,
      }),
    };
  }

  if (missingCount === 0 && extraCount > 1) {
    return {
      type: "ExtraPropertyAssertionError",
      message: createDetailedMessage(`${extraCount} unexpected properties`, {
        "unexpected properties": inspect(unexpectedProperties),
        path,
      }),
    };
  }

  let message = "";
  if (extraCount === 1) {
    message += `1 unexpected property`;
  } else {
    message += `${extraCount} unexpected properties`;
  }
  if (missingCount === 1) {
    message += ` and 1 missing property`;
  } else {
    message += ` and ${missingCount} missing properties`;
  }
  return {
    type: "PropertiesAssertionError",
    message: createDetailedMessage(message, {
      [extraCount === 1 ? "unexpected property" : "unexpected properties"]:
        inspect(unexpectedProperties),
      [missingCount === 1 ? "missing property" : "missing properties"]:
        inspect(missingProperties),
      path,
    }),
  };
};
