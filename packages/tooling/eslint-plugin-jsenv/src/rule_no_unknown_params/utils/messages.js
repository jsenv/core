import { collectChainParameters } from "./chaining.js";
import { calculateSimilarity, findSimilarParams } from "./suggestions.js";

// Helper function to generate appropriate error message based on call chain
export function generateErrorMessage(
  paramName,
  functionName,
  chain,
  functionDef,
  functionDefinitions,
  givenParams = [],
) {
  // Collect all available parameters in the function and its chain
  const availableParams = collectChainParameters(
    functionDef,
    functionDefinitions,
  );
  const availableParamsArray = Array.from(availableParams);

  // Find suggestions for potential typos
  const suggestions = findSimilarParams(paramName, availableParams);
  const bestSuggestion = suggestions.length > 0 ? suggestions[0] : null;

  // Calculate similarity for high-confidence typo detection
  const bestSimilarity = bestSuggestion
    ? calculateSimilarity(paramName, bestSuggestion)
    : 0;
  const isHighConfidenceTypo = bestSimilarity > 0.8;

  // Check if this is a case where user provided exactly expected + one extra
  const directParams = new Set();
  if (functionDef.params) {
    for (const param of functionDef.params) {
      if (param.type === "ObjectPattern") {
        for (const prop of param.properties) {
          if (
            prop.type === "Property" &&
            prop.key &&
            prop.key.type === "Identifier"
          ) {
            directParams.add(prop.key.name);
          }
        }
      }
    }
  }

  // Check if this is a "superfluous" parameter
  // Consider it superfluous if we have 2+ expected params and ALL are provided + extra
  // This provides better error messages for cases with clear parameter expectations
  const isSuperfluous =
    directParams.size >= 2 &&
    Array.from(directParams).every((expected) =>
      givenParams.includes(expected),
    ) &&
    givenParams.some((p) => !directParams.has(p));

  const firstFunc = chain.length > 0 ? chain[0] : functionName;
  const secondFunc = chain.length > 1 ? chain[1] : null;
  const lastFunc = chain.length > 0 ? chain[chain.length - 1] : functionName;

  // Generate autofix functions - for high-confidence typos, only offer rename
  const autofixes = {
    remove: !isHighConfidenceTypo, // Skip remove for likely typos
    rename: bestSuggestion, // Only suggest rename if we have a good similarity match
  };

  if (isSuperfluous) {
    // Superfluous parameter cases
    if (chain.length === 0) {
      return {
        messageId: "superfluous_param",
        data: {
          param: paramName,
          func: functionName,
          expected: Array.from(directParams).join(", "),
        },
        autofixes,
      };
    }

    if (chain.length === 1 || chain.length === 2) {
      return {
        messageId: "superfluous_param_chain",
        data: {
          param: paramName,
          firstFunc,
          secondFunc,
          expected: Array.from(directParams).join(", "),
        },
        autofixes,
      };
    }

    return {
      messageId: "superfluous_param_long_chain",
      data: {
        param: paramName,
        firstFunc,
        lastFunc,
        expected: Array.from(directParams).join(", "),
      },
      autofixes,
    };
  }

  if (chain.length === 0) {
    // Simple case - no chain
    if (suggestions.length > 0) {
      return {
        messageId: "not_found_param_with_suggestions",
        data: {
          param: paramName,
          func: functionName,
          suggestions: suggestions.join(", "),
        },
        autofixes,
      };
    }

    return {
      messageId: "not_found_param",
      data: { param: paramName, func: functionName },
      autofixes,
    };
  }

  if (chain.length === 1 || chain.length === 2) {
    // Short chain
    if (suggestions.length > 0 || availableParamsArray.length > 0) {
      return {
        messageId: "not_found_param_chain_with_suggestions",
        data: {
          param: paramName,
          firstFunc,
          secondFunc,
          available: availableParamsArray.join(", "),
        },
        autofixes,
      };
    }

    return {
      messageId: "not_found_param_chain",
      data: { param: paramName, firstFunc, secondFunc },
      autofixes,
    };
  }

  // Long chain (4+ functions) - show abbreviated form
  if (suggestions.length > 0 || availableParamsArray.length > 0) {
    return {
      messageId: "not_found_param_chain_long_with_suggestions",
      data: {
        param: paramName,
        firstFunc,
        lastFunc,
        available: availableParamsArray.join(", "),
      },
      autofixes,
    };
  }

  return {
    messageId: "not_found_param_long_chain",
    data: { param: paramName, firstFunc, lastFunc },
    autofixes,
  };
}
