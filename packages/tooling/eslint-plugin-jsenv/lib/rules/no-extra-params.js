// Helper function to analyze parameter propagation through function calls
function analyzeParameterPropagation(functionDef, functionDefinitions) {
  const propagations = [];

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
        // Check arguments for objects with spread elements
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
                spreadElements.push(prop.argument.name);
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
function isRestParameterPropagated(functionDef, restParamName) {
  let found = false;

  function traverse(node) {
    if (found) return;
    if (!node || typeof node !== "object") return;

    // Look for function calls where rest param is used in spread elements
    if (node.type === "CallExpression") {
      for (const arg of node.arguments) {
        if (arg.type === "ObjectExpression") {
          for (const prop of arg.properties) {
            if (
              prop.type === "SpreadElement" &&
              prop.argument &&
              prop.argument.type === "Identifier" &&
              prop.argument.name === restParamName
            ) {
              found = true;
              return;
            }
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
function checkParameterChaining(paramName, functionDef, functionDefinitions) {
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
                    // If target has rest element, consider parameter as potentially used
                    if (targetProp.type === "RestElement") {
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
              ? isRestParameterPropagated(functionDef, restParamName)
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
    };
  },
};
