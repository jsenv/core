import stringWidth from "string-width";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { isAssertionError, createAssertionError } from "./assertion_error.js";

export const createAssert = ({ format = (v) => v } = {}) => {
  const assert = (...args) => {
    // param validation
    let firstArg;
    {
      if (args.length === 0) {
        throw new Error(
          `assert must be called with { actual, expected }, missing first argument`,
        );
      }
      if (args.length > 1) {
        throw new Error(
          `assert must be called with { actual, expected }, received too many arguments`,
        );
      }
      firstArg = args[0];
      if (typeof firstArg !== "object" || firstArg === null) {
        throw new Error(
          `assert must be called with { actual, expected }, received ${firstArg} as first argument instead of object`,
        );
      }
      if ("actual" in firstArg === false) {
        throw new Error(
          `assert must be called with { actual, expected }, missing actual property on first argument`,
        );
      }
      if ("expected" in firstArg === false) {
        throw new Error(
          `assert must be called with { actual, expected }, missing expected property on first argument`,
        );
      }
    }
    const { actual, expected, maxDepth = 5, maxColumns = 100 } = firstArg;
    const comparisonTree = createComparisonTree(expected, actual);
    const rootComparison = comparisonTree.root;
    const counters = {
      total: 0,
      displayed: 0,
    };
    const nodesWithDiffArray = [];

    const visit = (node) => {
      identity: {
        if (node.before.isPrimitive || node.after.isPrimitive) {
          if (node.before.value !== node.after.value) {
            if (
              !node.parent ||
              (!node.parent.diff.added && !node.parent.diff.removed)
            ) {
              counters.total++;
            }
            node.diff.identity = true;
            node.diff.counters.self++;
            node.diff.counters.total++;
          }
        }
      }
      reference: {
        if (node.before.reference !== node.after.reference) {
          node.diff.reference = true;
          node.diff.counters.self++;
          node.diff.counters.total++;
        }
      }
      properties: {
        // here we want to traverse before and after but if they are not composite
        // we'll consider everything as removed or added, depending the scenario
        const visitProperty = (property) => {
          const beforePropertyDescriptor = node.before.isComposite
            ? Object.getOwnPropertyDescriptor(node.before.value, property)
            : null;
          const afterPropertyDescriptor = node.after.isComposite
            ? Object.getOwnPropertyDescriptor(node.after.value, property)
            : null;
          const propertyNode = node.appendProperty(property, {
            beforeValue: beforePropertyDescriptor,
            afterValue: afterPropertyDescriptor,
          });

          const added = !beforePropertyDescriptor;
          const removed = !afterPropertyDescriptor;

          if (added) {
            propertyNode.diff.added = true;
            propertyNode.diff.counters.self++;
          }
          if (removed) {
            propertyNode.diff.removed = true;
            propertyNode.diff.counters.self++;
          }

          const visitPropertyDescriptor = (descriptorName) => {
            const descriptorBeforeValue = added
              ? undefined
              : beforePropertyDescriptor[descriptorName];
            const descriptorAfterValue = removed
              ? undefined
              : afterPropertyDescriptor[descriptorName];
            const descriptorNode = propertyNode.appendPropertyDescriptor(
              descriptorName,
              {
                beforeValue: descriptorBeforeValue,
                afterValue: descriptorAfterValue,
              },
            );
            visit(descriptorNode);
            if (added) {
              descriptorNode.diff.added = true;
              descriptorNode.diff.counters.self++;
              descriptorNode.diff.counters.total++;
            } else if (removed) {
              descriptorNode.diff.removed = true;
              descriptorNode.diff.counters.self++;
              descriptorNode.diff.counters.total++;
            } else {
              propertyNode.diff.value = descriptorNode.diff;
              propertyNode.diff.counters.self +=
                descriptorNode.diff.counters.self;
              propertyNode.diff.counters.total +=
                descriptorNode.diff.counters.total;
            }
          };

          visitPropertyDescriptor("value");
          visitPropertyDescriptor("enumerable");
          visitPropertyDescriptor("writable");
          visitPropertyDescriptor("configurable");
          visitPropertyDescriptor("set");
          visitPropertyDescriptor("get");
          node.diff.counters.total += propertyNode.diff.counters.total;
        };
        if (
          node.before.isComposite &&
          // node.after.value is a reference: was already traversed
          // - prevent infinite recursion for circular structure
          // - prevent traversing a structure already known
          !node.before.reference
        ) {
          const beforePropertyNames = Object.getOwnPropertyNames(
            node.before.value,
          );
          for (const beforePropertyName of beforePropertyNames) {
            visitProperty(beforePropertyName);
          }
        }
        if (
          node.after.isComposite &&
          // node.after.value is a reference: was already traversed
          // - prevent infinite recursion for circular structure
          // - prevent traversing a structure already known
          !node.after.reference
        ) {
          const afterPropertyNames = Object.getOwnPropertyNames(
            node.after.value,
          );
          for (const afterPropertyName of afterPropertyNames) {
            if (node.properties[afterPropertyName]) {
              // already visited
              continue;
            }
            visitProperty(afterPropertyName);
          }
        }
      }

      if (node.diff.counters.self) {
        nodesWithDiffArray.push(node);
      }
    };
    visit(rootComparison);
    if (nodesWithDiffArray.length === 0) {
      return;
    }

    let signs = true;
    let refId = 1;
    let startNode = rootComparison;
    // if the first diff is too deep
    // we'll start, not from the rootComparison, but from a deeper node
    const firstNodeWithADiff = nodesWithDiffArray[0];

    if (firstNodeWithADiff.depth >= maxDepth && !rootComparison.diff.identity) {
      const nodesFromRootToTarget = [firstNodeWithADiff];
      let currentNode = firstNodeWithADiff;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const parentNode = currentNode.parent;
        if (parentNode) {
          nodesFromRootToTarget.unshift(parentNode);
          currentNode = parentNode;
        } else {
          break;
        }
      }
      let startNodeDepth = firstNodeWithADiff.depth - maxDepth - 1;
      let path = "";
      for (const node of nodesFromRootToTarget) {
        if (
          startNode === rootComparison &&
          node.type === "property_descriptor" &&
          node.depth > startNodeDepth
        ) {
          node.path = path;
          startNode = node;
          break;
        }
        const { type } = node;
        if (type === "root") {
        } else if (type === "property") {
          if (path !== "") path += ".";
          path += node.property;
        } else if (type === "property_descriptor") {
          if (node.descriptor !== "value") {
            path += `[[${node.descriptor}]]`;
          }
        }
      }
    }

    const writePropertyKey = (property, color) => {
      // todo: handle property that must be between quotes,
      // handle symbols
      return ANSI.color(property, color);
    };
    const writePropertyDescriptorDiff = (node, { mode, modified }) => {
      if (
        !node.diff.counters.self &&
        isDefaultDescriptor(node.descriptor, node.before.value)
      ) {
        return "";
      }
      let propertyDescriptorDiff = "";
      const relativeDepth = node.depth - startNode.depth;
      let indent = `  `.repeat(relativeDepth);
      let keyColor;
      let delimitersColor;

      if (mode === "removed") {
        if (isDefaultDescriptor(node.descriptor, node.before.value)) {
          return "";
        }
        if (signs) {
          propertyDescriptorDiff += ANSI.color("-", ANSI.RED);
          indent = indent.slice(1);
        }
        keyColor = delimitersColor = modified ? ANSI.GREY : ANSI.RED;
      }
      if (mode === "added") {
        if (isDefaultDescriptor(node.descriptor, node.after.value)) {
          return "";
        }
        if (signs) {
          propertyDescriptorDiff += ANSI.color("+", ANSI.GREEN);
          indent = indent.slice(1);
        }
        keyColor = delimitersColor = modified ? ANSI.GREY : ANSI.GREEN;
      }
      if (mode === "traverse") {
        keyColor = delimitersColor = ANSI.GREY;
      }

      propertyDescriptorDiff += indent;
      if (node !== startNode) {
        if (node.descriptor !== "value") {
          propertyDescriptorDiff += ANSI.color(node.descriptor, keyColor);
          propertyDescriptorDiff += " ";
        }
        const propertyKeyFormatted = writePropertyKey(node.property, keyColor);
        propertyDescriptorDiff += propertyKeyFormatted;
        propertyDescriptorDiff += ANSI.color(":", delimitersColor);
        propertyDescriptorDiff += " ";
      }
      const valueDiff = writeValueDiff(node, {
        mode,
        modified,
        maxWidth: maxColumns - stringWidth(propertyDescriptorDiff) - ",".length,
      });
      propertyDescriptorDiff += valueDiff;
      propertyDescriptorDiff += ANSI.color(",", delimitersColor);
      propertyDescriptorDiff += "\n";
      return propertyDescriptorDiff;
    };
    const writeValueDiff = (node, { mode, modified, maxWidth, collapsed }) => {
      if (
        !node.parent ||
        (!node.parent.diff.added && !node.parent.diff.removed)
      ) {
        if (mode === "removed") {
          counters.displayed++;
        }
        if (mode === "added" && !modified) {
          counters.displayed++;
        }
      }

      const valueName = mode === "added" ? "after" : "before";
      const valueInfo = node[valueName];
      const valueColor =
        mode === "removed"
          ? ANSI.RED
          : mode === "added"
            ? ANSI.GREEN
            : ANSI.GREY;
      // primitive
      if (valueInfo.isPrimitive) {
        const value = valueInfo.value;
        let valueDiff = JSON.stringify(value);
        if (valueDiff.length > maxWidth) {
          valueDiff = valueDiff.slice(0, maxWidth);
          valueDiff += "…";
        }
        return ANSI.color(valueDiff, valueColor);
      }

      // composite
      const delimitersColor =
        mode === "removed"
          ? ANSI.RED
          : mode === "added"
            ? ANSI.GREEN
            : ANSI.GREY;
      let compositeDiff = "";
      if (valueInfo.reference) {
        compositeDiff += ANSI.color(
          `<ref #${valueInfo.referenceId}>`,
          delimitersColor,
        );
      }
      if (valueInfo.referenceFromOthersSet.size) {
        compositeDiff += ANSI.color(`<ref #${refId}>`, delimitersColor);
        compositeDiff += " ";
      }
      const relativeDepth = node.depth - startNode.depth;
      let compositePrefix = ANSI.color("{", delimitersColor);
      let compositeBody = "";
      let compositeSuffix = ANSI.color("}", delimitersColor);
      properties_diff: {
        const propertyNames = Object.keys(node.properties);
        const propertyCount = propertyNames.length;
        if (propertyCount === 0) {
          break properties_diff;
        }
        const propertiesOverview = collapsed !== true;
        if (collapsed === undefined) {
          collapsed =
            relativeDepth >= maxDepth || node.diff.counters.total === 0;
        }
        if (collapsed) {
          if (propertiesOverview) {
            let propertiesDiff = "";
            let propertyDisplayedCount = 0;
            let lineWidth = "{  }".length;
            const remainingEstimatedLength = `...${propertyCount} props`.length;
            for (const property of propertyNames) {
              let propertyDiff = "";
              const propertyNode = node.properties[property];
              if (propertiesDiff.length === 0) {
                propertyDiff += " ";
              } else {
                propertyDiff += ANSI.color(",", delimitersColor);
                propertyDiff += " ";
              }
              propertyDiff += writePropertyKey(property, valueColor);
              propertyDiff += ANSI.color(":", delimitersColor);
              propertyDiff += " ";

              if (
                propertyNode.descriptors.get[valueName].value &&
                propertyNode.descriptors.set[valueName].value
              ) {
                propertyDiff += ANSI.color(`[get/set]`, valueColor);
              } else if (propertyNode.descriptors.get[valueName].value) {
                propertyDiff += ANSI.color(`[get]`, valueColor);
              } else if (propertyNode.descriptors.set[valueName].value) {
                propertyDiff += ANSI.color(`[set]`, valueColor);
              } else {
                propertyDiff += writeValueDiff(propertyNode.descriptors.value, {
                  mode,
                  collapsed: true,
                });
              }
              lineWidth += stringWidth(propertyDiff);
              if (lineWidth + remainingEstimatedLength > maxWidth) {
                const remainingProperties =
                  propertyCount - propertyDisplayedCount;
                if (remainingProperties) {
                  propertiesDiff += ANSI.color(
                    `...${remainingProperties} props`,
                    delimitersColor,
                  );
                }
                break;
              }
              propertiesDiff += propertyDiff;
              propertyDisplayedCount++;
            }
            compositeBody += propertiesDiff;
            compositeBody += " ";
          } else {
            compositePrefix = ANSI.color("Object(", delimitersColor);
            compositeSuffix = ANSI.color(")", delimitersColor);
            compositeBody += ANSI.color(`${propertyCount}`, delimitersColor);
          }
        } else {
          compositeBody += "\n";
          for (const property of propertyNames) {
            const propertyNode = node.properties[property];
            const descriptorNames = Object.keys(propertyNode.descriptors);
            for (const descriptorName of descriptorNames) {
              const descriptorNode = propertyNode.descriptors[descriptorName];
              compositeBody += writeDiff(descriptorNode);
            }
          }
          let indent = "  ".repeat(relativeDepth);
          if (signs) {
            if (mode === "added") {
              compositeBody += ANSI.color("+", ANSI.GREEN);
              indent = indent.slice(1);
            } else if (mode === "removed") {
              compositeBody += ANSI.color("-", ANSI.RED);
              indent = indent.slice(1);
            }
          }
          compositeBody += indent;
        }
      }
      compositeDiff += compositePrefix;
      compositeDiff += compositeBody;
      compositeDiff += compositeSuffix;
      return compositeDiff;
    };
    const writeDiff = (node) => {
      const method =
        node.type === "property_descriptor"
          ? writePropertyDescriptorDiff
          : writeValueDiff;

      if (node.diff.removed) {
        return method(node, { mode: "removed" });
      }
      if (node.diff.added) {
        return method(node, { mode: "added" });
      }
      if (node.diff.identity) {
        if (node === rootComparison) {
          signs = false;
        }
        let identityDiff = "";
        identityDiff += method(node, { mode: "removed", modified: true });
        if (node.type !== "property_descriptor") {
          identityDiff += "\n";
        }
        identityDiff += method(node, { mode: "added", modified: true });
        return identityDiff;
      }
      return method(node, { mode: "traverse" });
    };

    let diff = writeDiff(startNode);

    let message;
    if (rootComparison.diff.identity) {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} are different`;
    } else {
      message = `${ANSI.color("expected", ANSI.RED)} and ${ANSI.color("actual", ANSI.GREEN)} have ${counters.total} ${counters.total === 1 ? "difference" : "differences"}`;
    }
    message += ":";
    message += "\n\n";
    const infos = [];
    const diffNotDisplayed = counters.total - counters.displayed;
    if (diffNotDisplayed) {
      if (counters.displayed === 1) {
        infos.push(
          `to improve readability only ${counters.displayed} diff is displayed`,
        );
      } else {
        infos.push(
          `to improve readability only ${counters.displayed} diffs are displayed`,
        );
      }
    }
    if (startNode !== rootComparison) {
      infos.push(`diff starts at ${ANSI.color(startNode.path, ANSI.YELLOW)}`);
    }
    if (infos.length) {
      for (const info of infos) {
        message += `${UNICODE.INFO} ${info}`;
        message += "\n";
      }
      message += "\n";
    }
    message += `${diff}`;

    const error = new Error(message);
    error.name = "AssertionError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, assert);
    }
    throw error;
  };

  assert.format = format;
  assert.isAssertionError = isAssertionError;
  assert.createAssertionError = createAssertionError;

  return assert;
};

const isDefaultDescriptor = (descriptorName, descriptorValue) => {
  if (descriptorName === "enumerable" && descriptorValue === true) {
    return true;
  }
  if (descriptorName === "writable" && descriptorValue === true) {
    return true;
  }
  if (descriptorName === "configurable" && descriptorValue === true) {
    return true;
  }
  if (descriptorName === "get" && descriptorValue === undefined) {
    return true;
  }
  if (descriptorName === "set" && descriptorValue === undefined) {
    return true;
  }
  return false;
};

const createComparisonTree = (beforeValue, afterValue) => {
  let beforeRefId = 1;
  let afterRefId = 1;
  const beforeCompositeReferenceMap = new Map();
  const afterCompositeReferenceMap = new Map();

  const createComparisonNode = ({
    type,
    beforeValue,
    afterValue,
    parent,
    depth,
  }) => {
    const node = {
      type,
      parent,
      depth,
      before: {
        value: beforeValue,
        valueOf: () => {
          throw new Error("use before.value");
        },
        isComposite: isComposite(beforeValue),
        isPrimitive: isPrimitive(beforeValue),
        reference: null,
        referenceId: null,
        referenceFromOthersSet: new Set(),
      },
      after: {
        value: afterValue,
        valueOf: () => {
          throw new Error("use after.value");
        },
        isComposite: isComposite(afterValue),
        isPrimitive: isPrimitive(afterValue),
        reference: null,
        referenceId: null,
        referenceFromOthersSet: new Set(),
      },
      diff: {
        counters: {
          self: 0,
          total: 0,
        },
        identity: null,
      },
    };

    if (node.before.isComposite) {
      const beforeReference = beforeCompositeReferenceMap.get(beforeValue);
      node.before.reference = beforeReference;
      if (beforeReference) {
        beforeReference.before.referenceFromOthersSet.add(node);
        node.before.referenceId = beforeRefId;
        beforeRefId++;
      } else {
        beforeCompositeReferenceMap.set(beforeValue, node);
      }
    }
    if (node.after.isComposite) {
      const afterReference = afterCompositeReferenceMap.get(afterValue);
      node.after.reference = afterReference;
      if (afterReference) {
        afterReference.after.referenceFromOthersSet.add(node);
        node.after.referenceId = afterRefId;
        afterRefId++;
      } else {
        afterCompositeReferenceMap.set(afterValue, node);
      }
    }

    if (node.before.isComposite || node.after.isComposite) {
      node.diff.reference = null;

      node.properties = {};
      node.diff.properties = {};
      node.appendProperty = (property, { beforeValue, afterValue }) => {
        const propertyNode = createComparisonNode({
          type: "property",
          beforeValue,
          afterValue,
          parent: node,
          depth: depth + 1,
        });
        propertyNode.property = property;
        node.properties[property] = propertyNode;
        propertyNode.diff = {
          counters: {
            self: 0,
            total: 0,
          },
          added: false,
          removed: false,
          value: null,
          enumerable: null,
          writable: null,
          configurable: null,
          set: null,
          get: null,
        };
        node.diff.properties[property] = propertyNode.diff;

        propertyNode.descriptors = {
          value: null,
          enumerable: null,
          writable: null,
          configurable: null,
          set: null,
          get: null,
        };
        propertyNode.appendPropertyDescriptor = (
          name,
          { beforeValue, afterValue },
        ) => {
          const propertyDescriptorNode = createComparisonNode({
            type: "property_descriptor",
            beforeValue,
            afterValue,
            parent: propertyNode,
            depth: depth + 1,
          });
          propertyDescriptorNode.property = property;
          propertyDescriptorNode.descriptor = name;
          propertyNode.descriptors[name] = propertyDescriptorNode;
          return propertyDescriptorNode;
        };
        return propertyNode;
      };
    }
    return node;
  };

  const root = createComparisonNode({
    type: "root",
    beforeValue,
    afterValue,
    depth: 0,
  });

  return { root };
};

const isComposite = (value) => {
  if (value === null) return false;
  if (typeof value === "object") return true;
  if (typeof value === "function") return true;
  return false;
};

const isPrimitive = (value) => {
  return !isComposite(value);
};
