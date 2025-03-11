import { ANSI } from "@jsenv/humanize";

export const truncateAndApplyColor = (
  valueDiff,
  node,
  props,
  { chirurgicalColor } = {},
) => {
  const { columnsRemaining } = props;
  if (columnsRemaining < 1) {
    return props.endSkippedMarkerDisabled ? "" : applyStyles(node, "…");
  }
  let columnsRemainingForValue = columnsRemaining;
  let { startMarker, endMarker } = node;
  if (startMarker) {
    columnsRemainingForValue -= startMarker.length;
  }
  if (endMarker) {
    columnsRemainingForValue -= endMarker.length;
  }
  if (columnsRemainingForValue < 1) {
    return props.endSkippedMarkerDisabled ? "" : applyStyles(node, "…");
  }
  if (valueDiff.length > columnsRemainingForValue) {
    if (props.endSkippedMarkerDisabled) {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue);
    } else {
      valueDiff = valueDiff.slice(0, columnsRemainingForValue - "…".length);
      valueDiff += "…";
    }
  }
  let diff = "";
  if (startMarker) {
    diff += startMarker;
  }
  diff += valueDiff;
  if (endMarker) {
    diff += endMarker;
  }
  diff = applyStyles(node, diff, { chirurgicalColor });
  return diff;
};

export const applyStyles = (
  node,
  text,
  { chirurgicalColor, color = node.color, underline = true } = {},
) => {
  let shouldAddUnderline;
  let shouldAddColor;
  should_underline: {
    if (!underline) {
      break should_underline;
    }
    const { underlines } = node.context.assert;
    if (!underlines) {
      break should_underline;
    }
    if (underlines === "any_diff") {
      shouldAddUnderline = node.diffType !== "same";
      break should_underline;
    }
    // "trailing_space_multiline_diff"
    if (node.diffType === "same") {
      break should_underline;
    }
    if (node.subgroup !== "char") {
      break should_underline;
    }
    if (node.parent.endMarker) {
      // must be inside a multiline
      // when there is no end marker trailing spaces are hard to see
      // that's why we want to underline them
      // otherwise no need
      break should_underline;
    }
    const char = node.value;
    if (char !== " ") {
      break should_underline;
    }
    // all next char must be spaces
    const charsAfterSpace = node.parent.value.slice(node.key + " ".length);
    for (const charAfterSpace of charsAfterSpace) {
      if (charAfterSpace !== " ") {
        break should_underline;
      }
    }
    shouldAddUnderline = true;
  }
  should_color: {
    const { colors } = node.context.assert;
    if (!colors) {
      break should_color;
    }
    shouldAddColor = true;
  }
  if (chirurgicalColor && chirurgicalColor.color !== color) {
    let stylized = "";
    const before = text.slice(0, chirurgicalColor.start);
    const middle = text.slice(chirurgicalColor.start, chirurgicalColor.end);
    const after = text.slice(chirurgicalColor.end);
    if (shouldAddUnderline) {
      stylized += ANSI.effect(before, ANSI.UNDERLINE);
    }
    if (shouldAddColor) {
      stylized = ANSI.color(before, color);
    }
    if (shouldAddColor) {
      stylized += ANSI.color(middle, chirurgicalColor.color);
    }
    if (shouldAddUnderline) {
      stylized += ANSI.effect(before, ANSI.UNDERLINE);
    }
    if (shouldAddColor) {
      stylized += ANSI.color(after, color);
    }
    return stylized;
  }
  if (shouldAddUnderline) {
    text = ANSI.effect(text, ANSI.UNDERLINE);
  }
  if (shouldAddColor) {
    text = ANSI.color(text, color);
  }
  return text;
};
