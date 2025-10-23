import { debug } from "../debug.js";
import { analyzeParameterPropagation } from "./parameter_analysis.js";

// Helper function to check if a parameter is used at all in the function body
function acceptsAnyObjectProperty(paramName, functionDef) {
  let found = false;

  function traverse(node) {
    if (found) return;
    if (!node || typeof node !== "object") return;

    // Check if parameter is referenced anywhere in the function body
    if (node.type === "Identifier" && node.name === paramName) {
      found = true;
      return;
    }

    // Traverse child nodes, but skip the function parameters to avoid false positives
    for (const key in node) {
      if (key === "parent" || (node === functionDef && key === "params"))
        continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          traverse(item);
        }
      } else {
        traverse(child);
      }
    }
  }

  traverse(functionDef);
  return found;
}

// Helper function to check if a parameter is used through function chaining
export function checkParameterChaining(
  paramName,
  functionDef,
  functionDefinitions,
  visited = new Set(),
  chain = [],
  maxChainDepth = 40,
) {
  const functionName =
    functionDef.id?.name || functionDef.parent?.id?.name || "anonymous";
  debug(
    `checkParameterChaining: looking for param '${paramName}' in function '${functionName}'`,
  );

  // Check chain depth limit to prevent memory issues
  if (chain.length >= maxChainDepth) {
    debug(`checkParameterChaining: max chain depth reached for '${paramName}'`);
    return { found: false, chain: [] };
  }

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

  debug(
    `checkParameterChaining: found ${propagations.length} propagations for '${functionName}'`,
  );

  // Keep track of the longest chain even if parameter is not found
  let bestChain = chain;

  for (const propagation of propagations) {
    const { targetFunction, targetFunctionDef, spreadElements, argumentIndex } =
      propagation;

    const currentChain =
      chain.length === 0
        ? [functionKey, targetFunction]
        : [...chain, targetFunction];

    // Update bestChain with the longest chain we've built so far
    if (currentChain.length > bestChain.length) {
      bestChain = currentChain;
    }

    debug(
      `checkParameterChaining: checking propagation to '${targetFunction}', spreadElements: [${spreadElements.join(", ")}]`,
    );

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
              debug(
                `Parameter '${paramName}' is in rest element, checking target function '${targetFunction}'`,
              );

              // Parameter is in rest, check if target function accepts it

              // If target function is external (no source code available), assume all params are valid
              if (!targetFunctionDef || targetFunctionDef.isExternal) {
                debug(
                  `[DEBUG] Target function '${targetFunction}' is external, accepting parameter '${paramName}'`,
                );
                return { found: true, chain: currentChain };
              }

              // Handle both wrapped format and direct node format for backward compatibility
              const targetFunctionNode =
                targetFunctionDef.node || targetFunctionDef;

              // Protective behavior: if we can't properly access the target function's parameters,
              // assume it's valid to avoid false positives
              if (!targetFunctionNode || !targetFunctionNode.params) {
                debug(
                  `Target function '${targetFunction}' has no analyzable parameters, assuming parameter '${paramName}' is valid`,
                );
                return { found: true, chain: currentChain };
              }

              const targetParams = targetFunctionNode.params;
              debug(
                `Target function '${targetFunction}' has ${targetParams.length} parameters`,
              );

              // Check if target function uses rest parameters (...args) - these accept any parameters
              if (
                targetParams.length > 0 &&
                targetParams[targetParams.length - 1].type === "RestElement"
              ) {
                debug(
                  `Target function '${targetFunction}' uses rest parameters (...args), accepting parameter '${paramName}'`,
                );
                return { found: true, chain: currentChain };
              }

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
                        targetFunctionNode,
                        functionDefinitions,
                        visited,
                        currentChain,
                        maxChainDepth,
                      );
                      if (result.found) {
                        return result;
                      }
                    }
                  }
                } else if (targetParam.type === "Identifier") {
                  // Simple object parameter (e.g., stringifyAttributes(object))
                  // Check if this parameter is used in a way that accepts any object property
                  if (
                    acceptsAnyObjectProperty(
                      targetParam.name,
                      targetFunctionNode,
                    )
                  ) {
                    return { found: true, chain: currentChain };
                  }
                } else if (targetParam.type === "AssignmentPattern") {
                  // Handle parameters with defaults
                  if (targetParam.left?.type === "Identifier") {
                    // Simple object parameter with default (e.g., rootOptions = {})
                    return { found: true, chain: currentChain };
                  } else if (targetParam.left?.type === "ObjectPattern") {
                    // Destructured object parameter with default (e.g., { name, ...rest } = {})
                    // Check if it has a rest element
                    if (
                      targetParam.left.properties?.some(
                        (prop) => prop.type === "RestElement",
                      )
                    ) {
                      return { found: true, chain: currentChain };
                    }
                    // Continue to check the regular object pattern logic
                    for (const targetProp of targetParam.left.properties) {
                      if (
                        targetProp.type === "Property" &&
                        targetProp.key?.type === "Identifier" &&
                        targetProp.key.name === paramName
                      ) {
                        return { found: true, chain: currentChain };
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

  // When parameter is not found, preserve the longest chain we built during analysis
  // This allows error reporting to attribute the rejection to the correct function
  return { found: false, chain: bestChain };
}

// Helper function to collect all parameters accepted in a function and its call chain
export function collectChainParameters(
  functionDef,
  functionDefinitions,
  visited = new Set(),
  maxChainDepth = 40,
) {
  // Check depth limit to prevent memory issues
  if (visited.size >= maxChainDepth) {
    return new Set();
  }

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
    // Handle both wrapped format and direct node format for backward compatibility
    const targetFunctionNode = targetFunctionDef?.node || targetFunctionDef;
    const targetParams = collectChainParameters(
      targetFunctionNode,
      functionDefinitions,
      visited,
      maxChainDepth,
    );
    for (const param of targetParams) {
      allParams.add(param);
    }
  }

  return allParams;
}
