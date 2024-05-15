/*
 * 1. wrapped value
      on veut vérifier qu'on peut comparer wrapped value
      en particulier entre primitive et composite
 */

import { ANSI } from "@jsenv/humanize";
import { allIterable } from "./iterable_helper.js";

const sameColor = ANSI.GREY;
const removedColor = ANSI.YELLOW;
const addedColor = ANSI.YELLOW;
const unexpectColor = ANSI.RED;
const expectColor = ANSI.GREEN;
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = { placeholder: true };
const PLACEHOLDER_WHEN_NULL = { placeholder: true };

export const assert = ({ actual, expect }) => {
  const rootActualNode = createNode({
    name: "actual",
    type: "root",
    depth: 0,
    value: actual,
  });
  const rootExpectNode = createNode({
    name: "expect",
    type: "root",
    depth: 0,
    value: expect,
  });

  const causeSet = new Set();
  const addCause = (comparison) => {
    causeSet.add(comparison);
  };

  const compare = (actualNode, expectNode) => {
    const comparison = {
      isComparison: true,
      actualDiff: "",
      expectDiff: "",
      actualNode,
      expectNode,
      reasons: {
        overall: {
          any: new Set(),
          modified: new Set(),
          removed: new Set(),
          added: new Set(),
        },
        self: {
          any: new Set(),
          modified: new Set(),
          removed: new Set(),
          added: new Set(),
        },
        inside: {
          any: new Set(),
          modified: new Set(),
          removed: new Set(),
          added: new Set(),
        },
      },
      done: false,
    };

    let currentActualNode = actualNode;
    let currentExpectNode = expectNode;

    const appendDiff = (value) => {
      if (typeof value === "string") {
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += value;
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += value;
        }
        return;
      }
      if (Array.isArray(value)) {
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += value[0];
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += value[1];
        }
        return;
      }
      if (typeof value === "function") {
        const [actualColor, expectColor] = pickColors(
          currentActualNode,
          currentExpectNode,
          value,
        );
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += ANSI.color(
            value(currentActualNode),
            actualColor,
          );
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += ANSI.color(
            value(currentExpectNode),
            expectColor,
          );
        }
      }
      if (value && value.isComparison) {
        if (!currentActualNode.placeholder) {
          comparison.actualDiff += value.actualDiff;
        }
        if (!currentExpectNode.placeholder) {
          comparison.expectDiff += value.expectDiff;
        }
      }
    };

    const onAdded = (reason) => {
      comparison.reasons.self.added.add(reason);
    };
    const onRemoved = (reason) => {
      comparison.reasons.self.removed.add(reason);
    };
    const onSelfDiff = (reason) => {
      comparison.reasons.self.modified.add(reason);
      if (comparison.reasons.self.modified.size === 1) {
        addCause(comparison);
      }
    };
    const subcompare = (a, b) => {
      const childComparison = compare(a, b);
      appendReasonGroup(
        comparison.reasons.inside,
        childComparison.reasons.overall,
      );
      return childComparison;
    };

    const comparePrimitive = () => {
      appendDiff((node) => JSON.stringify(node.value));
    };
    const compareComposite = () => {
      own_properties: {
        appendDiff((node) => node.valueStartDelimiter);
        for (let [
          actualOwnPropertyDescriptorNode,
          expectOwnPropertyDescriptorNode,
        ] of allIterable([
          getOwnPropertyDescriptorNodeIterator(currentActualNode),
          getOwnPropertyDescriptorNodeIterator(currentExpectNode),
        ])) {
          if (!actualOwnPropertyDescriptorNode) {
            if (currentActualNode === PLACEHOLDER_WHEN_NULL) {
              actualOwnPropertyDescriptorNode = PLACEHOLDER_WHEN_NULL;
            } else {
              actualOwnPropertyDescriptorNode =
                PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
              onRemoved(expectOwnPropertyDescriptorNode);
            }
          } else if (!expectOwnPropertyDescriptorNode) {
            if (currentExpectNode === PLACEHOLDER_WHEN_NULL) {
              expectOwnPropertyDescriptorNode = PLACEHOLDER_WHEN_NULL;
            } else {
              expectOwnPropertyDescriptorNode =
                PLACEHOLDER_WHEN_ADDED_OR_REMOVED;
              onAdded(actualOwnPropertyDescriptorNode);
            }
          }

          const descriptorKey = actualOwnPropertyDescriptorNode.placeholder
            ? expectOwnPropertyDescriptorNode.key
            : actualOwnPropertyDescriptorNode.key;
          const ownPropertyDescriptorComparison = subcompare(
            actualOwnPropertyDescriptorNode,
            expectOwnPropertyDescriptorNode,
          );
          if (descriptorKey === "value") {
            const actualPropertyIsEnumerable =
              actualOwnPropertyDescriptorNode.ownPropertyIsEnumerable;
            const expectPropertyIsEnumerable =
              expectOwnPropertyDescriptorNode.ownPropertyIsEnumerable;
            if (
              !actualPropertyIsEnumerable &&
              !expectPropertyIsEnumerable &&
              !ownPropertyDescriptorComparison.hasAnyDiff
            ) {
              // keep it hidden
              continue;
            }
          }

          const ownPropertyKeyComparison = subcompare(
            actualOwnPropertyDescriptorNode.placeholder
              ? actualOwnPropertyDescriptorNode
              : createNode({
                  type: "own_property_key",
                  parent: actualOwnPropertyDescriptorNode,
                  value: actualOwnPropertyDescriptorNode.ownPropertyKey,
                }),
            expectOwnPropertyDescriptorNode.placeholder
              ? expectOwnPropertyDescriptorNode
              : createNode({
                  type: "own_property_key",
                  parent: expectOwnPropertyDescriptorNode,
                  value: expectOwnPropertyDescriptorNode.ownPropertyKey,
                }),
          );

          appendDiff("\n");
          const depth =
            actualOwnPropertyDescriptorNode.depth ||
            expectOwnPropertyDescriptorNode.depth;
          const indentForProperty = "  ".repeat(depth);
          appendDiff(indentForProperty);
          if (descriptorKey !== "value") {
            const descriptorKeyComparison = appendDiff(
              actualOwnPropertyDescriptorNode.placeholder
                ? actualOwnPropertyDescriptorNode
                : createNode({
                    type: "descriptor_key",
                    parent: actualOwnPropertyDescriptorNode,
                    value: descriptorKey,
                  }),
              expectOwnPropertyDescriptorNode.placeholder
                ? expectOwnPropertyDescriptorNode
                : createNode({
                    type: "descriptor_key",
                    parent: expectOwnPropertyDescriptorNode,
                    value: descriptorKey,
                  }),
            );
            appendDiff(descriptorKeyComparison);
            appendDiff(" ");
          }
          appendDiff(ownPropertyKeyComparison);
          appendDiff((node) => node.propertyMiddleDelimiter);
          appendDiff(" ");
          appendDiff(ownPropertyDescriptorComparison);
          appendDiff((node) => node.propertyEndDelimiter);
        }
        appendDiff("\n");
        const depth = currentActualNode.depth || currentExpectNode.depth;
        const indentForObject = "  ".repeat(depth);
        appendDiff(indentForObject);
        appendDiff((node) => node.valueEndDelimiter);
      }
    };
    const visitOne = (node) => {
      if (node.isComposite) {
        compareComposite();
      } else {
        comparePrimitive();
      }
    };

    visit: {
      // expect is removed or is expected to be missing
      if (
        expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED ||
        expectNode === PLACEHOLDER_WHEN_NULL
      ) {
        currentExpectNode = PLACEHOLDER_WHEN_NULL;
        visitOne(actualNode);
        currentExpectNode = expectNode;
        break visit;
      }
      // actual is added or expected to be missing
      if (
        actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED ||
        actualNode === PLACEHOLDER_WHEN_NULL
      ) {
        currentActualNode = PLACEHOLDER_WHEN_NULL;
        visitOne(expectNode);
        currentActualNode = actualNode;
        break visit;
      }
      // at this stage we are sure we got both actual and expect
      if (actualNode.isComposite && expectNode.isComposite) {
        if (actualNode.value === expectNode.value) {
          // we already know there will be no diff
          // but for now we'll still visit the composite constituents
        }
        compareComposite();
        break visit;
      }
      if (actualNode.isPrimitive && expectNode.isPrimitive) {
        if (actualNode.value === expectNode.value) {
          // we already know there will be no diff
          // but for now we'll still visit the primitive constituents
        } else {
          onSelfDiff("primitive_value");
        }
        comparePrimitive();
        break visit;
      }
      if (actualNode.isPrimitive && expectNode.isComposite) {
        onSelfDiff("should_be_composite");
        currentExpectNode = PLACEHOLDER_WHEN_NULL;
        comparePrimitive();
        currentExpectNode = expectNode;
        currentActualNode = PLACEHOLDER_WHEN_NULL;
        compareComposite();
        currentActualNode = actualNode;
        break visit;
      }
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        currentExpectNode = PLACEHOLDER_WHEN_NULL;
        compareComposite();
        currentExpectNode = expectNode;
        currentActualNode = PLACEHOLDER_WHEN_NULL;
        comparePrimitive();
        currentActualNode = actualNode;
        break visit;
      }
    }
    settleReasons(comparison);
    return comparison;
  };

  const rootComparison = compare(rootActualNode, rootExpectNode);
  if (!rootComparison.hasAnyDiff) {
    return;
  }

  let diff = ``;
  diff += ANSI.color("actual:", sameColor);
  diff += " ";
  diff += rootComparison.actualDiff;
  diff += `\n`;
  diff += ANSI.color("expect:", sameColor);
  diff += " ";
  diff += rootComparison.expectDiff;
  throw diff;
};

