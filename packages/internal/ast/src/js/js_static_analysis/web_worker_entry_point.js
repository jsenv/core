import { findPropertyNodeByName, isStringLiteralNode } from "./helpers.js";
import {
  analyzeImportMetaResolveCall,
  isImportMetaResolveCall,
} from "./import_meta_resolve.js";
import { analyzeNewUrlCall, isNewUrlCall } from "./new_url.js";

export const isNewWorkerCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "Worker"
  );
};
export const analyzeNewWorkerCall = (node, { isJsModule, isNodeJs, onUrl }) => {
  analyzeWorkerCallArguments(node, {
    isJsModule,
    isNodeJs,
    onUrl,
    referenceSubtype: "new_worker_first_arg",
    expectedSubtype: "worker",
  });
};

export const isNewSharedWorkerCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "SharedWorker"
  );
};
export const analyzeNewSharedWorkerCall = (node, { isJsModule, onUrl }) => {
  analyzeWorkerCallArguments(node, {
    isJsModule,
    onUrl,
    referenceSubtype: "new_shared_worker_first_arg",
    expectedSubtype: "shared_worker",
  });
};

export const isServiceWorkerRegisterCall = (node) => {
  if (node.type !== "CallExpression") {
    return false;
  }
  const callee = node.callee;
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "register"
  ) {
    const parentObject = callee.object;
    if (parentObject.type === "MemberExpression") {
      const parentProperty = parentObject.property;
      if (
        parentProperty.type === "Identifier" &&
        parentProperty.name === "serviceWorker"
      ) {
        const grandParentObject = parentObject.object;
        if (grandParentObject.type === "MemberExpression") {
          // window.navigator.serviceWorker.register
          const grandParentProperty = grandParentObject.property;
          if (
            grandParentProperty.type === "Identifier" &&
            grandParentProperty.name === "navigator"
          ) {
            const ancestorObject = grandParentObject.object;
            if (
              ancestorObject.type === "Identifier" &&
              ancestorObject.name === "window"
            ) {
              return true;
            }
          }
        }
        if (grandParentObject.type === "Identifier") {
          // navigator.serviceWorker.register
          if (grandParentObject.name === "navigator") {
            return true;
          }
        }
      }
    }
  }
  return false;
};
export const analyzeServiceWorkerRegisterCall = (
  node,
  { isJsModule, onUrl },
) => {
  analyzeWorkerCallArguments(node, {
    isJsModule,
    onUrl,
    referenceSubtype: "service_worker_register_first_arg",
    expectedSubtype: "service_worker",
  });
};

const analyzeWorkerCallArguments = (
  node,
  { isJsModule, onUrl, referenceSubtype, expectedSubtype },
) => {
  let expectedType = "js_classic";
  let typePropertyNode;
  const secondArgNode = node.arguments[1];
  if (secondArgNode) {
    typePropertyNode = findPropertyNodeByName(secondArgNode, "type");
    if (typePropertyNode) {
      const typePropertyValueNode = typePropertyNode.value;
      if (isStringLiteralNode(typePropertyValueNode)) {
        const typePropertyValue = typePropertyValueNode.value;
        if (typePropertyValue === "module") {
          expectedType = "js_module";
        }
      }
    }
  }

  const firstArgNode = node.arguments[0];
  if (isStringLiteralNode(firstArgNode)) {
    const specifierNode = firstArgNode;
    onUrl({
      type: "js_url",
      subtype: referenceSubtype,
      expectedType,
      expectedSubtype,
      specifier: specifierNode.value,
      start: specifierNode.start,
      end: specifierNode.end,
      line: specifierNode.loc.start.line,
      column: specifierNode.loc.start.column,
      astInfo: {
        node,
        typePropertyNode,
      },
    });
    return;
  }
  if (isNewUrlCall(firstArgNode)) {
    analyzeNewUrlCall(firstArgNode, {
      isJsModule,
      onUrl: (info) => {
        info.astInfo.typePropertyNode = typePropertyNode;
        Object.assign(info, {
          expectedType,
          expectedSubtype,
        });
        onUrl(info);
      },
    });
    return;
  }
  if (isJsModule && isImportMetaResolveCall(firstArgNode)) {
    analyzeImportMetaResolveCall(firstArgNode, {
      onUrl: (info) => {
        info.astInfo.typePropertyNode = typePropertyNode;
        Object.assign(info, {
          expectedType,
          expectedSubtype,
        });
        onUrl(info);
      },
    });
    return;
  }
};
