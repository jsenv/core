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
            // Direct variable passing like: targetFunction(titi)
            // Resolve back to original variable (e.g., titi -> rest)
            const originalName = resolveToOriginalVariable(
              arg.name,
              renamingMap,
            );

            // Only add if this resolves to a different name (meaning it was renamed)
            if (originalName !== arg.name) {
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
) {
  // Avoid infinite recursion
  const functionKey =
    functionDef.id?.name || functionDef.parent?.id?.name || "anonymous";
  if (visited.has(functionKey)) {
    return false;
  }
  visited.add(functionKey);

  const propagations = analyzeParameterPropagation(
    functionDef,
    functionDefinitions,
  );

  for (const propagation of propagations) {
    const { targetFunctionDef, spreadElements, argumentIndex } = propagation;

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
                      return true; // Parameter is used in target function
                    }
                    // If target has rest element, recursively check its chain
                    if (targetProp.type === "RestElement") {
                      // Recursively check if this parameter is used further down the chain
                      const isUsedInChain = checkParameterChaining(
                        paramName,
                        targetFunctionDef,
                        functionDefinitions,
                        visited,
                      );
                      if (isUsedInChain) {
                        return true;
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

  return false;
}

// Helper function to find variable declarations in a function that match a name
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

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing extra params not used in function definition",
      category: "Possible Errors",
      recommended: false,
    },
    schema: [],
    messages: {
      extraParam: "'{{param}}' is passed but not used in '{{func}}'.",
    },
  },

  create(context) {
    const functionDefinitions = new Map();

    return {
      // Collect function definitions
      FunctionDeclaration(node) {
        if (node.id && node.id.name) {
          functionDefinitions.set(node.id.name, node);
        }
      },

      // Handle variable declarations with function expressions
      VariableDeclarator(node) {
        if (
          node.id &&
          node.id.type === "Identifier" &&
          node.init &&
          (node.init.type === "FunctionExpression" ||
            node.init.type === "ArrowFunctionExpression")
        ) {
          functionDefinitions.set(node.id.name, node.init);
        }
      },

      // Check call expressions
      CallExpression(node) {
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
                    p.type === "Property" &&
                    p.key &&
                    p.key.type === "Identifier",
                )
                .map((p) => p.key.name),
            );

            // Get the rest parameter name for direct usage check
            const restParam = param.properties.find(
              (p) => p.type === "RestElement",
            );
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

            // Check properties that would go into rest
            for (const prop of arg.properties) {
              if (prop.key && prop.key.type === "Identifier") {
                const keyName = prop.key.name;
                if (!explicitProps.has(keyName)) {
                  // This property goes into rest - check if it's used in chaining
                  const isUsedInChain = checkParameterChaining(
                    keyName,
                    functionDef,
                    functionDefinitions,
                  );

                  if (!isUsedInChain) {
                    context.report({
                      node: prop,
                      messageId: "extraParam",
                      data: { param: keyName, func: funcName },
                    });
                  }
                }
              }
            }
            continue;
          }

          const allowedProps = new Set(
            param.properties
              .map((p) =>
                p.key && p.key.type === "Identifier" ? p.key.name : null,
              )
              .filter((name) => name !== null),
          );

          for (const prop of arg.properties) {
            if (prop.key && prop.key.type === "Identifier") {
              const keyName = prop.key.name;
              if (!allowedProps.has(keyName)) {
                // Check if this parameter is used through function chaining
                const isUsedInChain = checkParameterChaining(
                  keyName,
                  functionDef,
                  functionDefinitions,
                );

                if (!isUsedInChain) {
                  context.report({
                    node: prop,
                    messageId: "extraParam",
                    data: { param: keyName, func: funcName },
                  });
                }
              }
            }
          }
        }
      },

      // Check JSX elements (equivalent to function calls)
      JSXElement(node) {
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
                  p.type === "Property" &&
                  p.key &&
                  p.key.type === "Identifier",
              )
              .map((p) => p.key.name),
          );

          // Get the rest parameter name
          const restParam = param.properties.find(
            (p) => p.type === "RestElement",
          );
          const restParamName = restParam ? restParam.argument.name : null;

          // Check if rest parameter is propagated to other functions
          const isRestPropagated = restParamName
            ? isRestParameterPropagated(functionDef, restParamName, functionDefinitions)
            : false;

          // If rest is not propagated anywhere, we can't track parameter usage
          if (!isRestPropagated) {
            // Let no-unused-vars handle unused rest params
            return;
          }

          // Check JSX attributes that would go into rest
          for (const attr of openingElement.attributes) {
            if (attr.type === "JSXAttribute" && attr.name && attr.name.type === "JSXIdentifier") {
              const attrName = attr.name.name;
              if (!explicitProps.has(attrName)) {
                // This attribute goes into rest - check if it's used in chaining
                const isUsedInChain = checkParameterChaining(
                  attrName,
                  functionDef,
                  functionDefinitions,
                );

                if (!isUsedInChain) {
                  context.report({
                    node: attr,
                    messageId: "extraParam",
                    data: { param: attrName, func: componentName },
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
            .map((p) =>
              p.key && p.key.type === "Identifier" ? p.key.name : null,
            )
            .filter((name) => name !== null),
        );

        for (const attr of openingElement.attributes) {
          if (attr.type === "JSXAttribute" && attr.name && attr.name.type === "JSXIdentifier") {
            const attrName = attr.name.name;
            if (!allowedProps.has(attrName)) {
              // Check if this parameter is used through function chaining
              const isUsedInChain = checkParameterChaining(
                attrName,
                functionDef,
                functionDefinitions,
              );

              if (!isUsedInChain) {
                context.report({
                  node: attr,
                  messageId: "extraParam",
                  data: { param: attrName, func: componentName },
                });
              }
            }
          }
        }
      },
    };
  },
};