const settleReasons = (comparison) => {
  const { reasons } = comparison;
  const { self, inside, overall } = reasons;
  appendReasons(self.any, self.modified, self.removed, self.added);
  appendReasons(inside.any, inside.modified, inside.removed, inside.added);
  appendReasons(overall.removed, self.removed, inside.removed);
  appendReasons(overall.added, self.added, inside.added);
  appendReasons(overall.modified, self.modified, inside.modified);
  appendReasons(overall.any, self.any, inside.any);

  comparison.selfHasRemoval = self.removed.size > 0;
  comparison.selfHasAddition = self.added.size > 0;
  comparison.selfHasModification = self.modified.size > 0;
  comparison.hasAnyDiff = overall.any.size > 0;
  comparison.done = true;
};
const appendReasons = (reasonSet, ...otherReasonSets) => {
  for (const otherReasonSet of otherReasonSets) {
    for (const reason of otherReasonSet) {
      reasonSet.add(reason);
    }
  }
};
const appendReasonGroup = (reasonGroup, otherReasonGroup) => {
  appendReasons(reasonGroup.any, otherReasonGroup.any);
  appendReasons(reasonGroup.removed, otherReasonGroup.removed);
  appendReasons(reasonGroup.added, otherReasonGroup.added);
  appendReasons(reasonGroup.modified, otherReasonGroup.modified);
};

