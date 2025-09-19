import { dirname, relative } from "path";
import { collectChainParameters } from "./chaining.js";
import { calculateSimilarity, findSimilarParams } from "./suggestions.js";

/**
 * Get relative file path for display in error messages
 * @param {string} sourceFile - Absolute path to the source file
 * @param {string} currentFile - Absolute path to the current file being linted
 * @returns {string} - Relative path for display
 */
function getRelativeFilePath(sourceFile, currentFile) {
  try {
    const relativePath = relative(dirname(currentFile), sourceFile);
    // Ensure it starts with ./ for clarity
    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  } catch {
    // Fallback to just the filename if relative path fails
    return sourceFile.split("/").pop() || sourceFile;
  }
}

/**
 * Formats a parameter list, shortening it if it's too long
 * @param {Array<string>} params - Array of parameter names
 * @param {number} maxShown - Maximum number of parameters to show before truncating (default: 5)
 * @returns {string} - Formatted parameter list
 */
function formatParameterList(params, maxShown = 5) {
  if (params.length <= maxShown) {
    return params.join(", ");
  }

  const shown = params.slice(0, maxShown);
  const remaining = params.length - maxShown;
  return `${shown.join(", ")} and ${remaining} more`;
}

// Helper function to generate appropriate error message based on call chain
export function generateErrorMessage(
  paramName,
  functionName,
  chain,
  functionDef,
  functionDefinitions,
  givenParams = [],
  currentFilePath = null,
  maxChainDepth = 40,
) {
  // Collect all available parameters in the function and its chain
  const availableParams = collectChainParameters(
    functionDef,
    functionDefinitions,
    new Set(),
    maxChainDepth,
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

  // Check if function is from an imported file (different from current file)
  const sourceFile = functionDef?.__sourceFile;
  const shouldShowFilePath =
    sourceFile && currentFilePath && sourceFile !== currentFilePath;
  const relativeFilePath = shouldShowFilePath
    ? getRelativeFilePath(sourceFile, currentFilePath)
    : null;

  // Generate autofix functions - for high-confidence typos, only offer rename
  const autofixes = {
    remove: !isHighConfidenceTypo, // Skip remove for likely typos
    rename: bestSuggestion, // Only suggest rename if we have a good similarity match
  };

  if (isSuperfluous) {
    // Superfluous parameter cases
    if (chain.length === 0) {
      const messageId = shouldShowFilePath
        ? "superfluous_param_with_file"
        : "superfluous_param";
      const data = {
        param: paramName,
        func: functionName,
        expected: formatParameterList(Array.from(directParams)),
      };
      if (shouldShowFilePath) {
        data.filePath = relativeFilePath;
      }
      return {
        messageId,
        data,
        autofixes,
      };
    }

    if (chain.length === 1 || chain.length === 2) {
      const messageId = shouldShowFilePath
        ? "superfluous_param_chain_with_file"
        : "superfluous_param_chain";
      const data = {
        param: paramName,
        firstFunc,
        secondFunc,
        expected: formatParameterList(Array.from(directParams)),
      };
      if (shouldShowFilePath) {
        data.filePath = relativeFilePath;
      }
      return {
        messageId,
        data,
        autofixes,
      };
    }

    const messageId = shouldShowFilePath
      ? "superfluous_param_long_chain_with_file"
      : "superfluous_param_long_chain";
    const data = {
      param: paramName,
      firstFunc,
      lastFunc,
      expected: formatParameterList(Array.from(directParams)),
    };
    if (shouldShowFilePath) {
      data.filePath = relativeFilePath;
    }
    return {
      messageId,
      data,
      autofixes,
    };
  }

  if (chain.length === 0) {
    // Simple case - no chain
    if (suggestions.length > 0) {
      const messageId = shouldShowFilePath
        ? "not_found_param_with_suggestions_and_file"
        : "not_found_param_with_suggestions";
      const data = {
        param: paramName,
        func: functionName,
        suggestions: suggestions.join(", "),
      };
      if (shouldShowFilePath) {
        data.filePath = relativeFilePath;
      }
      return {
        messageId,
        data,
        autofixes,
      };
    }

    const messageId = shouldShowFilePath
      ? "not_found_param_with_file"
      : "not_found_param";
    const data = { param: paramName, func: functionName };
    if (shouldShowFilePath) {
      data.filePath = relativeFilePath;
    }
    return {
      messageId,
      data,
      autofixes,
    };
  }

  if (chain.length === 1 || chain.length === 2) {
    // Short chain
    if (suggestions.length > 0 || availableParamsArray.length > 0) {
      const messageId = shouldShowFilePath
        ? "not_found_param_chain_with_suggestions_and_file"
        : "not_found_param_chain_with_suggestions";
      const data = {
        param: paramName,
        firstFunc,
        secondFunc,
        available: availableParamsArray.join(", "),
      };
      if (shouldShowFilePath) {
        data.filePath = relativeFilePath;
      }
      return {
        messageId,
        data,
        autofixes,
      };
    }

    const messageId = shouldShowFilePath
      ? "not_found_param_chain_with_file"
      : "not_found_param_chain";
    const data = { param: paramName, firstFunc, secondFunc };
    if (shouldShowFilePath) {
      data.filePath = relativeFilePath;
    }
    return {
      messageId,
      data,
      autofixes,
    };
  }

  // Long chain (4+ functions) - show abbreviated form
  if (suggestions.length > 0 || availableParamsArray.length > 0) {
    const messageId = shouldShowFilePath
      ? "not_found_param_chain_long_with_suggestions_and_file"
      : "not_found_param_chain_long_with_suggestions";
    const data = {
      param: paramName,
      firstFunc,
      lastFunc,
      available: availableParamsArray.join(", "),
    };
    if (shouldShowFilePath) {
      data.filePath = relativeFilePath;
    }
    return {
      messageId,
      data,
      autofixes,
    };
  }

  const messageId = shouldShowFilePath
    ? "not_found_param_long_chain_with_file"
    : "not_found_param_long_chain";
  const data = { param: paramName, firstFunc, lastFunc };
  if (shouldShowFilePath) {
    data.filePath = relativeFilePath;
  }
  return {
    messageId,
    data,
    autofixes,
  };
}
