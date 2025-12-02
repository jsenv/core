import {
  createJSXRemoveFix,
  createJSXRenameFix,
  createRemoveFix,
  createRenameFix,
} from "./autofix.js";
import { checkParameterChaining } from "./chaining.js";
import { generateErrorMessage } from "./messages.js";
import { isRestParameterPropagated } from "./parameter_analysis.js";

// React/JSX props that are handled by React itself and should be ignored
const IGNORED_JSX_PROPS = new Set([
  "key", // Used by React for list reconciliation
  "ref", // Used by React for ref forwarding
  "children", // Handled specially by JSX transform
]);

/**
 * Finds the correct function definition respecting lexical scoping rules
 * Uses ESLint's scope manager to properly handle scoping
 * @param {Object} callNode - The call expression node
 * @param {string} funcName - Function name to look for
 * @param {Map} functionDefinitions - Global function definitions map
 * @returns {Object|null} - Function definition wrapper or null
 */
function findFunctionInScope(callNode, funcName, functionDefinitions) {
  // For now, use a safer approach that doesn't rely on parent traversal
  // Check if there's a local function definition that would shadow imports

  // Look for block-scoped variable declarations in the same AST
  const sourceCode = callNode?.parent?.parent?.parent; // Try to get to a higher level
  if (sourceCode && sourceCode.type === "Program") {
    const localFunction = findLocalFunctionInAST(
      sourceCode,
      funcName,
      callNode,
    );
    if (localFunction) {
      return {
        node: localFunction,
        sourceFile: null,
      };
    }
  }

  // No local declaration found, use the global definition (import or top-level)
  return functionDefinitions.get(funcName);
}

/**
 * Searches for a local function declaration that would be in scope for the call
 * @param {Object} programNode - The program AST node
 * @param {string} funcName - Function name to find
 * @param {Object} callNode - The call expression node to check scope for
 * @returns {Object|null} - Function node or null
 */
function findLocalFunctionInAST(programNode, funcName, callNode) {
  // Simple heuristic: look for variable declarations in the same top-level block
  // This handles cases like: { const a = () => {}; a(); }

  function findInStatements(statements) {
    for (const stmt of statements) {
      if (stmt.type === "BlockStatement") {
        // Check if our call is within this block
        if (isNodeWithinBlock(callNode, stmt)) {
          const localFunc = findFunctionInStatements(stmt.body, funcName);
          if (localFunc) return localFunc;
        }
      } else if (stmt.type === "VariableDeclaration") {
        const localFunc = findFunctionInStatements([stmt], funcName);
        if (localFunc) return localFunc;
      }
    }
    return null;
  }

  return findInStatements(programNode.body || []);
}

/**
 * Checks if a node is within a block statement (simple range check)
 */
function isNodeWithinBlock(node, blockStmt) {
  if (!node.range || !blockStmt.range) return false;
  return (
    node.range[0] >= blockStmt.range[0] && node.range[1] <= blockStmt.range[1]
  );
}

/**
 * Searches for a local function declaration within statements
 * @param {Array} statements - Array of statement nodes
 * @param {string} funcName - Function name to find
 * @returns {Object|null} - Function node or null
 */
function findFunctionInStatements(statements, funcName) {
  for (const stmt of statements) {
    // Check variable declarations: const a = () => {}
    if (stmt.type === "VariableDeclaration") {
      for (const declarator of stmt.declarations) {
        if (
          declarator.id?.name === funcName &&
          (declarator.init?.type === "FunctionExpression" ||
            declarator.init?.type === "ArrowFunctionExpression")
        ) {
          return declarator.init;
        }
      }
    }

    // Check function declarations: function a() {}
    if (stmt.type === "FunctionDeclaration" && stmt.id?.name === funcName) {
      return stmt;
    }
  }

  return null;
}

