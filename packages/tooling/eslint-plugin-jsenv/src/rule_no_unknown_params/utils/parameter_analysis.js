// Helper function to build variable renaming map within a function
export function buildVariableRenamingMap(functionDef) {
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
export function resolveToOriginalVariable(varName, renamingMap) {
  let currentName = varName;
  const visited = new Set();

  while (renamingMap.has(currentName) && !visited.has(currentName)) {
    visited.add(currentName);
    currentName = renamingMap.get(currentName);
  }

  return currentName;
}

// Helper function to analyze parameter propagation through function calls
export function analyzeParameterPropagation(functionDef, functionDefinitions) {
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

      // Process propagations for both internal and external functions
      // For external functions, calledFunction will be null/undefined
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
          const originalName = resolveToOriginalVariable(arg.name, renamingMap);

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
export function isRestParameterPropagated(
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
