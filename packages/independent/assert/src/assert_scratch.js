/*
 * - possibilité de s'arreter apres un certains nb de diff (et donc de stopper la boucle)
 * - possibilité de démarer le diff a une depth donnée (lorsque la diff est profonde)
 * 
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
/**
 * When a js value CANNOT EXISTS in actual or expected
 * the missing Node is set to PLACEHOLDER_FOR_NOTHING
 * For example,
 * - actual is a primitive, it cannot have properties
 * - expect is a composite, it can have properties
 * -> result into something like this
 * actual: true {
 *   <a>PLACEHOLDER_FOR_NOTHING
 * }
 * expect: {
 *   <a>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_FOR_NOTHING = {
  placeholder: "nothing",
};
/**
 * When a js value DOES NOT EXISTS ANYMORE in actual or expected
 * the missing Node is set to PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * For example,
 * - actual has 2 properties: "a" and "b"
 * - expect has 2 propertie: "a" and "c"
 * -> result into something like this
 * actual: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>ownPropertyDescriptorEntry,
 *   <c>PLACEHOLDER_WHEN_ADDED_OR_REMOVED
 * },
 * expect: {
 *   <a>ownPropertyDescriptorEntry,
 *   <b>PLACEHOLDER_WHEN_ADDED_OR_REMOVED,
 *   <c>ownPropertyDescriptorEntry
 * }
 */
