// Helper function to resolve wrapper functions like forwardRef(Component), memo(Component)
export function resolveWrapperFunction(callExpression) {
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
export function resolveArgumentToFunction(arg) {
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
export function resolveWrapperReferences(functionDefinitions) {
  const wrapperReferences = new Map();

  // Find all wrapper references
  for (const [name, funcDefWrapper] of functionDefinitions.entries()) {
    // Handle both old format (direct nodes) and new format (wrapper objects)
    const funcDef = funcDefWrapper?.node || funcDefWrapper;

    if (funcDef && funcDef.type === "WrapperReference") {
      wrapperReferences.set(name, funcDef.name);
    }
  }

  // Resolve wrapper references to actual function definitions
  for (const [wrapperName, referencedName] of wrapperReferences.entries()) {
    const actualFunctionWrapper = functionDefinitions.get(referencedName);
    const actualFunction = actualFunctionWrapper?.node || actualFunctionWrapper;

    if (actualFunction && actualFunction.type !== "WrapperReference") {
      // Store the resolved function in the same wrapper format
      const wrapperEntry = functionDefinitions.get(wrapperName);
      if (
        wrapperEntry &&
        typeof wrapperEntry === "object" &&
        wrapperEntry.node
      ) {
        // Update the node in the existing wrapper
        functionDefinitions.set(wrapperName, {
          ...wrapperEntry,
          node: actualFunction,
        });
      } else {
        // For backward compatibility with old format
        functionDefinitions.set(wrapperName, actualFunction);
      }
    }
  }
}
