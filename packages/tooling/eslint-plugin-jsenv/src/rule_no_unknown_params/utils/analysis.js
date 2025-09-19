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
  "key",      // Used by React for list reconciliation
  "ref",      // Used by React for ref forwarding
  "children", // Handled specially by JSX transform
]);

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
export function analyzeCallExpression(node, functionDefinitions, context) {
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
                context.getFilename(),
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
              context.getFilename(),
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

// Function to analyze a JSX element
export function analyzeJSXElement(node, functionDefinitions, context) {
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
          );

          if (!chainResult.found) {
            const { messageId, data, autofixes } = generateErrorMessage(
              attrName,
              componentName,
              chainResult.chain,
              functionDef,
              functionDefinitions,
              givenAttrs,
              context.getFilename(),
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
      
      // Skip React/JSX built-in props
      if (IGNORED_JSX_PROPS.has(attrName)) {
        continue;
      }
      
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
            context.getFilename(),
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
