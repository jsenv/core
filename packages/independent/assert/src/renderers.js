import { applyStyles, truncateAndApplyColor } from "./render_style.js";
import {
  SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY,
  VALUE_OF_RETURN_VALUE_ENTRY_KEY,
} from "./special_values.js";
import { getPropertyValueNode } from "./utils.js";

export const renderValue = (node, props) => {
  if (node.category === "primitive") {
    return renderPrimitive(node, props);
  }
  return renderComposite(node, props);
};
export const renderPrimitive = (node, props) => {
  if (props.columnsRemaining < 1) {
    return applyStyles(node, "…");
  }
  if (node.isSourceCode) {
    return truncateAndApplyColor("[source code]", node, props);
  }
  if (node.isUndefined) {
    return truncateAndApplyColor("undefined", node, props);
  }
  if (node.isString) {
    return renderString(node, props);
  }
  if (node.isSymbol) {
    return renderSymbol(node, props);
  }
  if (node.isNumber) {
    return renderNumber(node, props);
  }
  if (node.isBigInt) {
    return truncateAndApplyColor(`${node.value}n`, node, props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
export const renderString = (node, props) => {
  if (node.value === VALUE_OF_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("valueOf()", node, props);
  }
  if (node.value === SYMBOL_TO_PRIMITIVE_RETURN_VALUE_ENTRY_KEY) {
    return truncateAndApplyColor("[Symbol.toPrimitive()]", node, props);
  }
  const stringPartsNode = node.childNodeMap.get("parts");
  if (stringPartsNode) {
    return stringPartsNode.render(props);
  }
  const { quoteMarkerRef, value } = node;
  let diff = "";
  if (quoteMarkerRef) {
    const quoteToEscape = quoteMarkerRef.current;
    for (const char of value) {
      if (char === quoteToEscape) {
        diff += `\\${char}`;
      } else {
        diff += char;
      }
    }
  } else {
    diff += value;
  }
  return truncateAndApplyColor(diff, node, props);
};
export const renderEmptyValue = (node, props) => {
  return truncateAndApplyColor("empty", node, props);
};
export const renderChar = (node, props) => {
  let char = node.value;
  const { quoteMarkerRef } = node;
  if (quoteMarkerRef && char === quoteMarkerRef.current) {
    return truncateAndApplyColor(`\\${char}`, node, props);
  }
  const { stringCharMapping = stringCharMappingDefault } = node.renderOptions;
  if (stringCharMapping && stringCharMapping.has(char)) {
    char = stringCharMapping.get(char);
  }
  // if last char or followed solely by empty char
  return truncateAndApplyColor(char, node, props);
};
const CHAR_TO_ESCAPE = {
  "\b": "\\b",
  "\t": "\\t",
  "\n": "\\n",
  "\f": "\\f",
  "\r": "\\r",
  "\\": "\\\\",
  "\x00": "\\x00",
  "\x01": "\\x01",
  "\x02": "\\x02",
  "\x03": "\\x03",
  "\x04": "\\x04",
  "\x05": "\\x05",
  "\x06": "\\x06",
  "\x07": "\\x07",
  "\x0B": "\\x0B",
  "\x0E": "\\x0E",
  "\x0F": "\\x0F",
  "\x10": "\\x10",
  "\x11": "\\x11",
  "\x12": "\\x12",
  "\x13": "\\x13",
  "\x14": "\\x14",
  "\x15": "\\x15",
  "\x16": "\\x16",
  "\x17": "\\x17",
  "\x18": "\\x18",
  "\x19": "\\x19",
  "\x1A": "\\x1A",
  "\x1B": "\\x1B",
  "\x1C": "\\x1C",
  "\x1D": "\\x1D",
  "\x1E": "\\x1E",
  "\x1F": "\\x1F",
  "\x7F": "\\x7F",
  "\x83": "\\x83",
  "\x85": "\\x85",
  "\x86": "\\x86",
  "\x87": "\\x87",
  "\x88": "\\x88",
  "\x89": "\\x89",
  "\x8A": "\\x8A",
  "\x8B": "\\x8B",
  "\x8C": "\\x8C",
  "\x8D": "\\x8D",
  "\x8E": "\\x8E",
  "\x8F": "\\x8F",
  "\x90": "\\x90",
  "\x91": "\\x91",
  "\x92": "\\x92",
  "\x93": "\\x93",
  "\x94": "\\x94",
  "\x95": "\\x95",
  "\x96": "\\x96",
  "\x97": "\\x97",
  "\x98": "\\x98",
  "\x99": "\\x99",
  "\x9A": "\\x9A",
  "\x9B": "\\x9B",
  "\x9C": "\\x9C",
  "\x9D": "\\x9D",
  "\x9E": "\\x9E",
  "\x9F": "\\x9F",
};
const stringCharMappingDefault = new Map(Object.entries(CHAR_TO_ESCAPE));
export const renderNumber = (node, props) => {
  const numberCompositionNode = node.childNodeMap.get("composition");
  if (numberCompositionNode) {
    return numberCompositionNode.render(props);
  }
  return truncateAndApplyColor(JSON.stringify(node.value), node, props);
};
const renderSymbol = (node, props) => {
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  const symbolConstructNode = node.childNodeMap.get("symbol_construct");
  return symbolConstructNode.render(props);
};

const renderComposite = (node, props) => {
  // it's here that at some point we'll compare more than just own properties
  // because composite also got a prototype
  // and a constructor that might differ
  let diff = "";
  if (props.columnsRemaining < 2) {
    diff = applyStyles(node, "…");
    return diff;
  }
  const referenceNode = node.childNodeMap.get("reference");
  if (referenceNode) {
    return referenceNode.render(props);
  }
  const wellKnownNode = node.childNodeMap.get("well_known");
  if (wellKnownNode) {
    return wellKnownNode.render(props);
  }
  let maxDepthReached = false;
  const nodeDepth = getNodeDepth(node, props);
  if (node.diffType === "same") {
    maxDepthReached = nodeDepth > props.MAX_DEPTH;
  } else if (typeof props.firstDiffDepth === "number") {
    maxDepthReached =
      nodeDepth + props.firstDiffDepth > props.MAX_DEPTH_INSIDE_DIFF;
  } else {
    props.firstDiffDepth = nodeDepth;
    maxDepthReached = nodeDepth > props.MAX_DEPTH_INSIDE_DIFF;
  }

  const compositePartsNode = node.childNodeMap.get("parts");
  if (maxDepthReached || props.lightCauseSet.size > props.MAX_DIFF) {
    node.startMarker = node.endMarker = "";
    if (node.isStringObject) {
      const length = node.value.length;
      return truncateAndApplyColor(`${node.objectTag}(${length})`, node, props);
    }
    const indexedEntriesNode =
      compositePartsNode.childNodeMap.get("indexed_entries");
    if (indexedEntriesNode) {
      const length = indexedEntriesNode.childNodeMap.size;
      const childrenColor =
        pickColorFromChildren(indexedEntriesNode) || node.color;
      return truncateAndApplyColor(
        `${node.objectTag}(${length})`,
        node,
        props,
        {
          chirurgicalColor: {
            start: `${node.objectTag}(`.length,
            end: `${node.objectTag}(${length}`.length,
            color: childrenColor,
          },
        },
      );
    }
    const ownPropertiesNode =
      compositePartsNode.childNodeMap.get("own_properties");
    if (!ownPropertiesNode) {
      return truncateAndApplyColor(`${node.objectTag}`, node, props);
    }
    const ownPropertyCount = ownPropertiesNode.childNodeMap.size;
    const childrenColor =
      pickColorFromChildren(ownPropertiesNode) || node.color;
    return truncateAndApplyColor(
      `${node.objectTag}(${ownPropertyCount})`,
      node,
      props,
      {
        chirurgicalColor: {
          start: `${node.objectTag}(`.length,
          end: `${node.objectTag}(${ownPropertyCount}`.length,
          color: childrenColor,
        },
      },
    );
  }
  return compositePartsNode.render(props);
};
export const renderChildren = (node, props) => {
  const {
    hasMarkersWhenEmpty,
    focusedChildWhenSame = "first",
    separatorBetweenEachChildDisabled,
    hasSeparatorOnSingleChild,
    hasTrailingSeparator,
    hasSpacingAroundChildren,
    hasSpacingBetweenEachChild,
    skippedMarkers,
    skippedMarkersPlacement = "inside",
    childrenVisitMethod = "pick_around_starting_before",
  } = node.onelineDiff;
  let startSkippedMarker = "";
  let endSkippedMarker = "";
  if (skippedMarkers) {
    startSkippedMarker = skippedMarkers.start;
    endSkippedMarker = skippedMarkers.end;
    if (props.startSkippedMarkerDisabled) {
      startSkippedMarker = "";
    }
    if (props.endSkippedMarkerDisabled) {
      endSkippedMarker = "";
    }
  }
  const renderSkippedSection = (fromIndex, toIndex) => {
    let skippedMarker = fromIndex === 0 ? startSkippedMarker : endSkippedMarker;
    if (!skippedMarker) {
      return "";
    }
    // to pick the color we'll check each child
    let skippedChildIndex = fromIndex;
    let color = node.color;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        color = skippedChild.color;
        break;
      }
      if (skippedChild.diffType === "solo") {
        color = skippedChild.color;
      }
    }
    let diff = "";
    if (fromIndex > 0 && hasSpacingBetweenEachChild) {
      diff += " ";
    }
    diff += applyStyles(node, skippedMarker, { color });
    return diff;
  };

  const childrenKeys = node.childrenKeys;
  let columnsRemainingForChildren = props.columnsRemaining;
  if (columnsRemainingForChildren < 1) {
    return renderSkippedSection(0, childrenKeys.length - 1);
  }
  const { startMarker, endMarker } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let minIndex = -1;
  let maxIndex = Infinity;
  let { focusedChildIndex } = node;
  focused_child_index: {
    const { rangeToDisplay } = node;
    if (rangeToDisplay) {
      if (rangeToDisplay.min !== 0) {
        minIndex = rangeToDisplay.min;
      }
      // maxIndex = rangeToDisplay.end;
      focusedChildIndex = rangeToDisplay.start;
    } else if (focusedChildIndex === undefined) {
      const { firstChildWithDiffKey } = node;
      if (firstChildWithDiffKey === undefined) {
        // added/removed
        if (node.childComparisonDiffMap.size > 0) {
          focusedChildIndex = childrenKeys.length - 1;
          const { otherNode } = node;
          if (otherNode.placeholder) {
          } else if (otherNode.displayedRange) {
            minIndex = otherNode.displayedRange.min;
          } else {
            otherNode.render(props);
            minIndex = otherNode.displayedRange.min;
          }
        }
        // same
        else if (focusedChildWhenSame === "first") {
          focusedChildIndex = 0;
        } else if (focusedChildWhenSame === "last") {
          focusedChildIndex = childrenKeys.length - 1;
        } else {
          focusedChildIndex = Math.floor(childrenKeys.length / 2);
        }
      } else {
        focusedChildIndex = childrenKeys.indexOf(firstChildWithDiffKey);
      }
    }
  }
  let hasSomeChildSkippedAtStart = focusedChildIndex > 0;
  let hasSomeChildSkippedAtEnd = focusedChildIndex < childrenKeys.length - 1;
  const startSkippedMarkerWidth = startSkippedMarker.length;
  const endSkippedMarkerWidth = endSkippedMarker.length;
  const { separatorMarker, separatorMarkerWhenTruncated } = node;

  let boilerplate = "";
  boilerplate_space: {
    if (hasSomeChildSkippedAtStart) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate = `${startMarker} ${startSkippedMarker}`;
        } else {
          boilerplate = `${startMarker}${startSkippedMarker}`;
        }
      } else {
        boilerplate = `${startSkippedMarker}${startMarker}`;
      }
    } else {
      boilerplate = startMarker;
    }
    if (hasSomeChildSkippedAtEnd) {
      if (skippedMarkersPlacement === "inside") {
        if (hasSpacingAroundChildren) {
          boilerplate += `${endSkippedMarker} ${endMarker}`;
        } else {
          boilerplate += `${endSkippedMarker}${endMarker}`;
        }
      } else {
        boilerplate += `${endMarker}${endSkippedMarker}`;
      }
    } else {
      boilerplate += endMarker;
    }
    if (separatorMarker) {
      boilerplate += separatorMarker;
    }
    const columnsRemainingForChildrenConsideringBoilerplate =
      columnsRemainingForChildren - boilerplate.length;
    if (columnsRemainingForChildrenConsideringBoilerplate < 0) {
      return renderSkippedSection(0, childrenKeys.length - 1);
    }
    if (columnsRemainingForChildrenConsideringBoilerplate === 0) {
      return skippedMarkersPlacement === "inside"
        ? applyStyles(node, boilerplate)
        : renderSkippedSection(0, childrenKeys.length - 1);
    }
  }

  let childrenDiff = "";
  let tryToSwapSkipMarkerWithChild = false;
  let columnsNeededBySkipMarkers = 0;
  let isFirstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (isFirstAppend) {
      isFirstAppend = false;
      minIndexDisplayed = maxIndexDisplayed = childIndex;
      return childDiff;
    }
    if (childIndex < minIndexDisplayed) {
      minIndexDisplayed = childIndex;
    } else if (childIndex > maxIndexDisplayed) {
      maxIndexDisplayed = childIndex;
    }
    const isPrevious = childIndex < focusedChildIndex;
    if (isPrevious) {
      if (childrenDiff) {
        return `${childDiff}${childrenDiff}`;
      }
      return childDiff;
    }
    if (childrenDiff) {
      return `${childrenDiff}${childDiff}`;
    }
    return childDiff;
  };
  if (hasSpacingAroundChildren) {
    columnsRemainingForChildren -=
      `${startMarker}  ${endMarker}${separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker}`
        .length;
  } else {
    columnsRemainingForChildren -=
      `${startMarker}${endMarker}${separatorMarkerWhenTruncated ? separatorMarkerWhenTruncated : separatorMarker}`
        .length;
  }
  let minIndexDisplayed = Infinity;
  let maxIndexDisplayed = -1;
  for (const childIndex of generateChildIndexes(childrenKeys, {
    startIndex: focusedChildIndex,
    minIndex,
    maxIndex,
    childrenVisitMethod,
  })) {
    if (columnsRemainingForChildren <= 0) {
      break;
    }
    const childKey = childrenKeys[childIndex];
    const childNode = node.childNodeMap.get(childKey);
    if (!childNode) {
      // happens when forcing a specific range to be rendered
      continue;
    }
    const minIndexDisplayedCandidate =
      childIndex < minIndexDisplayed ? childIndex : minIndexDisplayed;
    const maxIndexDisplayedCandidate =
      childIndex > maxIndexDisplayed ? childIndex : maxIndexDisplayed;
    const hasSomeChildSkippedAtStartCandidate =
      minIndexDisplayedCandidate !== 0;
    const hasSomeChildSkippedAtEndCandidate =
      maxIndexDisplayedCandidate !== childrenKeys.length - 1;
    columnsNeededBySkipMarkers = 0;
    if (hasSomeChildSkippedAtStartCandidate) {
      columnsNeededBySkipMarkers += startSkippedMarkerWidth;
    }
    if (hasSomeChildSkippedAtEndCandidate) {
      if (hasSpacingBetweenEachChild) {
        columnsNeededBySkipMarkers += " ".length;
      }
      columnsNeededBySkipMarkers += endSkippedMarkerWidth;
    }
    let columnsRemainingForThisChild;
    if (tryToSwapSkipMarkerWithChild) {
      // "ab" makes more sense than "a…"
      // So if next child is the last and not too large
      // it will be allowed to fully replace the skip marker
      // But we must allow next child to take as much space as it needs
      // (hence we reset columnsRemainingForThisChild)
      // Otherwise it will be truncated and we'll think it take exactly the skip marker width
      // (That would lead to "http://example.com/dir/file.js" becoming "http://example/" instead of "http://example…")
      columnsRemainingForThisChild = props.columnsRemaining;
    } else {
      columnsRemainingForThisChild = columnsRemainingForChildren;
    }
    columnsRemainingForThisChild -= columnsNeededBySkipMarkers;
    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled,
    } = childNode;
    if (separatorMarkerDisabled) {
    } else if (
      separatorBetweenEachChildDisabled ||
      shouldDisableSeparator(childIndex, childrenKeys, {
        hasSeparatorOnSingleChild,
        hasTrailingSeparator,
      })
    ) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        disableSeparatorOnProperty(childNode);
      }
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarkerDisabled
        ? 0
        : separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    const canSkipMarkers =
      node.subgroup === "url_parts" ||
      node.subgroup === "date_parts" ||
      node.subgroup === "array_entries";
    let childDiff = childNode.render({
      ...props,
      columnsRemaining: columnsRemainingForThisChild,
      startSkippedMarkerDisabled:
        canSkipMarkers && hasSomeChildSkippedAtStart && startSkippedMarkerWidth,
      endSkippedMarkerDisabled:
        canSkipMarkers && hasSomeChildSkippedAtEnd && endSkippedMarkerWidth,
      separatorMarker,
      forceDisableSeparatorMarker: () => {
        separatorMarkerDisabled = true;
      },
    });
    if (childDiff === "" && childNode.subgroup !== "own_properties") {
      // child has been truncated (well we can't tell 100% this is the reason)
      // but for now let's consider this to be true
      break;
    }
    let childDiffWidth;
    const newLineFirstIndex = childDiff.indexOf("\n");
    if (newLineFirstIndex === -1) {
      childDiffWidth = node.context.measureStringWidth(childDiff);
    } else {
      const firstLine = childDiff.slice(0, newLineFirstIndex + "\n".length);
      childDiffWidth = node.context.measureStringWidth(firstLine);
    }
    let separatorMarkerToAppend;
    let separatorWhenTruncatedUsed = false;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarkerDisabled ? "" : separatorMarker;
    } else {
      const remainingColumns = columnsRemainingForChildren - childDiffWidth;
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled
          ? ""
          : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
        separatorWhenTruncatedUsed = true;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += applyStyles(node, separatorMarkerToAppend, {
          color: childNode.color,
        });
      } else {
        childDiffWidth += separatorMarkerToAppend.length;
        childDiff += applyStyles(node, separatorMarkerToAppend);
      }
    }
    if (!isFirstAppend && hasSpacingBetweenEachChild && childDiff) {
      if (childIndex < focusedChildIndex) {
        if (
          (childIndex > 0 || focusedChildIndex > 0) &&
          childrenDiff &&
          !childNode.hasRightSpacingDisabled
        ) {
          let shouldInjectSpacing = true;
          const nextChildIndex = childIndex + 1;
          const nextChildKey = childrenKeys[nextChildIndex];
          if (nextChildKey !== undefined) {
            const nextChildNode = node.childNodeMap.get(nextChildKey);
            if (nextChildNode.hasLeftSpacingDisabled) {
              shouldInjectSpacing = false;
            }
          }
          if (shouldInjectSpacing) {
            childDiffWidth += " ".length;
            childDiff = `${childDiff} `;
          }
        }
      } else if (!childNode.hasLeftSpacingDisabled) {
        let shouldInjectSpacing = true;
        const previousChildIndex = childIndex - 1;
        const previousChildKey = childrenKeys[previousChildIndex];
        if (previousChildKey !== undefined) {
          const previousChildNode = node.childNodeMap.get(previousChildKey);
          if (previousChildNode.hasRightSpacingDisabled) {
            shouldInjectSpacing = false;
          }
        }
        if (shouldInjectSpacing) {
          childDiffWidth += " ".length;
          childDiff = ` ${childDiff}`;
        }
      }
    }
    if (childDiffWidth > columnsRemainingForChildren) {
      break;
    }
    if (
      childDiffWidth + columnsNeededBySkipMarkers >
      columnsRemainingForChildren
    ) {
      break;
    }
    hasSomeChildSkippedAtStart = hasSomeChildSkippedAtStartCandidate;
    hasSomeChildSkippedAtEnd = hasSomeChildSkippedAtEndCandidate;
    const newLineLastIndex = childDiff.lastIndexOf("\n");
    if (newLineLastIndex === newLineFirstIndex) {
      columnsRemainingForChildren -= childDiffWidth;
    } else {
      const lastLine = childDiff.slice(newLineLastIndex + "\n".length);
      const childDiffLastLineWidth = node.context.measureStringWidth(lastLine);
      columnsRemainingForChildren =
        props.columnsRemaining - childDiffLastLineWidth;
    }
    childrenDiff = appendChildDiff(childDiff, childIndex);
    if (separatorWhenTruncatedUsed) {
      break;
    }
    // if I had to stop there, I would put some markers
    // so I need to reserve that space
    // if I have exactly the spot I can still try to replace
    // skip marker by the actual next/prev child
    // ONLY if it can replace the marker (it's the first/last child)
    // AND it does take less or same width as marker
    if (
      columnsNeededBySkipMarkers > 0 &&
      columnsNeededBySkipMarkers === columnsRemainingForChildren
    ) {
      if (tryToSwapSkipMarkerWithChild) {
        // can we try again?
        break;
      }
      tryToSwapSkipMarkerWithChild = true;
    }
  }
  node.displayedRange = {
    min: minIndexDisplayed,
    start: focusedChildIndex,
    max: maxIndexDisplayed,
  };
  if (minIndexDisplayed === Infinity || maxIndexDisplayed === -1) {
    return skippedMarkersPlacement === "inside"
      ? applyStyles(node, boilerplate)
      : renderSkippedSection(0, childrenKeys.length - 1);
  }
  let diff = "";
  if (hasSomeChildSkippedAtStart) {
    if (skippedMarkersPlacement === "inside") {
      if (startMarker) {
        diff += applyStyles(node, startMarker);
      }
      diff += renderSkippedSection(0, minIndexDisplayed);
    } else {
      diff += renderSkippedSection(0, minIndexDisplayed);
      if (startMarker) {
        diff += applyStyles(node, startMarker);
      }
    }
  } else if (startMarker) {
    diff += applyStyles(node, startMarker);
  }
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  diff += childrenDiff;
  if (hasSpacingAroundChildren) {
    diff += " ";
  }
  if (hasSomeChildSkippedAtEnd) {
    if (skippedMarkersPlacement === "inside") {
      diff += renderSkippedSection(
        maxIndexDisplayed + 1,
        childrenKeys.length - 1,
      );
      if (endMarker) {
        diff += applyStyles(node, endMarker);
      }
    } else {
      if (endMarker) {
        diff += applyStyles(node, endMarker);
      }
      diff += renderSkippedSection(
        maxIndexDisplayed + 1,
        childrenKeys.length - 1,
      );
    }
  } else if (endMarker) {
    diff += applyStyles(node, endMarker);
  }
  return diff;
};
function* generateChildIndexes(
  childrenKeys,
  {
    startIndex,
    minIndex,
    maxIndex,
    // "pick_around_starting_before"
    // "pick_around_starting_after"
    // "all_before_then_all_after"
    // "all_after_then_all_before"
    childrenVisitMethod,
  },
) {
  yield startIndex;
  if (childrenVisitMethod === "all_before_then_all_after") {
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    return;
  }
  if (childrenVisitMethod === "all_after_then_all_before") {
    let afterAttempt = 0;
    while (true) {
      const afterChildIndex = startIndex + afterAttempt + 1;
      if (afterChildIndex === maxIndex - 1) {
        break;
      }
      if (afterChildIndex >= childrenKeys.length) {
        break;
      }
      afterAttempt++;
      yield afterChildIndex;
    }
    let beforeAttempt = 0;
    while (true) {
      const beforeChildIndex = startIndex - beforeAttempt - 1;
      if (beforeChildIndex === minIndex - 1) {
        break;
      }
      if (beforeChildIndex < 0) {
        break;
      }
      beforeAttempt++;
      yield beforeChildIndex;
    }
    return;
  }
  let previousAttempt = 0;
  let nextAttempt = 0;
  let tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
  while (true) {
    const previousChildIndex = startIndex - previousAttempt - 1;
    const hasPreviousChild =
      previousChildIndex === minIndex - 1 ? false : previousChildIndex >= 0;
    const nextChildIndex = startIndex + nextAttempt + 1;
    const hasNextChild =
      nextChildIndex === maxIndex - 1
        ? false
        : nextChildIndex < childrenKeys.length;
    if (!hasPreviousChild && !hasNextChild) {
      break;
    }
    if (hasPreviousChild && hasNextChild) {
      if (tryBeforeFirst) {
        previousAttempt++;
        yield previousChildIndex;
        nextAttempt++;
        yield nextChildIndex;
      } else {
        nextAttempt++;
        yield nextChildIndex;
        previousAttempt++;
        yield previousChildIndex;
      }
    } else if (hasPreviousChild) {
      previousAttempt++;
      yield previousChildIndex;
      tryBeforeFirst = false;
    } else {
      nextAttempt++;
      yield nextChildIndex;
      tryBeforeFirst = childrenVisitMethod === "pick_around_starting_before";
    }
  }
}
export const renderChildrenMultilineWhenDiff = (node, props) => {
  if (node.diffType === "solo") {
    return renderChildrenMultiline(node, props);
  }
  if (node.childComparisonDiffMap.size > 0) {
    return renderChildrenMultiline(node, props);
  }
  return renderChildren(node, props);
};