// Helper function to find variable declarations in a function that match a name
export function findVariableDeclarationsInFunction(functionNode, varName) {
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
export function analyzeCallExpression(
  node,
  functionDefinitions,
  context,
  maxChainDepth = 40,
  options = {},
) {
  const callee = node.callee;

  if (callee.type !== "Identifier") return;

  const funcName = callee.name;

  // Find the correct function definition respecting lexical scope
  const functionDefWrapper = findFunctionInScope(
    node,
    funcName,
    functionDefinitions,
  );

  if (!functionDefWrapper) return;

  // Handle both wrapped format and direct node format for backward compatibility
  const functionDef = functionDefWrapper.node || functionDefWrapper;

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

  if (!functionDef.params) return;
  const params = functionDef.params;
  if (params.length === 0 || node.arguments.length === 0) return;

  // Reuse shared object pattern analysis logic
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const arg = node.arguments[i];
    if (
      param.type !== "ObjectPattern" ||
      !arg ||
      arg.type !== "ObjectExpression"
    ) {
      continue;
    }
    handleObjectPatternUnknownProps({
      param,
      objectEntries: arg.properties
        .filter((p) => p.key && p.key.type === "Identifier")
        .map((p) => ({
          node: p,
          name: p.key.name,
          createRemove: (fixer) => createRemoveFix(fixer, p),
          createRename: (fixer, newName) => createRenameFix(fixer, p, newName),
        })),
      functionDef,
      functionName: funcName,
      functionDefWrapper,
      functionDefinitions,
      context,
      maxChainDepth,
      options,
      givenNames: arg.properties
        .filter((p) => p.key && p.key.type === "Identifier")
        .map((p) => p.key.name),
    });
  }
}

