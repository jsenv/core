/*
 * - possibilité de s'arreter apres un certains nb de diff (et donc de stopper la boucle)
 * 
 * 1. array entries (indexed)
 * 2. set entries
 * 3. internal entries
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
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = {
  placeholder: "added_or_removed",
  meta: {},
};
const PLACEHOLDER_FOR_NOTHING = {
  placeholder: "nothing",
  meta: {},
};

export const assert = ({ actual, expect }) => {
  const rootActualNode = createNode({
    name: "actual",
    type: "root",
    value: actual,
  });
  const rootExpectNode = createNode({
    name: "expect",
    type: "root",
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
      reasons: createReasons(),
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
        for (const [
          actualOwnPropertyDescriptorEntry,
          expectOwnPropertyDescriptorEntry,
        ] of createOwnPropertyDescriptorEntryDualIterator(
          currentActualNode,
          currentExpectNode,
        )) {
          let descriptorKey;
          if (
            actualOwnPropertyDescriptorEntry ===
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED
          ) {
            onRemoved(expectOwnPropertyDescriptorEntry);
            descriptorKey = expectOwnPropertyDescriptorEntry.meta.descriptorKey;
          } else if (
            expectOwnPropertyDescriptorEntry ===
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED
          ) {
            onAdded(actualOwnPropertyDescriptorEntry);
            descriptorKey = actualOwnPropertyDescriptorEntry.meta.descriptorKey;
          } else {
            descriptorKey = actualOwnPropertyDescriptorEntry.meta.descriptorKey;
          }
          const actualOwnPropertyDescriptorValueNode =
            actualOwnPropertyDescriptorEntry.placeholder
              ? actualOwnPropertyDescriptorEntry
              : createNode({
                  type: "own_property_descriptor_value",
                  parent: currentActualNode,
                  depth: currentExpectNode.depth + 1,
                  value: actualOwnPropertyDescriptorEntry.value,
                });
          const expectOwnPropertyDescriptorValueNode =
            expectOwnPropertyDescriptorEntry.placeholder
              ? expectOwnPropertyDescriptorEntry
              : createNode({
                  type: "own_property_descriptor_value",
                  parent: currentExpectNode,
                  depth: currentActualNode.depth + 1,
                  value: expectOwnPropertyDescriptorEntry.value,
                });
          const ownPropertyDescriptorValueComparison = subcompare(
            actualOwnPropertyDescriptorValueNode,
            expectOwnPropertyDescriptorValueNode,
          );
          if (descriptorKey === "value") {
            const actualOwnPropertyIsEnumerable =
              actualOwnPropertyDescriptorEntry.meta.ownPropertyIsEnumerable;
            const expectOwnPropertyIsEnumerable =
              expectOwnPropertyDescriptorEntry.meta.ownPropertyIsEnumerable;
            if (
              !actualOwnPropertyIsEnumerable &&
              !expectOwnPropertyIsEnumerable &&
              !ownPropertyDescriptorValueComparison.hasAnyDiff
            ) {
              // keep it hidden
              continue;
            }
          }
          const actualOwnPropertyKeyNode =
            actualOwnPropertyDescriptorEntry.placeholder
              ? actualOwnPropertyDescriptorEntry
              : createNode({
                  type: "own_property_key",
                  parent: currentActualNode,
                  depth: currentExpectNode.depth + 1,
                  value: actualOwnPropertyDescriptorEntry.meta.ownPropertyKey,
                });
          const expectOwnPropertyKeyNode =
            expectOwnPropertyDescriptorEntry.placeholder
              ? expectOwnPropertyDescriptorEntry
              : createNode({
                  type: "own_property_key",
                  parent: currentExpectNode,
                  depth: currentExpectNode.depth + 1,
                  value: expectOwnPropertyDescriptorEntry.meta.ownPropertyKey,
                });
          const ownPropertyKeyComparison = subcompare(
            actualOwnPropertyKeyNode,
            expectOwnPropertyKeyNode,
          );

          appendDiff("\n");
          const propertyDepth =
            actualOwnPropertyKeyNode.depth || expectOwnPropertyKeyNode.depth;
          const indentForProperty = "  ".repeat(propertyDepth);
          appendDiff(indentForProperty);
          if (descriptorKey !== "value") {
            const actualDescriptorKeyNode =
              actualOwnPropertyDescriptorEntry.placeholder
                ? actualOwnPropertyDescriptorEntry
                : createNode({
                    type: "descriptor_key",
                    parent: actualNode,
                    depth: actualNode.depth + 1,
                    value: descriptorKey,
                  });
            const expectDescriptorKeyNode =
              expectOwnPropertyDescriptorEntry.placeholder
                ? expectOwnPropertyDescriptorEntry
                : createNode({
                    type: "descriptor_key",
                    parent: expectNode,
                    depth: expectNode.depth + 1,
                    value: descriptorKey,
                  });
            const descriptorKeyComparison = appendDiff(
              actualDescriptorKeyNode,
              expectDescriptorKeyNode,
            );
            appendDiff(descriptorKeyComparison);
            appendDiff(" ");
          }
          appendDiff(ownPropertyKeyComparison);
          appendDiff((node) => node.propertyMiddleDelimiter);
          appendDiff(" ");
          appendDiff(ownPropertyDescriptorValueComparison);
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
        expectNode === PLACEHOLDER_FOR_NOTHING
      ) {
        currentExpectNode = PLACEHOLDER_FOR_NOTHING;
        visitOne(actualNode);
        currentExpectNode = expectNode;
        break visit;
      }
      // actual is added or expected to be missing
      if (
        actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED ||
        actualNode === PLACEHOLDER_FOR_NOTHING
      ) {
        currentActualNode = PLACEHOLDER_FOR_NOTHING;
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
        currentExpectNode = PLACEHOLDER_FOR_NOTHING;
        comparePrimitive();
        currentExpectNode = expectNode;
        currentActualNode = PLACEHOLDER_FOR_NOTHING;
        compareComposite();
        currentActualNode = actualNode;
        break visit;
      }
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        currentExpectNode = PLACEHOLDER_FOR_NOTHING;
        compareComposite();
        currentExpectNode = expectNode;
        currentActualNode = PLACEHOLDER_FOR_NOTHING;
        comparePrimitive();
        currentActualNode = actualNode;
        break visit;
      }
    }

    const { self, inside, overall } = comparison.reasons;
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

const createNode = ({
  name,
  type,
  parent,
  value,
  depth = parent ? parent.depth : 0,
  meta = {},
}) => {
  if (name === undefined) name = parent.name;
  let isPrimitive = false;
  let isComposite = false;
  let valueStartDelimiter;
  let valueEndDelimiter;
  let propertyMiddleDelimiter;
  let propertyEndDelimiter;

  if (value === PLACEHOLDER_FOR_NOTHING) {
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
    value,
    meta,
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

function* createOwnPropertyDescriptorEntryDualIterator(actualNode, expectNode) {
  for (let [
    actualOwnPropertyDescriptorEntry,
    expectOwnPropertyDescriptorEntry,
  ] of allIterable([
    createOwnPropertyDescriptorEntryIterator(actualNode),
    createOwnPropertyDescriptorEntryIterator(expectNode),
  ])) {
    if (actualNode.placeholder) {
      yield [actualNode, expectOwnPropertyDescriptorEntry];
      continue;
    }
    if (expectNode.placeholder) {
      yield [actualOwnPropertyDescriptorEntry, expectNode];
      continue;
    }
    if (!actualOwnPropertyDescriptorEntry) {
      yield [
        PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
        expectOwnPropertyDescriptorEntry,
      ];
      continue;
    }
    if (!expectOwnPropertyDescriptorEntry) {
      yield [
        actualOwnPropertyDescriptorEntry,
        PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
      ];
      continue;
    }
    yield [actualOwnPropertyDescriptorEntry, expectOwnPropertyDescriptorEntry];
  }
}
function* createOwnPropertyDescriptorEntryIterator(node) {
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
      yield {
        type: "own_property_descriptor",
        key: `${ownPropertyName} ${descriptorKey}`,
        value: descriptorValue,
        meta: {
          ownPropertyKey: ownPropertyName,
          descriptorKey,
          ownPropertyIsEnumerable: ownPropertyDescriptor.enumerable,
          ownPropertyDescriptor,
        },
      };
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
  if (actualNode && expectNode === PLACEHOLDER_FOR_NOTHING) {
    return [unexpectColor, null];
  }
  if (expectNode && actualNode === PLACEHOLDER_FOR_NOTHING) {
    return [null, expectColor];
  }
  const actualValue = getter(actualNode);
  const expectValue = getter(expectNode);
  if (actualValue === expectValue) {
    return [sameColor, sameColor];
  }
  return [unexpectColor, expectColor];
};

const createReasons = () => {
  const overall = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };
  const self = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };
  const inside = {
    any: new Set(),
    modified: new Set(),
    removed: new Set(),
    added: new Set(),
  };

  return {
    overall,
    self,
    inside,
  };
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