/*
Rewrite "renderChildrenMultiline" so that:
- We start to render from the first child with a diff
and we discover around
then if we need to skip we append skipp stuff

the goal is that for lines we will first render the first line with a diff
as this line will impose to the surrounding lines where the focus will be
*/
export const renderChildrenMultiline = (node, props) => {
  const childrenKeys = node.childrenKeys;
  const {
    separatorBetweenEachChildDisabled = false,
    hasSeparatorOnSingleChild = true,
    hasTrailingSeparator,
    hasNewLineAroundChildren,
    hasIndentBeforeEachChild,
    hasIndentBetweenEachChild,
    hasMarkersWhenEmpty,
  } = node.multilineDiff;

  const otherNode = node.otherNode;
  let childIndexToDisplayArray;
  let firstDisplayedChildWithDiffIndex = -1;
  if (childrenKeys.length === 0) {
    childIndexToDisplayArray = [];
  } else if (childrenKeys.length === 1) {
    childIndexToDisplayArray = [0];
  } else {
    if (otherNode.placeholder) {
      setChildKeyToDisplaySetSolo(node, props);
    } else {
      setChildKeyToDisplaySetDuo(node, otherNode, props);
    }
    const childIndexToDisplayArrayRaw = [];
    const { childKeyToDisplaySet } = node;
    for (const childKeyToDisplay of childKeyToDisplaySet) {
      const childIndexToDisplay = childrenKeys.indexOf(childKeyToDisplay);
      if (firstDisplayedChildWithDiffIndex === -1) {
        const childNode = node.childNodeMap.get(childKeyToDisplay);
        if (childNode.comparison.hasAnyDiff) {
          firstDisplayedChildWithDiffIndex = childIndexToDisplay;
        }
      }
      childIndexToDisplayArrayRaw.push(childIndexToDisplay);
    }
    if (childIndexToDisplayArrayRaw.length === 0) {
      childIndexToDisplayArray =
        childrenKeys.length === 0
          ? []
          : childrenKeys.length === 1
            ? [0]
            : childrenKeys.length === 2
              ? [0, 1]
              : [];
    } else if (childIndexToDisplayArrayRaw.length === 1) {
      childIndexToDisplayArray = childIndexToDisplayArrayRaw;
      const singleChildIndexToDisplay = childIndexToDisplayArrayRaw[0];
      if (singleChildIndexToDisplay === 0) {
        childIndexToDisplayArray = childrenKeys.length === 2 ? [0, 1] : [0];
      } else if (singleChildIndexToDisplay === 1) {
        childIndexToDisplayArray =
          childrenKeys.length === 3 ? [0, 1, 2] : [0, 1];
      } else {
        childIndexToDisplayArray = childIndexToDisplayArrayRaw;
      }
    } else {
      childIndexToDisplayArrayRaw.sort((a, b) => a - b);
      let i = 1;
      let previousIndexDisplayed = childIndexToDisplayArrayRaw[0];
      childIndexToDisplayArray =
        previousIndexDisplayed === 1 ? [0, 1] : [previousIndexDisplayed];
      while (i < childIndexToDisplayArrayRaw.length) {
        const indexToDisplay = childIndexToDisplayArrayRaw[i];
        const gap = indexToDisplay - previousIndexDisplayed;
        if (gap === 2) {
          childIndexToDisplayArray.push(indexToDisplay - 1);
        }
        childIndexToDisplayArray.push(indexToDisplay);
        previousIndexDisplayed = indexToDisplay;
        i++;
      }
      if (previousIndexDisplayed === childrenKeys.length - 2) {
        childIndexToDisplayArray.push(previousIndexDisplayed + 1);
      }
    }
  }
  const focusedChildIndex =
    firstDisplayedChildWithDiffIndex === -1
      ? 0
      : firstDisplayedChildWithDiffIndex;
  if (node.beforeRender) {
    node.beforeRender(props, { focusedChildIndex, childIndexToDisplayArray });
  }
  const { startMarker, endMarker } = node;
  if (childrenKeys.length === 0) {
    if (!hasMarkersWhenEmpty) {
      node.startMarker = node.endMarker = "";
    }
    return truncateAndApplyColor("", node, props);
  }
  let childrenDiff = "";
  const renderedRange = { start: Infinity, end: -1 };
  let firstAppend = true;
  const appendChildDiff = (childDiff, childIndex) => {
    if (firstAppend) {
      firstAppend = false;
      renderedRange.start = renderedRange.end = childIndex;
      return childDiff;
    }
    if (childIndex < renderedRange.start) {
      renderedRange.start = childIndex;
      return `${childDiff}\n${childrenDiff}`;
    }
    renderedRange.end = childIndex;
    return `${childrenDiff}\n${childDiff}`;
  };
  const appendSkippedSection = (fromIndex, toIndex) => {
    const skippedMarkers = node.multilineDiff.skippedMarkers || {
      start: ["↑ 1 value ↑", "↑ {x} values ↑"],
      between: ["↕ 1 value ↕", "↕ {x} values ↕"],
      end: ["↓ 1 value ↓", "↓ {x} values ↓"],
    };
    const skippedCount = toIndex - fromIndex;
    let skippedChildIndex = fromIndex;
    let modifiedCount = 0;
    let soloCount = 0;
    let modifiedColor;
    let soloColor;
    while (skippedChildIndex !== toIndex) {
      skippedChildIndex++;
      const skippedChildKey = childrenKeys[skippedChildIndex];
      const skippedChild = node.childNodeMap.get(skippedChildKey);
      if (skippedChild.diffType === "modified") {
        modifiedCount++;
        modifiedColor = skippedChild.color;
      }
      if (skippedChild.diffType === "solo") {
        soloCount++;
        soloColor = skippedChild.color;
      }
    }
    const allModified = modifiedCount === skippedCount;
    const allSolo = soloCount === skippedCount;
    let skippedDiff = "";
    if (hasIndentBeforeEachChild) {
      skippedDiff += "  ".repeat(getNodeDepth(node, props) + 1);
    }
    let skippedMarker;
    if (fromIndex < renderedRange.start) {
      skippedMarker = skippedMarkers.start;
    } else {
      if (hasIndentBetweenEachChild) {
        skippedDiff += " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      }
      if (toIndex < childrenKeys.length - 1) {
        skippedMarker = skippedMarkers.between;
      } else {
        skippedMarker = skippedMarkers.end;
      }
    }
    if (skippedCount === 1) {
      skippedDiff += applyStyles(node, skippedMarker[0], {
        color: allModified ? modifiedColor : allSolo ? soloColor : node.color,
      });
    } else {
      skippedDiff += applyStyles(
        node,
        skippedMarker[1].replace("{x}", skippedCount),
        {
          color: allModified ? modifiedColor : allSolo ? soloColor : node.color,
        },
      );
    }
    const details = [];
    if (modifiedCount && modifiedCount !== skippedCount) {
      details.push(
        applyStyles(node, `${modifiedCount} modified`, {
          color: modifiedColor,
        }),
      );
    }
    if (soloCount && soloCount !== skippedCount) {
      details.push(
        node.context.name === "actual"
          ? applyStyles(node, `${soloCount} added`, { color: soloColor })
          : applyStyles(node, `${soloCount} removed`, { color: soloColor }),
      );
    }
    if (details.length) {
      skippedDiff += " ";
      skippedDiff += applyStyles(node, `(`);
      skippedDiff += details.join(", ");
      skippedDiff += applyStyles(node, `)`);
    }
    childrenDiff = appendChildDiff(
      skippedDiff,
      toIndex === childrenKeys.length - 1 ? toIndex : fromIndex,
    );
  };
  const renderChildDiff = (childNode, childIndex) => {
    let childDiff = "";
    let columnsRemainingForThisChild =
      childIndex > 0 || hasNewLineAroundChildren
        ? props.MAX_COLUMNS
        : props.columnsRemaining;
    if (hasIndentBeforeEachChild) {
      const indent = "  ".repeat(getNodeDepth(node, props) + 1);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }
    if (hasIndentBetweenEachChild && childIndex !== 0) {
      const indent = " ".repeat(props.MAX_COLUMNS - props.columnsRemaining);
      columnsRemainingForThisChild -= indent.length;
      childDiff += indent;
    }

    let {
      separatorMarker,
      separatorMarkerWhenTruncated,
      separatorMarkerDisabled,
    } = childNode;
    if (separatorMarkerDisabled) {
    } else if (
      separatorBetweenEachChildDisabled ||
      shouldDisableSeparator(childIndex, childrenKeys, {
        hasTrailingSeparator,
        hasSeparatorOnSingleChild,
      })
    ) {
      separatorMarkerDisabled = true;
      if (childNode.subgroup === "property_entry") {
        disableSeparatorOnProperty(childNode);
      }
    } else if (childNode.subgroup === "property_entry") {
      enableSeparatorOnSingleProperty(childNode);
    }
    if (separatorMarkerWhenTruncated === undefined) {
      columnsRemainingForThisChild -= separatorMarker.length;
    } else {
      columnsRemainingForThisChild -= separatorMarkerWhenTruncated.length;
    }
    if (childNode.subgroup === "line_entry_value") {
      if (childIndex === focusedChildIndex) {
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild,
        });
      } else {
        childNode.rangeToDisplay = focusedChildNode.displayedRange;
        childDiff += childNode.render({
          ...props,
          columnsRemaining: columnsRemainingForThisChild,
        });
      }
    } else {
      childDiff += childNode.render({
        ...props,
        columnsRemaining: columnsRemainingForThisChild,
      });
    }
    let separatorMarkerToAppend;
    if (separatorMarkerWhenTruncated === undefined) {
      separatorMarkerToAppend = separatorMarker;
    } else {
      const remainingColumns =
        columnsRemainingForThisChild -
        node.context.measureStringWidth(childDiff);
      if (remainingColumns > separatorMarker.length + 1) {
        separatorMarkerToAppend = separatorMarkerDisabled
          ? ""
          : separatorMarker;
      } else {
        separatorMarkerToAppend = separatorMarkerWhenTruncated;
      }
    }
    if (separatorMarkerToAppend) {
      if (childNode.diffType === "solo") {
        childDiff += applyStyles(node, separatorMarkerToAppend, {
          color: childNode.color,
        });
      } else {
        childDiff += applyStyles(node, separatorMarkerToAppend);
      }
    }
    return childDiff;
  };
  const focusedChildKey = childrenKeys[focusedChildIndex];
  const focusedChildNode = node.childNodeMap.get(focusedChildKey);
  const focusedChildDiff = renderChildDiff(focusedChildNode, focusedChildIndex);
  const [firstChildIndexToDisplay] = childIndexToDisplayArray;
  if (firstChildIndexToDisplay > 0) {
    appendSkippedSection(0, firstChildIndexToDisplay);
  }
  let previousChildIndexDisplayed;
  for (const childIndexToDisplay of childIndexToDisplayArray) {
    if (
      previousChildIndexDisplayed !== undefined &&
      childIndexToDisplay !== previousChildIndexDisplayed + 1
    ) {
      appendSkippedSection(
        previousChildIndexDisplayed,
        childIndexToDisplay - 1,
      );
    }
    if (childIndexToDisplay === focusedChildIndex) {
      childrenDiff = appendChildDiff(focusedChildDiff, childIndexToDisplay);
    } else {
      const childKey = childrenKeys[childIndexToDisplay];
      const childNode = node.childNodeMap.get(childKey);
      const childDiff = renderChildDiff(childNode, childIndexToDisplay);
      childrenDiff = appendChildDiff(childDiff, childIndexToDisplay);
    }
    previousChildIndexDisplayed = childIndexToDisplay;
  }
  if (
    childrenKeys.length > 1 &&
    previousChildIndexDisplayed !== childrenKeys.length - 1
  ) {
    appendSkippedSection(
      previousChildIndexDisplayed === undefined
        ? 0
        : previousChildIndexDisplayed,
      childrenKeys.length - 1,
    );
  }
  let diff = "";
  diff += applyStyles(node, startMarker);
  if (hasNewLineAroundChildren) {
    diff += "\n";
  }
  diff += childrenDiff;
  if (hasNewLineAroundChildren) {
    diff += "\n";
    diff += "  ".repeat(getNodeDepth(node, props));
  }
  diff += applyStyles(node, endMarker);
  return diff;
};
const setChildKeyToDisplaySetSolo = (node, props) => {
  /*
   * For a solo node:
   * - All child has a diff (all added or removed)
   * - We can display all child until maxDiff is reached
   */
  const childrenKeys = node.childrenKeys;
  const childKeyToDisplaySet = new Set();
  const { maxDiff } = getMaxDiffOptions(node, props);
  let maxDiffReached = false;
  let diffCount = 0;
  for (const childKey of childrenKeys) {
    if (maxDiffReached) {
      break;
    }
    const childNode = node.childNodeMap.get(childKey);
    if (isSourceCodeProperty(childNode)) {
    } else {
      diffCount++;
      maxDiffReached = diffCount > maxDiff;
    }
    childKeyToDisplaySet.add(childKey);
  }
  node.childKeyToDisplaySet = childKeyToDisplaySet;
};
const setChildKeyToDisplaySetDuo = (actualNode, expectNode, props) => {
  if (actualNode.childKeyToDisplaySet || expectNode.childKeyToDisplaySet) {
    return;
  }
  /*
   * A node will be used as reference to decide what child to display
   * 99% of the time it will be expectNode but whenever expect has no diff it cannot be used
   * in that case we'll use actual (happens when all the same and actual got some added child)
   */
  let referenceNode;
  let otherNode;
  if (expectNode.firstChildWithDiffKey === undefined) {
    referenceNode = actualNode;
    otherNode = expectNode;
  } else {
    referenceNode = expectNode;
    otherNode = actualNode;
  }
  const referenceChildKeyToDisplaySet = new Set();
  {
    const childKeyWithDiffSet = new Set();
    const { childrenKeys, firstChildWithDiffKey } = referenceNode;
    const { maxDiff, maxChildBeforeDiff, maxChildAfterDiff } =
      getMaxDiffOptions(referenceNode, props);
    const firstChildWithDiffIndex = childrenKeys.indexOf(firstChildWithDiffKey);
    let childIndex = firstChildWithDiffIndex;
    let maxDiffReached = false;
    let diffCount = 0;
    while (childIndex < childrenKeys.length) {
      if (maxDiffReached) {
        break;
      }
      const childKey = childrenKeys[childIndex];
      childIndex++;
      const childNode = referenceNode.childNodeMap.get(childKey);
      if (!childNode) {
        debugger;
      }
      if (!childNode.comparison.hasAnyDiff) {
        continue;
      }
      childKeyWithDiffSet.add(childKey);
      if (isSourceCodeProperty(childNode)) {
      } else {
        diffCount++;
        maxDiffReached = diffCount > maxDiff;
      }
    }
    for (const childKey of childKeyWithDiffSet) {
      const childIndex = childrenKeys.indexOf(childKey);
      if (maxChildBeforeDiff > 0) {
        let fromIndex = childIndex - maxChildBeforeDiff;
        let toIndex = childIndex;
        if (fromIndex < 0) {
          fromIndex = 0;
        } else if (fromIndex > 0) {
          fromIndex++;
        }
        let index = fromIndex;
        while (index !== toIndex) {
          referenceChildKeyToDisplaySet.add(childrenKeys[index]);
          index++;
        }
      }
      referenceChildKeyToDisplaySet.add(childKey);
      if (maxChildAfterDiff > 0) {
        let fromIndex = childIndex + 1;
        let toIndex = childIndex + 1 + maxChildAfterDiff;
        if (toIndex > childrenKeys.length) {
          toIndex = childrenKeys.length;
        } else if (toIndex !== childrenKeys.length) {
          toIndex--;
        }
        let index = fromIndex;
        while (index !== toIndex) {
          referenceChildKeyToDisplaySet.add(childrenKeys[index]);
          index++;
        }
      }
    }
  }
  const otherChildKeyToDisplaySet = new Set();
  const otherNodeChildrenKeys = otherNode.childrenKeys;
  for (const referenceChildKeyToDisplay of referenceChildKeyToDisplaySet) {
    const otherNodeChildIndex = otherNodeChildrenKeys.indexOf(
      referenceChildKeyToDisplay,
    );
    if (otherNodeChildIndex === -1) {
      continue;
    }
    otherChildKeyToDisplaySet.add(referenceChildKeyToDisplay);
  }
  referenceNode.childKeyToDisplaySet = referenceChildKeyToDisplaySet;
  otherNode.childKeyToDisplaySet = otherChildKeyToDisplaySet;
};
const getMaxDiffOptions = (node, props) => {
  const { maxDiffType = "prop" } = node.multilineDiff;
  const {
    MAX_DIFF_INSIDE_VALUE,
    MAX_CONTEXT_BEFORE_DIFF,
    MAX_CONTEXT_AFTER_DIFF,
  } = props;
  const maxDiff =
    typeof MAX_DIFF_INSIDE_VALUE === "number"
      ? MAX_DIFF_INSIDE_VALUE
      : MAX_DIFF_INSIDE_VALUE[maxDiffType];
  const maxChildBeforeDiff =
    typeof MAX_CONTEXT_BEFORE_DIFF === "number"
      ? MAX_CONTEXT_BEFORE_DIFF
      : MAX_CONTEXT_BEFORE_DIFF[maxDiffType];
  const maxChildAfterDiff =
    typeof MAX_CONTEXT_AFTER_DIFF === "number"
      ? MAX_CONTEXT_AFTER_DIFF
      : MAX_CONTEXT_AFTER_DIFF[maxDiffType];
  return { maxDiff, maxChildBeforeDiff, maxChildAfterDiff };
};

