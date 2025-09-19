// Helper function to build variable renaming map within a function
function buildVariableRenamingMap(functionDef) {
  const renamingMap = new Map(); // renamedVar -> originalVar

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    // Look for variable declarations like: const newVar = oldVar;
    if (
      node.type === "VariableDeclarator" &&
      node.id &&
      node.id.type === "Identifier" &&
      node.init &&
      node.init.type === "Identifier"
    ) {
      // Map: newVar -> oldVar (so we can resolve back to original)
      renamingMap.set(node.id.name, node.init.name);
    }

    // Traverse child nodes
    for (const key in node) {
      if (key === "parent") continue;
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
  return renamingMap;
}

// Helper function to resolve variable name back to original through renaming chain
function resolveToOriginalVariable(varName, renamingMap) {
  let currentName = varName;
  const visited = new Set();

  while (renamingMap.has(currentName) && !visited.has(currentName)) {
    visited.add(currentName);
    currentName = renamingMap.get(currentName);
  }

  return currentName;
}

// Helper function to analyze parameter propagation through function calls
function analyzeParameterPropagation(functionDef, functionDefinitions) {
  const propagations = [];
  const renamingMap = buildVariableRenamingMap(functionDef);

  function traverse(node) {
    if (!node || typeof node !== "object") return;

    // Look for function calls with spread elements in arguments
    if (
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.type === "Identifier"
    ) {
      const calledFunctionName = node.callee.name;
      const calledFunction = functionDefinitions.get(calledFunctionName);

      if (calledFunction) {
        // Check arguments for objects with spread elements OR direct variable passing
        for (let argIndex = 0; argIndex < node.arguments.length; argIndex++) {
          const arg = node.arguments[argIndex];

          if (arg.type === "ObjectExpression") {
            const spreadElements = [];
            const directProperties = [];

            for (const prop of arg.properties) {
              if (
                prop.type === "SpreadElement" &&
                prop.argument &&
                prop.argument.type === "Identifier"
              ) {
                // Resolve variable name back to original through renaming chain
                const originalName = resolveToOriginalVariable(
                  prop.argument.name,
                  renamingMap,
                );
                spreadElements.push(originalName);
              } else if (
                prop.type === "Property" &&
                prop.key &&
                prop.key.type === "Identifier"
              ) {
                directProperties.push(prop.key.name);
              }
            }

            if (spreadElements.length > 0) {
              propagations.push({
                targetFunction: calledFunctionName,
                targetFunctionDef: calledFunction,
                argumentIndex: argIndex,
                spreadElements,
                directProperties,
              });
            }
          } else if (arg.type === "Identifier") {
            // Direct variable passing like: targetFunction(rest) or targetFunction(titi)
            // Resolve back to original variable (e.g., titi -> rest)
            const originalName = resolveToOriginalVariable(
              arg.name,
              renamingMap,
            );

            // Check if this identifier is a rest parameter (either direct or renamed)
            const restParams = [];
            const functionParams = functionDef.params || [];

            for (const param of functionParams) {
              if (param.type === "ObjectPattern") {
                for (const prop of param.properties) {
                  if (prop.type === "RestElement" && prop.argument?.name) {
                    restParams.push(prop.argument.name);
                  }
                }
              }
            }

            // Add if this variable is a rest parameter or resolves to one
            if (
              restParams.includes(arg.name) ||
              restParams.includes(originalName)
            ) {
              propagations.push({
                targetFunction: calledFunctionName,
                targetFunctionDef: calledFunction,
                argumentIndex: argIndex,
                spreadElements: [originalName], // The original rest param name
                directProperties: [],
                isDirectVariablePassing: true,
              });
            }
          }
        }
      }
    }

    // Traverse child nodes
    for (const key in node) {
      if (key === "parent") continue;
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
  return propagations;
}

// Helper function to check if rest parameter is propagated to other functions
function isRestParameterPropagated(
  functionDef,
  restParamName,
  functionDefinitions,
) {
  let found = false;
  const renamingMap = buildVariableRenamingMap(functionDef);

  function traverse(node) {
    if (found) return;
    if (!node || typeof node !== "object") return;

    // Look for function calls where rest param is used in spread elements or direct passing
    if (
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.type === "Identifier"
    ) {
      // Only consider functions we can analyze (in functionDefinitions)
      const calledFunctionName = node.callee.name;
      const calledFunction = functionDefinitions.get(calledFunctionName);

      if (!calledFunction) {
        return; // Skip functions we can't analyze
      }

      for (const arg of node.arguments) {
        if (arg.type === "ObjectExpression") {
          for (const prop of arg.properties) {
            if (
              prop.type === "SpreadElement" &&
              prop.argument &&
              prop.argument.type === "Identifier"
            ) {
              // Check both direct name and resolved name through renaming
              const originalName = resolveToOriginalVariable(
                prop.argument.name,
                renamingMap,
              );
              if (
                prop.argument.name === restParamName ||
                originalName === restParamName
              ) {
                found = true;
                return;
              }
            }
          }
        } else if (arg.type === "Identifier") {
          // Direct variable passing - check if it resolves back to our rest param
          const originalName = resolveToOriginalVariable(arg.name, renamingMap);
          if (originalName === restParamName) {
            found = true;
            return;
          }
        }
      }
    }

    // Traverse child nodes, but skip the params to avoid false positives
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
function checkParameterChaining(
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
function collectChainParameters(
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

// Helper function to find similar parameter names (for typo suggestions)
function findSimilarParams(unknownParam, availableParams) {
  const suggestions = [];
  const unknownLower = unknownParam.toLowerCase();

  for (const param of availableParams) {
    const paramLower = param.toLowerCase();

    // Exact case-insensitive match
    if (unknownLower === paramLower && unknownParam !== param) {
      suggestions.unshift(param); // Put at front
      continue;
    }

    // Starting with same letters
    if (param.startsWith(unknownParam.charAt(0)) && param !== unknownParam) {
      const similarity = calculateSimilarity(unknownParam, param);
      if (similarity > 0.6) {
        suggestions.push(param);
      }
    }
  }

  return suggestions.slice(0, 3); // Max 3 suggestions
}

// Simple similarity calculation (Levenshtein-like)
function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

// Helper function to create autofix for removing a property
function createRemoveFix(fixer, propNode) {
  const parent = propNode.parent;

  // Find the property index
  let propIndex = -1;
  for (let i = 0; i < parent.properties.length; i++) {
    if (parent.properties[i] === propNode) {
      propIndex = i;
      break;
    }
  }

  if (propIndex === -1) return null;

  const isLast = propIndex === parent.properties.length - 1;

  if (parent.properties.length === 1) {
    // Only property - just remove it
    return fixer.remove(propNode);
  }

  if (isLast) {
    // Last property - remove including preceding comma
    const prevProperty = parent.properties[propIndex - 1];
    const range = [prevProperty.range[1], propNode.range[1]];
    return fixer.removeRange(range);
  }

  // Not last property - remove including following comma
  const nextProperty = parent.properties[propIndex + 1];
  const range = [propNode.range[0], nextProperty.range[0]];
  return fixer.removeRange(range);
}

// Helper function to create autofix for renaming a property
function createRenameFix(fixer, propNode, newName) {
  if (propNode.key && propNode.key.type === "Identifier") {
    return fixer.replaceText(propNode.key, newName);
  }
  return null;
}

// Helper function to create autofix for JSX attributes
function createJSXRemoveFix(fixer, attrNode) {
  return fixer.remove(attrNode);
}

function createJSXRenameFix(fixer, attrNode, newName) {
  if (attrNode.name && attrNode.name.type === "JSXIdentifier") {
    return fixer.replaceText(attrNode.name, newName);
  }
  return null;
}

// Helper function to generate appropriate error message based on call chain
function generateErrorMessage(
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

  // Check if this is an "extraneous" parameter
  // Consider it extraneous if we have 2+ expected params and ALL are provided + extra
  // This provides better error messages for cases with clear parameter expectations
  const isExtraneous =
    directParams.size >= 2 &&
    Array.from(directParams).every((expected) =>
      givenParams.includes(expected),
    ) &&
    givenParams.some((p) => !directParams.has(p));

  const firstFunc = chain.length > 0 ? chain[0] : functionName;
  const secondFunc = chain.length > 1 ? chain[1] : null;
  const lastFunc = chain.length > 0 ? chain[chain.length - 1] : functionName;

  // Generate autofix functions
  const autofixes = {
    remove: true, // Always offer removal
    rename: bestSuggestion, // Only suggest rename if we have a good similarity match
  };

  if (isExtraneous) {
    // Superfluous parameter cases
    if (chain.length === 0) {
      return {
        messageId: "superfluousParam",
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
        messageId: "superfluousParamChain",
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
      messageId: "superfluousParamLongChain",
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
        messageId: "notFoundParamWithSuggestions",
        data: {
          param: paramName,
          func: functionName,
          suggestions: suggestions.join(", "),
        },
        autofixes,
      };
    }

    return {
      messageId: "notFoundParam",
      data: { param: paramName, func: functionName },
      autofixes,
    };
  }

  if (chain.length === 1 || chain.length === 2) {
    // Short chain
    if (suggestions.length > 0 || availableParamsArray.length > 0) {
      return {
        messageId: "notFoundParamChainWithSuggestions",
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
      messageId: "notFoundParamChain",
      data: { param: paramName, firstFunc, secondFunc },
      autofixes,
    };
  }

  // Long chain (4+ functions) - show abbreviated form
  if (suggestions.length > 0 || availableParamsArray.length > 0) {
    return {
      messageId: "notFoundParamChainLongWithSuggestions",
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
    messageId: "notFoundParamLongChain",
    data: { param: paramName, firstFunc, lastFunc },
    autofixes,
  };
} // Helper function to find variable declarations in a function that match a name
function findVariableDeclarationsInFunction(functionNode, varName) {
  let found = false;

  function traverse(node) {
    if (found) return;

    if (!node || typeof node !== "object") return;

    // Check for variable declarators
    if (
      node.type === "VariableDeclarator" &&
      node.id &&
      node.id.type === "Identifier" &&
      node.id.name === varName
    ) {
      found = true;
      return;
    }

    // Check for destructuring assignments
    if (
      node.type === "VariableDeclarator" &&
      node.id &&
      node.id.type === "ObjectPattern"
    ) {
      for (const prop of node.id.properties) {
        if (
          prop.type === "Property" &&
          prop.key &&
          prop.key.type === "Identifier" &&
          prop.key.name === varName
        ) {
          found = true;
          return;
        }
      }
    }

    // Traverse child nodes
    for (const key in node) {
      if (key === "parent") continue; // Avoid infinite loops
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

  traverse(functionNode);
  return found;
}

// Function to analyze a call expression
function analyzeCallExpression(node, functionDefinitions, context) {
  const callee = node.callee;

  if (callee.type !== "Identifier") return;

  const funcName = callee.name;
  const functionDef = functionDefinitions.get(funcName);

  if (!functionDef) return;

  // Check if this call is inside the function that we're tracking
  // and if that function has variable declarations that shadow the function name
  let parent = node.parent;
  let isInsideTrackedFunction = false;
  while (parent) {
    if (parent === functionDef) {
      isInsideTrackedFunction = true;
      break;
    }
    parent = parent.parent;
  }

  if (isInsideTrackedFunction) {
    // Look for variable declarations inside this function that declare the same name
    const hasShadowingVariable = findVariableDeclarationsInFunction(
      functionDef,
      funcName,
    );
    if (hasShadowingVariable) {
      return; // The function name is shadowed, so this call doesn't refer to our tracked function
    }
  }

  const params = functionDef.params;
  if (params.length === 0 || node.arguments.length === 0) return;

  // Check each parameter that has object destructuring
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const arg = node.arguments[i];

    // Only check ObjectPattern parameters
    if (param.type !== "ObjectPattern") {
      continue;
    }

    // Only check ObjectExpression arguments
    if (!arg || arg.type !== "ObjectExpression") {
      continue;
    }

    // Check if this ObjectPattern has a rest element (...rest)
    const hasRestElement = param.properties.some(
      (p) => p.type === "RestElement",
    );

    // If there's a rest element, we need to check chaining to see if rest properties are actually used
    if (hasRestElement) {
      // Get explicitly declared parameters (not in rest)
      const explicitProps = new Set(
        param.properties
          .filter(
            (p) =>
              p.type === "Property" && p.key && p.key.type === "Identifier",
          )
          .map((p) => p.key.name),
      );

      // Get the rest parameter name for direct usage check
      const restParam = param.properties.find((p) => p.type === "RestElement");
      const restParamName = restParam ? restParam.argument.name : null;

      // Check if rest parameter is propagated to other functions
      const isRestPropagated = restParamName
        ? isRestParameterPropagated(
            functionDef,
            restParamName,
            functionDefinitions,
          )
        : false;

      // If rest is not propagated anywhere, we can't track parameter usage
      if (!isRestPropagated) {
        // Let no-unused-vars handle unused rest params
        continue;
      }

      // Collect all given parameters
      const givenParams = arg.properties
        .filter((p) => p.key && p.key.type === "Identifier")
        .map((p) => p.key.name);

      // Check properties that would go into rest
      for (const prop of arg.properties) {
        if (prop.key && prop.key.type === "Identifier") {
          const keyName = prop.key.name;
          if (!explicitProps.has(keyName)) {
            // This property goes into rest - check if it's used in chaining
            const chainResult = checkParameterChaining(
              keyName,
              functionDef,
              functionDefinitions,
            );

            if (!chainResult.found) {
              const { messageId, data, autofixes } = generateErrorMessage(
                keyName,
                funcName,
                chainResult.chain,
                functionDef,
                functionDefinitions,
                givenParams,
              );

              const fixes = [];
              if (autofixes.remove) {
                fixes.push((fixer) => createRemoveFix(fixer, prop));
              }
              if (autofixes.rename) {
                fixes.push((fixer) =>
                  createRenameFix(fixer, prop, autofixes.rename),
                );
              }

              // Only provide suggestions if we have a good rename candidate
              const shouldSuggest = fixes.length > 1 && autofixes.rename;

              context.report({
                node: prop,
                messageId,
                data,
                fix: fixes.length > 0 ? fixes[0] : undefined,
                suggest: shouldSuggest
                  ? [
                      {
                        desc: `Remove '${keyName}'`,
                        fix: fixes[0],
                      },
                      {
                        desc: `Rename '${keyName}' to '${autofixes.rename}'`,
                        fix: fixes[1],
                      },
                    ]
                  : undefined,
              });
            }
          }
        }
      }
      continue;
    }

    const allowedProps = new Set(
      param.properties
        .map((p) => (p.key && p.key.type === "Identifier" ? p.key.name : null))
        .filter((name) => name !== null),
    );

    // Collect all given parameters
    const givenParams = arg.properties
      .filter((p) => p.key && p.key.type === "Identifier")
      .map((p) => p.key.name);

    for (const prop of arg.properties) {
      if (prop.key && prop.key.type === "Identifier") {
        const keyName = prop.key.name;
        if (!allowedProps.has(keyName)) {
          // Check if this parameter is used through function chaining
          const chainResult = checkParameterChaining(
            keyName,
            functionDef,
            functionDefinitions,
          );

          if (!chainResult.found) {
            const { messageId, data, autofixes } = generateErrorMessage(
              keyName,
              funcName,
              chainResult.chain,
              functionDef,
              functionDefinitions,
              givenParams,
            );

            const fixes = [];
            if (autofixes.remove) {
              fixes.push((fixer) => createRemoveFix(fixer, prop));
            }
            if (autofixes.rename) {
              fixes.push((fixer) =>
                createRenameFix(fixer, prop, autofixes.rename),
              );
            }

            // Only provide suggestions if we have a good rename candidate
            const shouldSuggest = fixes.length > 1 && autofixes.rename;

            context.report({
              node: prop,
              messageId,
              data,
              fix: fixes.length > 0 ? fixes[0] : undefined,
              suggest: shouldSuggest
                ? [
                    {
                      desc: `Remove '${keyName}'`,
                      fix: fixes[0],
                    },
                    {
                      desc: `Rename '${keyName}' to '${autofixes.rename}'`,
                      fix: fixes[1],
                    },
                  ]
                : undefined,
            });
          }
        }
      }
    }
  }
}

// Function to resolve wrapper functions like forwardRef, memo, etc.
function resolveWrapperFunction(callExpression) {
  if (!callExpression || callExpression.type !== "CallExpression") {
    return null;
  }

  const callee = callExpression.callee;
  const args = callExpression.arguments;

  // No arguments means no wrapped function
  if (!args || args.length === 0) {
    return null;
  }

  const firstArg = args[0];

  // Check for React wrappers: forwardRef, memo
  if (callee.type === "Identifier") {
    const calleeName = callee.name;
    if (calleeName === "forwardRef" || calleeName === "memo") {
      return resolveArgumentToFunction(firstArg);
    }
  }

  // Check for React.forwardRef, React.memo
  if (
    callee.type === "MemberExpression" &&
    callee.object &&
    callee.object.type === "Identifier" &&
    callee.object.name === "React" &&
    callee.property &&
    callee.property.type === "Identifier"
  ) {
    const methodName = callee.property.name;
    if (methodName === "forwardRef" || methodName === "memo") {
      return resolveArgumentToFunction(firstArg);
    }
  }

  // Check for Function.prototype.bind
  if (
    callee.type === "MemberExpression" &&
    callee.property &&
    callee.property.type === "Identifier" &&
    callee.property.name === "bind"
  ) {
    // For bind, the original function signature is preserved
    // The function being bound is the object of the member expression
    return resolveArgumentToFunction(callee.object);
  }

  return null;
}

// Helper function to resolve an argument to a function definition
function resolveArgumentToFunction(arg) {
  if (!arg) return null;

  // Direct function expressions
  if (
    arg.type === "FunctionExpression" ||
    arg.type === "ArrowFunctionExpression"
  ) {
    return arg;
  }

  // Identifier referencing another function
  // Note: We'll need to resolve this during the analysis phase
  // when we have access to functionDefinitions
  if (arg.type === "Identifier") {
    return { type: "WrapperReference", name: arg.name };
  }

  return null;
}

// Function to resolve wrapper function references after all definitions are collected
function resolveWrapperReferences(functionDefinitions) {
  const wrapperReferences = new Map();

  // Find all wrapper references
  for (const [name, funcDef] of functionDefinitions.entries()) {
    if (funcDef && funcDef.type === "WrapperReference") {
      wrapperReferences.set(name, funcDef.name);
    }
  }

  // Resolve wrapper references to actual function definitions
  for (const [wrapperName, referencedName] of wrapperReferences.entries()) {
    const actualFunction = functionDefinitions.get(referencedName);
    if (actualFunction && actualFunction.type !== "WrapperReference") {
      functionDefinitions.set(wrapperName, actualFunction);
    }
  }
}

// Function to analyze a JSX element
function analyzeJSXElement(node, functionDefinitions, context) {
  const openingElement = node.openingElement;
  if (!openingElement || !openingElement.name) return;

  // Only handle JSXIdentifier (component names like <Toto />)
  if (openingElement.name.type !== "JSXIdentifier") return;

  const componentName = openingElement.name.name;
  const functionDef = functionDefinitions.get(componentName);

  if (!functionDef) return;

  const params = functionDef.params;
  if (params.length === 0 || openingElement.attributes.length === 0) return;

  // Assume first parameter is props object
  const param = params[0];
  if (param.type !== "ObjectPattern") return;

  // Check if this ObjectPattern has a rest element (...rest)
  const hasRestElement = param.properties.some((p) => p.type === "RestElement");

  // If there's a rest element, we need to check chaining to see if rest properties are actually used
  if (hasRestElement) {
    // Get explicitly declared parameters (not in rest)
    const explicitProps = new Set(
      param.properties
        .filter(
          (p) => p.type === "Property" && p.key && p.key.type === "Identifier",
        )
        .map((p) => p.key.name),
    );

    // Get the rest parameter name
    const restParam = param.properties.find((p) => p.type === "RestElement");
    const restParamName = restParam ? restParam.argument.name : null;

    // Check if rest parameter is propagated to other functions
    const isRestPropagated = restParamName
      ? isRestParameterPropagated(
          functionDef,
          restParamName,
          functionDefinitions,
        )
      : false;

    // If rest is not propagated anywhere, we can't track parameter usage
    if (!isRestPropagated) {
      // Let no-unused-vars handle unused rest params
      return;
    }

    // Collect all given JSX attributes
    const givenAttrs = openingElement.attributes
      .filter(
        (attr) =>
          attr.type === "JSXAttribute" &&
          attr.name &&
          attr.name.type === "JSXIdentifier",
      )
      .map((attr) => attr.name.name);

    // Check JSX attributes that would go into rest
    for (const attr of openingElement.attributes) {
      if (
        attr.type === "JSXAttribute" &&
        attr.name &&
        attr.name.type === "JSXIdentifier"
      ) {
        const attrName = attr.name.name;
        if (!explicitProps.has(attrName)) {
          // This attribute goes into rest - check if it's used in chaining
          const chainResult = checkParameterChaining(
            attrName,
            functionDef,
            functionDefinitions,
          );

          if (!chainResult.found) {
            const { messageId, data, autofixes } = generateErrorMessage(
              attrName,
              componentName,
              chainResult.chain,
              functionDef,
              functionDefinitions,
              givenAttrs,
            );

            const fixes = [];
            if (autofixes.remove) {
              fixes.push((fixer) => createJSXRemoveFix(fixer, attr));
            }
            if (autofixes.rename) {
              fixes.push((fixer) =>
                createJSXRenameFix(fixer, attr, autofixes.rename),
              );
            }

            // Only provide suggestions if we have a good rename candidate
            const shouldSuggest = fixes.length > 1 && autofixes.rename;

            context.report({
              node: attr,
              messageId,
              data,
              fix: fixes.length > 0 ? fixes[0] : undefined,
              suggest: shouldSuggest
                ? [
                    {
                      desc: `Remove '${attrName}'`,
                      fix: fixes[0],
                    },
                    {
                      desc: `Rename '${attrName}' to '${autofixes.rename}'`,
                      fix: fixes[1],
                    },
                  ]
                : undefined,
            });
          }
        }
      }
    }
    return;
  }

  // Handle regular props (no rest element)
  const allowedProps = new Set(
    param.properties
      .map((p) => (p.key && p.key.type === "Identifier" ? p.key.name : null))
      .filter((name) => name !== null),
  );

  // Collect all given JSX attributes
  const givenAttrs = openingElement.attributes
    .filter(
      (attr) =>
        attr.type === "JSXAttribute" &&
        attr.name &&
        attr.name.type === "JSXIdentifier",
    )
    .map((attr) => attr.name.name);

  for (const attr of openingElement.attributes) {
    if (
      attr.type === "JSXAttribute" &&
      attr.name &&
      attr.name.type === "JSXIdentifier"
    ) {
      const attrName = attr.name.name;
      if (!allowedProps.has(attrName)) {
        // Check if this parameter is used through function chaining
        const chainResult = checkParameterChaining(
          attrName,
          functionDef,
          functionDefinitions,
        );

        if (!chainResult.found) {
          const { messageId, data, autofixes } = generateErrorMessage(
            attrName,
            componentName,
            chainResult.chain,
            functionDef,
            functionDefinitions,
            givenAttrs,
          );

          const fixes = [];
          if (autofixes.remove) {
            fixes.push((fixer) => createJSXRemoveFix(fixer, attr));
          }
          if (autofixes.rename) {
            fixes.push((fixer) =>
              createJSXRenameFix(fixer, attr, autofixes.rename),
            );
          }

          // Only provide suggestions if we have a good rename candidate
          const shouldSuggest = fixes.length > 1 && autofixes.rename;

          context.report({
            node: attr,
            messageId,
            data,
            fix: fixes.length > 0 ? fixes[0] : undefined,
            suggest: shouldSuggest
              ? [
                  {
                    desc: `Remove '${attrName}'`,
                    fix: fixes[0],
                  },
                  {
                    desc: `Rename '${attrName}' to '${autofixes.rename}'`,
                    fix: fixes[1],
                  },
                ]
              : undefined,
          });
        }
      }
    }
  }
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing unknown params not recognized in function definition or call chain",
      category: "Possible Errors",
      recommended: false,
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [],
    messages: {
      notFoundParam: "{{param}} does not exist in {{func}}()",
      notFoundParamChain:
        "{{param}} does not exist in {{firstFunc}}() -> {{secondFunc}}()",
      notFoundParamLongChain:
        "{{param}} does not exist in {{firstFunc}}() -> ... -> {{lastFunc}}()",
      notFoundParamWithSuggestions:
        "{{param}} does not exist in {{func}}(). Did you mean: {{suggestions}}?",
      notFoundParamChainWithSuggestions:
        "{{param}} does not exist in {{firstFunc}}() -> {{secondFunc}}(). Available parameters: {{available}}.",
      notFoundParamChainLongWithSuggestions:
        "{{param}} does not exist in {{firstFunc}}() -> ... -> {{lastFunc}}(). Available parameters: {{available}}.",
      superfluousParam:
        "{{param}} is superfluous. {{func}}() only accepts: {{expected}}.",
      superfluousParamChain:
        "{{param}} is superfluous. {{firstFunc}}() -> {{secondFunc}}() only accepts: {{expected}}.",
      superfluousParamLongChain:
        "{{param}} is superfluous. {{firstFunc}}() -> ... -> {{lastFunc}}() only accepts: {{expected}}.",
    },
  },

  create(context) {
    const functionDefinitions = new Map();
    const callsToAnalyze = [];
    const jsxElementsToAnalyze = [];

    return {
      // Collect function definitions
      "FunctionDeclaration"(node) {
        if (node.id && node.id.name) {
          functionDefinitions.set(node.id.name, node);
        }
      },

      // Handle variable declarations with function expressions
      "VariableDeclarator"(node) {
        if (
          node.id &&
          node.id.type === "Identifier" &&
          node.init &&
          (node.init.type === "FunctionExpression" ||
            node.init.type === "ArrowFunctionExpression")
        ) {
          functionDefinitions.set(node.id.name, node.init);
        } else if (
          node.id &&
          node.id.type === "Identifier" &&
          node.init &&
          node.init.type === "CallExpression"
        ) {
          // Handle wrapper functions like forwardRef(Component), memo(Component)
          const wrappedFunction = resolveWrapperFunction(node.init);
          if (wrappedFunction) {
            functionDefinitions.set(node.id.name, wrappedFunction);
          }
        }
      },

      // Collect call expressions to analyze later
      "CallExpression"(node) {
        const callee = node.callee;

        if (callee.type !== "Identifier") return;

        callsToAnalyze.push(node);
      },

      // Collect JSX elements to analyze later
      "JSXElement"(node) {
        const openingElement = node.openingElement;
        if (!openingElement || !openingElement.name) return;

        // Only handle JSXIdentifier (component names like <Toto />)
        if (openingElement.name.type !== "JSXIdentifier") return;

        jsxElementsToAnalyze.push(node);
      },

      // Analyze all collected calls and JSX after collecting all function definitions
      "Program:exit"() {
        // First, resolve wrapper function references
        resolveWrapperReferences(functionDefinitions);

        // Process all collected function calls
        for (const callNode of callsToAnalyze) {
          analyzeCallExpression(callNode, functionDefinitions, context);
        }

        // Process all collected JSX elements
        for (const jsxNode of jsxElementsToAnalyze) {
          analyzeJSXElement(jsxNode, functionDefinitions, context);
        }
      },
    };
  },
};
