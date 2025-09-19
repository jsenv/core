import { analyzeParameterPropagation } from "./parameter_analysis.js";

// Helper function to check if a parameter is used through function chaining
export function checkParameterChaining(
  paramName,
  functionDef,
  functionDefinitions,
  visited = new Set(),
  chain = [],
) {
  // Avoid infinite recursion
  const functionKey =
    functionDef.id?.name || functionDef.parent?.id?.name || "anonymous";
  if (visited.has(functionKey)) {
    return { found: false, chain: [] };
  }
  visited.add(functionKey);

  const propagations = analyzeParameterPropagation(
    functionDef,
    functionDefinitions,
  );

  for (const propagation of propagations) {
    const { targetFunction, targetFunctionDef, spreadElements, argumentIndex } =
      propagation;
    const currentChain =
      chain.length === 0
        ? [functionKey, targetFunction]
        : [...chain, targetFunction];

    // Check if this parameter could be propagated via spread elements
    const functionParams = functionDef.params;

    for (const param of functionParams) {
      if (param.type === "ObjectPattern") {
        for (const prop of param.properties) {
          if (
            prop.type === "RestElement" &&
            spreadElements.includes(prop.argument.name)
          ) {
            // This rest element is being spread to another function
            // Check if our parameter would be in the rest (not explicitly destructured)
            const explicitParams = param.properties
              .filter(
                (p) =>
                  p.type === "Property" && p.key && p.key.type === "Identifier",
              )
              .map((p) => p.key.name);

            if (!explicitParams.includes(paramName)) {
              // Parameter is in rest, check if target function accepts it
              const targetParams = targetFunctionDef.params;
              if (argumentIndex < targetParams.length) {
                const targetParam = targetParams[argumentIndex];
                if (targetParam.type === "ObjectPattern") {
                  for (const targetProp of targetParam.properties) {
                    if (
                      targetProp.type === "Property" &&
                      targetProp.key &&
                      targetProp.key.type === "Identifier" &&
                      targetProp.key.name === paramName
                    ) {
                      // Parameter is used in target function - return success with full chain
                      return { found: true, chain: currentChain };
                    }
                    // If target has rest element, recursively check its chain
                    if (targetProp.type === "RestElement") {
                      // Recursively check if this parameter is used further down the chain
                      const result = checkParameterChaining(
                        paramName,
                        targetFunctionDef,
                        functionDefinitions,
                        visited,
                        currentChain,
                      );
                      if (result.found) {
                        return result;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return { found: false, chain: [] };
}

// Helper function to collect all parameters accepted in a function and its call chain
export function collectChainParameters(
  functionDef,
  functionDefinitions,
  visited = new Set(),
) {
  const functionKey =
    functionDef.id?.name || functionDef.parent?.id?.name || "anonymous";
  if (visited.has(functionKey)) {
    return new Set();
  }
  visited.add(functionKey);

  const allParams = new Set();

  // Collect parameters from this function
  if (functionDef.params) {
    for (const param of functionDef.params) {
      if (param.type === "ObjectPattern") {
        for (const prop of param.properties) {
          if (
            prop.type === "Property" &&
            prop.key &&
            prop.key.type === "Identifier"
          ) {
            allParams.add(prop.key.name);
          }
        }
      }
    }
  }

  // Collect parameters from propagated functions
  const propagations = analyzeParameterPropagation(
    functionDef,
    functionDefinitions,
  );

  for (const propagation of propagations) {
    const { targetFunctionDef } = propagation;
    const targetParams = collectChainParameters(
      targetFunctionDef,
      functionDefinitions,
      visited,
    );
    for (const param of targetParams) {
      allParams.add(param);
    }
  }

  return allParams;
}