// Function to analyze a JSX element
export function analyzeJSXElement(
  node,
  functionDefinitions,
  context,
  maxChainDepth = 40,
  options = {},
) {
  const openingElement = node.openingElement;
  if (!openingElement || !openingElement.name) return;

  // Only handle JSXIdentifier (component names like <Toto />)
  if (openingElement.name.type !== "JSXIdentifier") return;

  const componentName = openingElement.name.name;
  const functionDefWrapper = functionDefinitions.get(componentName);

  if (!functionDefWrapper) return;

  // Handle both wrapped format and direct node format for backward compatibility
  const functionDef = functionDefWrapper.node || functionDefWrapper;
  if (!functionDef || !functionDef.params) return;

  const params = functionDef.params;

  // If no attributes are passed, nothing to check
  if (openingElement.attributes.length === 0) return;

  // If component has no parameters but receives props, all props are invalid
  if (params.length === 0) {
    // Collect all given JSX attributes for error reporting
    const givenAttrs = openingElement.attributes
      .filter(
        (attr) =>
          attr.type === "JSXAttribute" &&
          attr.name &&
          attr.name.type === "JSXIdentifier",
      )
      .map((attr) => attr.name.name);

    // Report each non-React prop as invalid
    for (const attr of openingElement.attributes) {
      if (
        attr.type === "JSXAttribute" &&
        attr.name &&
        attr.name.type === "JSXIdentifier"
      ) {
        const attrName = attr.name.name;

        // Skip React/JSX built-in props
        if (IGNORED_JSX_PROPS.has(attrName)) {
          continue;
        }
        reportUnknownParam({
          name: attrName,
          entryNode: attr,
          chain: [], // No chaining for this scenario
          createRemove: (fixer) => createJSXRemoveFix(fixer, attr),
          createRename: (fixer, newName) =>
            createJSXRenameFix(fixer, attr, newName),
          functionDef,
          functionName: componentName,
          functionDefWrapper,
          functionDefinitions,
          context,
          maxChainDepth,
          options,
          givenNames: givenAttrs,
          allowChainRemovalSuggestion: false, // preserve previous behaviour
          isJSX: true,
        });
      }
    }
    return;
  }

  // Assume first parameter is props object
  const param = params[0];

  // Handle non-destructured parameter (e.g., props => <Thing {...props} />)
  if (param.type === "Identifier") {
    const paramName = param.name;

    // Check if this parameter is propagated to other components
    const isParamPropagated = isRestParameterPropagated(
      functionDef,
      paramName,
      functionDefinitions,
    );

    if (isParamPropagated) {
      // Collect all given JSX attributes
      const givenAttrs = openingElement.attributes
        .filter(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name &&
            attr.name.type === "JSXIdentifier",
        )
        .map((attr) => attr.name.name);

      // Check all JSX attributes through chaining
      for (const attr of openingElement.attributes) {
        if (
          attr.type === "JSXAttribute" &&
          attr.name &&
          attr.name.type === "JSXIdentifier"
        ) {
          const attrName = attr.name.name;

          // Skip React/JSX built-in props
          if (IGNORED_JSX_PROPS.has(attrName)) {
            continue;
          }

          // Check if this attribute is used in chaining
          const chainResult = checkParameterChaining(
            attrName,
            functionDef,
            functionDefinitions,
            new Set(),
            [],
            maxChainDepth,
          );

          if (!chainResult.found) {
            // Preserve previous behaviour: ignore actual chain for JSX identifier propagation
            // so messageId stays without chain unless rename candidate.
            reportUnknownParam({
              name: attrName,
              entryNode: attr,
              chain: [], // keep message simple
              chainForSuggestion: chainResult.chain, // use actual chain length for suggestion decision
              createRemove: (fixer) => createJSXRemoveFix(fixer, attr),
              createRename: (fixer, newName) =>
                createJSXRenameFix(fixer, attr, newName),
              functionDef,
              functionName: componentName,
              functionDefWrapper,
              functionDefinitions,
              context,
              maxChainDepth,
              options,
              givenNames: givenAttrs,
              allowChainRemovalSuggestion: true,
              isJSX: true,
            });
          }
        }
      }
    }
    return;
  }

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

        // Skip React/JSX built-in props
        if (IGNORED_JSX_PROPS.has(attrName)) {
          continue;
        }

        if (!explicitProps.has(attrName)) {
          // This attribute goes into rest - check if it's used in chaining
          const chainResult = checkParameterChaining(
            attrName,
            functionDef,
            functionDefinitions,
            new Set(),
            [],
            maxChainDepth,
          );

          if (!chainResult.found) {
            // Preserve previous behaviour: ignore actual chain for rest param JSX propagation
            reportUnknownParam({
              name: attrName,
              entryNode: attr,
              chain: [], // keep message simple
              chainForSuggestion: chainResult.chain,
              createRemove: (fixer) => createJSXRemoveFix(fixer, attr),
              createRename: (fixer, newName) =>
                createJSXRenameFix(fixer, attr, newName),
              functionDef,
              functionName: componentName,
              functionDefWrapper,
              functionDefinitions,
              context,
              maxChainDepth,
              options,
              givenNames: givenAttrs,
              allowChainRemovalSuggestion: true,
              isJSX: true,
            });
          }
        }
      }
    }
    return;
  }

  // Delegate to shared handler for regular props case
  handleObjectPatternUnknownProps({
    param,
    objectEntries: openingElement.attributes
      .filter(
        (attr) =>
          attr.type === "JSXAttribute" &&
          attr.name &&
          attr.name.type === "JSXIdentifier" &&
          !IGNORED_JSX_PROPS.has(attr.name.name),
      )
      .map((attr) => ({
        node: attr,
        name: attr.name.name,
        createRemove: (fixer) => createJSXRemoveFix(fixer, attr),
        createRename: (fixer, newName) =>
          createJSXRenameFix(fixer, attr, newName),
      })),
    functionDef,
    functionName: componentName,
    functionDefWrapper,
    functionDefinitions,
    context,
    maxChainDepth,
    options,
    givenNames: openingElement.attributes
      .filter(
        (attr) =>
          attr.type === "JSXAttribute" &&
          attr.name &&
          attr.name.type === "JSXIdentifier" &&
          !IGNORED_JSX_PROPS.has(attr.name.name),
      )
      .map((attr) => attr.name.name),
    isJSX: true,
  });
}