const isSourceCodeProperty = (node) => {
  const propertyValueNode = getPropertyValueNode(node);
  return propertyValueNode && propertyValueNode.isSourceCode;
};
const disableSeparatorOnProperty = (node) => {
  for (const [, descriptorNode] of node.childNodeMap) {
    const propertyDescriptorValueNode =
      descriptorNode.childNodeMap.get("entry_value");
    propertyDescriptorValueNode.separatorMarkerDisabled = true;
  }
};
const enableSeparatorOnSingleProperty = (node) => {
  for (const [, descriptorNode] of node.childNodeMap) {
    if (descriptorNode.onelineDiff) {
      descriptorNode.onelineDiff.hasSeparatorOnSingleChild = true;
    }
  }
};
const getNodeDepth = (node, props) => {
  return node.depth - props.startNode.depth;
};
export const enableMultilineDiff = (lineEntriesNode) => {
  lineEntriesNode.multilineDiff.hasIndentBetweenEachChild =
    !lineEntriesNode.multilineDiff.lineNumbersDisabled;
  lineEntriesNode.beforeRender = (props, { childIndexToDisplayArray }) => {
    if (props.forceDisableSeparatorMarker) {
      props.columnsRemaining += props.separatorMarker.length;
      props.forceDisableSeparatorMarker();
    }
    const biggestDisplayedLineIndex =
      childIndexToDisplayArray[childIndexToDisplayArray.length - 1];
    for (const lineIndexToDisplay of childIndexToDisplayArray) {
      const lineNode = lineEntriesNode.childNodeMap.get(lineIndexToDisplay);
      lineNode.onelineDiff.hasMarkersWhenEmpty = true;
      if (!lineEntriesNode.multilineDiff.lineNumbersDisabled) {
        lineNode.startMarker = renderLineStartMarker(
          lineNode,
          biggestDisplayedLineIndex,
        );
      }
    }
  };
  const firstLineNode = lineEntriesNode.childNodeMap.get(0);
  firstLineNode.onelineDiff.hasMarkersWhenEmpty = false;
  firstLineNode.onelineDiff.skippedMarkersPlacement = "inside";
  firstLineNode.startMarker = firstLineNode.endMarker = "";
};
const renderLineStartMarker = (lineNode, biggestDisplayedLineIndex) => {
  const lineNumberString = String(lineNode.key + 1);
  const biggestDisplayedLineNumberString = String(
    biggestDisplayedLineIndex + 1,
  );
  if (biggestDisplayedLineNumberString.length > lineNumberString.length) {
    return ` ${lineNumberString}| `;
  }
  return `${lineNumberString}| `;
};
const shouldDisableSeparator = (
  childIndex,
  childrenKeys,
  { hasSeparatorOnSingleChild, hasTrailingSeparator },
) => {
  if (childrenKeys.length === 1) {
    return !hasSeparatorOnSingleChild;
  }
  if (childIndex === childrenKeys.length - 1) {
    return !hasTrailingSeparator;
  }
  return false;
};

const pickColorFromChildren = (node) => {
  let color;
  for (const [, childNode] of node.childNodeMap) {
    if (childNode.diffType === "modified") {
      return childNode.color;
    }
    if (childNode.diffType === "solo") {
      color = childNode.color;
    }
  }
  return color;
};