const createNode = ({
  name,
  type,
  parent,
  depth = parent.depth,
  key,
  value,
  ownPropertyKey,
  ownPropertyIsEnumerable,
}) => {
  if (name === undefined) name = parent.name;
  let isPrimitive = false;
  let isComposite = false;
  let valueStartDelimiter;
  let valueEndDelimiter;
  let propertyMiddleDelimiter;
  let propertyEndDelimiter;

  if (value === PLACEHOLDER_WHEN_NULL) {
  } else if (value === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
  } else if (typeof value === "object") {
    isComposite = true;
    valueStartDelimiter = "{";
    valueEndDelimiter = "}";
    propertyMiddleDelimiter = ":";
    propertyEndDelimiter = ",";
  } else {
    isPrimitive = true;
  }

  return {
    type,
    parent,
    depth,
    name,
    key,
    value,
    ownPropertyKey,
    ownPropertyIsEnumerable,
    // info
    isPrimitive,
    isComposite,
    // render info
    valueStartDelimiter,
    valueEndDelimiter,
    propertyMiddleDelimiter,
    propertyEndDelimiter,
  };
};

function* getOwnPropertyDescriptorNodeIterator(node) {
  if (node.placeholder) return;
  const ownPropertyNames = Object.getOwnPropertyNames(node.value);
  for (const ownPropertyName of ownPropertyNames) {
    const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(
      node.value,
      ownPropertyName,
    );
    ignore: {
      if (ownPropertyName === "prototype") {
        if (node.isFunction) {
          break ignore;
        }
        // ignore prototype if it's the default prototype
        // created by the runtime
        if (!Object.hasOwn(ownPropertyDescriptor, "value")) {
          break ignore;
        }
        const prototypeValue = ownPropertyDescriptor.value;
        if (node.isArrowFunction) {
          if (prototypeValue === undefined) {
            continue;
          }
          break ignore;
        }
        if (node.isAsyncFunction && !node.isGeneratorFunction) {
          if (prototypeValue === undefined) {
            continue;
          }
          break ignore;
        }
        const prototypeValueIsComposite = typeof prototypeValue === "object";
        if (!prototypeValueIsComposite) {
          break ignore;
        }
        const constructorDescriptor = Object.getOwnPropertyDescriptor(
          prototypeValue,
          "constructor",
        );
        if (!constructorDescriptor) {
          break ignore;
        }
        // the default prototype.constructor is
        // configurable, writable, non enumerable and got a value
        if (
          !constructorDescriptor.configurable ||
          !constructorDescriptor.writable ||
          constructorDescriptor.enumerable ||
          constructorDescriptor.set ||
          constructorDescriptor.get
        ) {
          break ignore;
        }
        const constructorValue = constructorDescriptor.value;
        if (constructorValue !== node.value) {
          break ignore;
        }
        const propertyNames = Object.getOwnPropertyNames(prototypeValue);
        if (propertyNames.length === 1) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "constructor") {
        // if (
        //   node.parent.key === "prototype" &&
        //   node.parent.parent.isFunction &&
        //   Object.hasOwn(ownPropertyDescriptor, "value") &&
        //   ownPropertyDescriptor.value === node.parent.parent.value
        // ) {
        continue;
        //  }
        //  break ignore;
      }
      if (ownPropertyName === "length") {
        if (node.canHaveIndexedValues || node.isFunction) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "name") {
        if (node.isFunction) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "stack") {
        if (node.isError) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "valueOf") {
        if (
          node.childNodes.wrappedValue &&
          node.childNodes.wrappedValue.key === "valueOf()"
        ) {
          continue;
        }
        break ignore;
      }
      if (ownPropertyName === "toString") {
        if (
          node.childNodes.wrappedValue &&
          node.childNodes.wrappedValue.key === "toString()"
        ) {
          continue;
        }
        break ignore;
      }
    }

    for (const descriptorKey of Object.keys(ownPropertyDescriptor)) {
      const descriptorValue = ownPropertyDescriptor[descriptorKey];
      ignore: {
        /* eslint-disable no-unneeded-ternary */
        if (descriptorKey === "writable") {
          if (node.propsFrozen) {
            continue;
          }
          const writableDefaultValue =
            ownPropertyName === "prototype" && node.isClass ? false : true;
          if (descriptorValue === writableDefaultValue) {
            continue;
          }
          break ignore;
        }
        if (descriptorKey === "configurable") {
          if (node.propsFrozen) {
            continue;
          }
          if (node.propsSealed) {
            continue;
          }
          const configurableDefaultValue =
            ownPropertyName === "prototype" && node.isFunction ? false : true;
          if (descriptorValue === configurableDefaultValue) {
            continue;
          }
          break ignore;
        }
        if (descriptorKey === "enumerable") {
          const enumerableDefaultValue =
            (ownPropertyName === "prototype" && node.isFunction) ||
            (ownPropertyName === "message" && node.isError) ||
            node.isClassPrototype
              ? false
              : true;
          if (descriptorValue === enumerableDefaultValue) {
            continue;
          }
          break ignore;
        }
        /* eslint-enable no-unneeded-ternary */
        if (descriptorKey === "get") {
          if (descriptorValue === undefined) {
            continue;
          }
          break ignore;
        }
        if (descriptorKey === "set") {
          if (descriptorValue === undefined) {
            continue;
          }
          break ignore;
        }
      }
      yield createNode({
        type: "own_property_descriptor",
        parent: node,
        depth: node.depth + 1,
        key: descriptorKey,
        value: descriptorValue,
        ownPropertyKey: ownPropertyName,
        ownPropertyIsEnumerable: ownPropertyDescriptor.enumerable,
      });
    }
  }
}

const pickColors = (actualNode, expectNode, getter) => {
  if (actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
    return [addedColor, null];
  }
  if (expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
    return [removedColor, null];
  }
  if (actualNode && expectNode === PLACEHOLDER_WHEN_NULL) {
    return [unexpectColor, null];
  }
  if (expectNode && actualNode === PLACEHOLDER_WHEN_NULL) {
    return [null, expectColor];
  }
  const actualValue = getter(actualNode);
  const expectValue = getter(expectNode);
  if (actualValue === expectValue) {
    return [sameColor, sameColor];
  }
  return [unexpectColor, expectColor];
};