// Shared logic for object pattern parameter unknown property reporting (JSX & call expressions)
function handleObjectPatternUnknownProps({
  param,
  objectEntries,
  functionDef,
  functionName,
  functionDefWrapper,
  functionDefinitions,
  context,
  maxChainDepth,
  options,
  givenNames,
  isJSX = false,
}) {
  if (objectEntries.length === 0) return;

  const hasRestElement = param.properties.some((p) => p.type === "RestElement");
  if (hasRestElement) {
    const isOnlyRestParam =
      param.properties.length === 1 &&
      param.properties[0].type === "RestElement";
    if (isOnlyRestParam) {
      return; // accepts any params
    }
    const explicitProps = new Set(
      param.properties
        .filter(
          (p) => p.type === "Property" && p.key && p.key.type === "Identifier",
        )
        .map((p) => p.key.name),
    );
    const restParam = param.properties.find((p) => p.type === "RestElement");
    const restParamName = restParam ? restParam.argument.name : null;
    const isRestPropagated = restParamName
      ? isRestParameterPropagated(
          functionDef,
          restParamName,
          functionDefinitions,
        )
      : false;
    if (!isRestPropagated) return;

    for (const entry of objectEntries) {
      if (explicitProps.has(entry.name)) continue; // goes into explicit part
      reportIfUnknown({
        name: entry.name,
        entryNode: entry.node,
        createRemove: entry.createRemove,
        createRename: entry.createRename,
        functionDef,
        functionName,
        functionDefWrapper,
        functionDefinitions,
        context,
        maxChainDepth,
        options,
        givenNames,
        isJSX,
      });
    }
    return;
  }

  const allowedProps = new Set(
    param.properties
      .map((p) => (p.key && p.key.type === "Identifier" ? p.key.name : null))
      .filter((name) => name !== null),
  );

  for (const entry of objectEntries) {
    if (allowedProps.has(entry.name)) continue;
    reportIfUnknown({
      name: entry.name,
      entryNode: entry.node,
      createRemove: entry.createRemove,
      createRename: entry.createRename,
      functionDef,
      functionName,
      functionDefWrapper,
      functionDefinitions,
      context,
      maxChainDepth,
      options,
      givenNames,
      isJSX,
    });
  }
}

function reportIfUnknown({
  name,
  entryNode,
  createRemove,
  createRename,
  functionDef,
  functionName,
  functionDefWrapper,
  functionDefinitions,
  context,
  maxChainDepth,
  options,
  givenNames,
  isJSX = false,
}) {
  const chainResult = checkParameterChaining(
    name,
    functionDef,
    functionDefinitions,
    new Set(),
    [],
    maxChainDepth,
  );
  if (chainResult.found) return;
  reportUnknownParam({
    name,
    entryNode,
    chain: chainResult.chain,
    createRemove,
    createRename,
    functionDef,
    functionName,
    functionDefWrapper,
    functionDefinitions,
    context,
    maxChainDepth,
    options,
    givenNames,
    allowChainRemovalSuggestion: false,
    isJSX,
  });
}

// Centralized reporting logic for unknown params to remove duplication.
// allowChainRemovalSuggestion preserves older behaviour where removal suggestion
// is only shown (without rename) for chaining scenarios (or forced removal).
function reportUnknownParam({
  name,
  entryNode,
  chain, // chain used for message generation
  chainForSuggestion = chain, // can differ to keep messageId simple while still allowing chain-based suggestions
  createRemove,
  createRename,
  functionDef,
  functionName,
  functionDefWrapper,
  functionDefinitions,
  context,
  maxChainDepth,
  options,
  givenNames,
  allowChainRemovalSuggestion,
  isJSX = false,
}) {
  const errorMessage = generateErrorMessage(
    name,
    functionName,
    chain,
    functionDef,
    functionDefinitions,
    givenNames,
    context.getFilename(),
    maxChainDepth,
    functionDefWrapper.sourceFile,
    options,
    isJSX,
  );
  if (!errorMessage) return;
  const { messageId, data, autofixes, forceRemovalSuggestion } = errorMessage;
  const fixes = [];
  if (autofixes.remove) fixes.push((fixer) => createRemove(fixer));
  if (autofixes.rename)
    fixes.push((fixer) => createRename(fixer, autofixes.rename));
  const suggestionEntries = [];
  if (autofixes.rename && fixes[1]) {
    if (autofixes.remove && fixes[0]) {
      suggestionEntries.push({ desc: `Remove '${name}'`, fix: fixes[0] });
    }
    suggestionEntries.push({
      desc: `Rename '${name}' to '${autofixes.rename}'`,
      fix: fixes[1],
    });
  } else if (
    (allowChainRemovalSuggestion &&
      chainForSuggestion &&
      chainForSuggestion.length > 0) ||
    forceRemovalSuggestion
  ) {
    if (autofixes.remove && fixes[0]) {
      suggestionEntries.push({ desc: `Remove '${name}'`, fix: fixes[0] });
    }
  }
  context.report({
    node: entryNode,
    messageId,
    data,
    fix: fixes.length > 0 ? fixes[0] : undefined,
    suggest: suggestionEntries.length > 0 ? suggestionEntries : undefined,
  });
}