const PLACEHOLDER_WHEN_ADDED_OR_REMOVED = {
  placeholder: "added_or_removed",
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

  /*
   * Comparison are objects used to compare actualNode and expectNode
   * It is used to visit all the entry a js value can have
   * and progressively create a tree of node and comparison
   * as the visit progresses a diff is generated
   * In the process an other type of object is used called *Entry
   * The following entry exists:
   * - ownPropertyDescriptorEntry
   * - ownPropertySymbolEntry
   * - indexedEntry
   *   - array values
   *   - typed array values
   *   - string values
   * - internalEntry
   *   - url internal props
   *   - valueOf()
   *   - Symbol.toPrimitive()
   *   - function body
   *   - map keys and values
   *   - ....
   * Entry represent something that can be found in the js value
   * and can be associated with one or many node (js_value)
   * For example ownPropertyDescriptorEntry have 3 nodes:
   *   ownPropertyNameNode
   *   descriptorKeyNode
   *   descriptorValueNode
   */
  const compare = (actualNode, expectNode, isAbstract) => {
    let actualCurrentNode = actualNode;
    let expectCurrentNode = expectNode;

    const reasons = createReasons();
    const comparison = {
      isComparison: true,
      actualNode,
      expectNode,
      reasons,
      done: false,
      actualDiff: "",
      expectDiff: "",
      write: (value) => {
        if (typeof value === "string") {
          if (!actualNode.placeholder) {
            comparison.actualDiff += value;
          }
          if (!expectNode.placeholder) {
            comparison.expectDiff += value;
          }
          return;
        }
        if (typeof value === "function") {
          const [actualColor, expectColor] = pickColors(
            actualCurrentNode,
            expectCurrentNode,
            value,
          );
          if (!actualCurrentNode.placeholder) {
            const actualValue = value(actualNode);
            if (actualValue) {
              comparison.actualDiff +=
                actualValue.trim() === "" // cannot color blank chars
                  ? actualValue
                  : ANSI.color(actualValue, actualColor);
            }
          }
          if (!expectNode.placeholder) {
            const expectValue = value(expectNode);
            if (expectValue) {
              comparison.expectDiff +=
                expectValue.trim() === "" // cannot color blank chars
                  ? expectValue
                  : ANSI.color(expectValue, expectColor);
            }
          }
        }
        if (value && typeof value === "object") {
          if (value.isComparison) {
            comparison.actualDiff += value.actualDiff;
            comparison.expectDiff += value.expectDiff;
          } else {
            if (value.actual && !actualNode.placeholder) {
              comparison.actualDiff += value.actual();
            }
            if (value.expect && !expectNode.placeholder) {
              comparison.expectDiff += value.expect();
            }
          }
        }
      },
    };
    if (isAbstract) {
      return comparison;
    }

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
      comparison.write((node) => node.valueStartDelimiter);
      comparison.write((node) => JSON.stringify(node.value));
      comparison.write((node) => node.valueEndDelimiter);
    };
    const compareComposite = () => {
      own_properties: {
        comparison.write((node) => node.valueStartDelimiter);
        let actualHasAtLeastOneDisplayedEntry = false;
        let expectHasAtLeastOneDisplayedEntry = false;
        const ownPropertiesComparison = compare(
          actualCurrentNode,
          expectCurrentNode,
          true,
        );
        for (const [
          actualOwnPropertyDescriptorEntry,
          expectOwnPropertyDescriptorEntry,
        ] of createOwnPropertyDescriptorEntryDualIterator(
          actualCurrentNode,
          expectCurrentNode,
        )) {
          if (
            actualOwnPropertyDescriptorEntry ===
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED
          ) {
            onRemoved(expectOwnPropertyDescriptorEntry);
          } else if (
            expectOwnPropertyDescriptorEntry ===
            PLACEHOLDER_WHEN_ADDED_OR_REMOVED
          ) {
            onAdded(actualOwnPropertyDescriptorEntry);
          }
          const ownPropertyDescriptorComparison = compare(
            actualOwnPropertyDescriptorEntry,
            expectOwnPropertyDescriptorEntry,
          );
          const descriptorKey = actualOwnPropertyDescriptorEntry.placeholder
            ? expectOwnPropertyDescriptorEntry.descriptorKeyNode.value
            : actualOwnPropertyDescriptorEntry.descriptorKeyNode.value;
          const actualDescriptorValueNode =
            actualOwnPropertyDescriptorEntry.placeholder
              ? actualOwnPropertyDescriptorEntry
              : actualOwnPropertyDescriptorEntry.descriptorValueNode;
          const expectDescriptorValueNode =
            expectOwnPropertyDescriptorEntry.placeholder
              ? expectOwnPropertyDescriptorEntry
              : expectOwnPropertyDescriptorEntry.descriptorValueNode;
          const descriptorValueComparison = subcompare(
            actualDescriptorValueNode,
            expectDescriptorValueNode,
          );
          if (descriptorKey === "value") {
            const actualOwnPropertyIsEnumerable =
              actualOwnPropertyDescriptorEntry.ownPropertyIsEnumerable;
            const expectOwnPropertyIsEnumerable =
              expectOwnPropertyDescriptorEntry.ownPropertyIsEnumerable;
            if (
              !actualOwnPropertyIsEnumerable &&
              !expectOwnPropertyIsEnumerable &&
              !descriptorValueComparison.hasAnyDiff
            ) {
              // keep it hidden
              continue;
            }
          }
          const actualOwnPropertyNameNode =
            actualOwnPropertyDescriptorEntry.placeholder
              ? actualOwnPropertyDescriptorEntry
              : actualOwnPropertyDescriptorEntry.ownPropertyNameNode;
          const expectOwnProperyNameNode =
            expectOwnPropertyDescriptorEntry.placeholder
              ? expectOwnPropertyDescriptorEntry
              : expectOwnPropertyDescriptorEntry.ownPropertyNameNode;
          const ownPropertyNameComparison = subcompare(
            actualOwnPropertyNameNode,
            expectOwnProperyNameNode,
          );

          ownPropertyDescriptorComparison.write({
            // eslint-disable-next-line no-loop-func
            actual: () => {
              let leftSpacing = "";
              if (actualHasAtLeastOneDisplayedEntry) {
                leftSpacing += "\n";
              } else {
                actualHasAtLeastOneDisplayedEntry = true;
              }
              leftSpacing += "  ".repeat(actualOwnPropertyNameNode.depth);
              return leftSpacing;
            },
            // eslint-disable-next-line no-loop-func
            expect: () => {
              let leftSpacing = "";
              if (expectHasAtLeastOneDisplayedEntry) {
                leftSpacing += "\n";
              } else {
                expectHasAtLeastOneDisplayedEntry = true;
              }
              leftSpacing += "  ".repeat(expectOwnProperyNameNode.depth);
              return leftSpacing;
            },
          });
          if (descriptorKey !== "value") {
            const actualDescriptorKeyNode =
              actualOwnPropertyDescriptorEntry.placeholder
                ? actualOwnPropertyDescriptorEntry
                : actualOwnPropertyDescriptorEntry.descriptorKeyNode;
            const expectDescriptorKeyNode =
              expectOwnPropertyDescriptorEntry.placeholder
                ? expectOwnPropertyDescriptorEntry
                : expectOwnPropertyDescriptorEntry.descriptorKeyNode;
            const descriptorKeyComparison = subcompare(
              actualDescriptorKeyNode,
              expectDescriptorKeyNode,
            );
            ownPropertyDescriptorComparison.write(descriptorKeyComparison);
            ownPropertyDescriptorComparison.write(" ");
          }
          ownPropertyDescriptorComparison.write(ownPropertyNameComparison);
          ownPropertyDescriptorComparison.write(" ");
          ownPropertyDescriptorComparison.write(descriptorValueComparison);
          ownPropertyDescriptorComparison.write(() => ",");
          ownPropertiesComparison.write(ownPropertyDescriptorComparison);
        }
        comparison.write({
          actual: () => {
            if (!actualHasAtLeastOneDisplayedEntry) return "";
            let ownPropertiesDiff = "";
            ownPropertiesDiff += "\n";
            ownPropertiesDiff += "  ".repeat(actualCurrentNode.depth);
            ownPropertiesDiff += ownPropertiesComparison.actualDiff;
            ownPropertiesDiff += "\n";
            return ownPropertiesDiff;
          },
          expect: () => {
            if (!expectHasAtLeastOneDisplayedEntry) return "";
            let ownPropertiesDiff = "";
            ownPropertiesDiff += "\n";
            ownPropertiesDiff += "  ".repeat(expectCurrentNode.depth);
            ownPropertiesDiff += ownPropertiesComparison.expectDiff;
            ownPropertiesDiff += "\n";
            return ownPropertiesDiff;
          },
        });
        comparison.write((node) => node.valueEndDelimiter);
      }
    };

    visit: {
      // expect is removed or is expected to be missing
      if (expectNode.placeholder) {
        if (actualNode.isComposite) {
          compareComposite();
        } else {
          comparePrimitive();
        }
        break visit;
      }
      // actual is added or expected to be missing
      if (actualNode.placeholder) {
        if (expectNode.isComposite) {
          compareComposite();
        } else {
          comparePrimitive();
        }
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
        expectCurrentNode = PLACEHOLDER_FOR_NOTHING;
        comparePrimitive();
        expectCurrentNode = expectNode;
        actualCurrentNode = PLACEHOLDER_FOR_NOTHING;
        compareComposite();
        break visit;
      }
      if (actualNode.isComposite && expectNode.isPrimitive) {
        onSelfDiff("should_be_primitive");
        expectCurrentNode = PLACEHOLDER_FOR_NOTHING;
        compareComposite();
        expectCurrentNode = expectNode;
        actualCurrentNode = PLACEHOLDER_FOR_NOTHING;
        comparePrimitive();
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

/*
 * Node represent any js value.
 * These js value are compared and converted to a readable string
 * Node art part of a tree structure (parent/children) and contains many
 * information about the value such as
 * - Is it a primitive or a composite?
 * - Where does the value come from?
 *   - property key
 *   - property value
 *   - prototype value returned by Object.getPrototypeOf()
 *   - a map entry key
 * - And finally info useful to render the js value into a readable string
 */
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
  let valueStartDelimiter = "";
  let valueEndDelimiter = "";

  if (value === PLACEHOLDER_FOR_NOTHING) {
  } else if (value === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
  } else if (type === "own_property_name") {
    isPrimitive = true;
    valueEndDelimiter = ":";
  } else if (typeof value === "object") {
    isComposite = true;
    valueStartDelimiter = "{";
    valueEndDelimiter = "}";
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
        key: `${descriptorKey} ${ownPropertyName}`,
        descriptorKeyNode: createNode({
          type: "own_property_descriptor_key",
          parent: node,
          depth: node.depth + 1,
          value: descriptorKey,
        }),
        ownPropertyNameNode: createNode({
          type: "own_property_name",
          parent: node,
          depth: node.depth + 1,
          value: ownPropertyName,
        }),
        descriptorValueNode: createNode({
          type: "own_property_descriptor_value",
          parent: node,
          depth: node.depth + 1,
          value: descriptorValue,
        }),
        ownPropertyDescriptor,
        ownPropertyIsEnumerable: ownPropertyDescriptor.enumerable,
      };
    }
  }
}

const pickColors = (actualNode, expectNode, getter) => {
  if (actualNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
    return [null, removedColor];
  }
  if (expectNode === PLACEHOLDER_WHEN_ADDED_OR_REMOVED) {
    return [addedColor, null];
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
