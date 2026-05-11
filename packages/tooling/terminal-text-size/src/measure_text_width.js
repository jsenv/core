import { eastAsianWidth } from "get-east-asian-width";

// Whole-cluster zero-width: Default_Ignorable, Control, Format, Mark, Surrogate
const zeroWidthClusterRegex =
  /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]+$/v;

// Strip leading non-printing chars to get the first visible scalar of a cluster
const leadingNonPrintingRegex =
  /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]+/v;

// RGI emoji sequences (e.g. flag sequences, ZWJ families, keycap+VS16)
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;

// Unqualified keycap: digit/# /* + combining enclosing keycap (no VS16)
const unqualifiedKeycapRegex = /^[\d#*]\u20E3$/;
const extendedPictographicRegex = /\p{Extended_Pictographic}/gv;

const isDoubleWidthNonRgiEmojiSequence = (segment) => {
  if (segment.length > 50) {
    return false;
  }
  if (unqualifiedKeycapRegex.test(segment)) {
    return true;
  }
  // ZWJ sequences with 2+ Extended_Pictographic
  if (segment.includes("\u200D")) {
    const pictographics = segment.match(extendedPictographicRegex);
    return pictographics !== null && pictographics.length >= 2;
  }
  return false;
};

const baseVisible = (segment) => {
  return segment.replace(leadingNonPrintingRegex, "");
};

const isHangulLeadingJamo = (cp) => {
  return (cp >= 0x11_00 && cp <= 0x11_5f) || (cp >= 0xa9_60 && cp <= 0xa9_7c);
};
const isHangulVowelJamo = (cp) => {
  return (cp >= 0x11_60 && cp <= 0x11_a7) || (cp >= 0xd7_b0 && cp <= 0xd7_c6);
};
const isHangulTrailingJamo = (cp) => {
  return (cp >= 0x11_a8 && cp <= 0x11_ff) || (cp >= 0xd7_cb && cp <= 0xd7_fb);
};
const isHangulJamo = (cp) => {
  return (
    isHangulLeadingJamo(cp) || isHangulVowelJamo(cp) || isHangulTrailingJamo(cp)
  );
};

const hangulClusterWidth = (visibleSegment, eastAsianWidthOptions) => {
  const codePoints = [];
  for (const character of visibleSegment) {
    if (zeroWidthClusterRegex.test(character)) {
      continue;
    }
    codePoints.push(character.codePointAt(0));
  }
  if (codePoints.length === 0) {
    return undefined;
  }
  let width = 0;
  for (let index = 0; index < codePoints.length; index++) {
    const codePoint = codePoints[index];
    if (!isHangulJamo(codePoint)) {
      if (width === 0) {
        return undefined;
      }
      for (let remaining = index; remaining < codePoints.length; remaining++) {
        width += eastAsianWidth(codePoints[remaining], eastAsianWidthOptions);
      }
      return width;
    }
    if (
      isHangulLeadingJamo(codePoint) &&
      isHangulVowelJamo(codePoints[index + 1])
    ) {
      width += 2;
      index += isHangulTrailingJamo(codePoints[index + 2]) ? 2 : 1;
      continue;
    }
    width += eastAsianWidth(codePoint, eastAsianWidthOptions);
  }
  return width;
};

const trailingHalfwidthWidth = (visibleSegment, eastAsianWidthOptions) => {
  let extra = 0;
  let first = true;
  for (const character of visibleSegment) {
    if (first) {
      first = false;
      continue;
    }
    if (character >= "\uFF00" && character <= "\uFFEF") {
      extra += eastAsianWidth(character.codePointAt(0), eastAsianWidthOptions);
    }
  }
  return extra;
};

export const createMeasureTextWidth = ({ stripAnsi }) => {
  const segmenter = new Intl.Segmenter();

  const measureTextWidth = (
    string,
    { ambiguousIsNarrow = true, countAnsiEscapeCodes = false } = {},
  ) => {
    if (typeof string !== "string" || string.length === 0) {
      return 0;
    }

    // Only strip ANSI when escape codes are actually present
    if (
      !countAnsiEscapeCodes &&
      (string.includes("\u001B") || string.includes("\u009B"))
    ) {
      string = stripAnsi(string);
    }

    if (string.length === 0) {
      return 0;
    }

    // Fast path: printable ASCII needs no segmenter or EAW lookup
    if (/^[\u0020-\u007E]*$/.test(string)) {
      return string.length;
    }

    let width = 0;
    const eastAsianWidthOptions = { ambiguousAsWide: !ambiguousIsNarrow };

    for (const { segment } of segmenter.segment(string)) {
      if (zeroWidthClusterRegex.test(segment)) {
        continue;
      }

      // RGI emoji + unqualified emoji sequences are double-width
      if (
        rgiEmojiRegex.test(segment) ||
        isDoubleWidthNonRgiEmojiSequence(segment)
      ) {
        if (process.env.CAPTURING_SIDE_EFFECTS && segment === "✔️") {
          width += 2;
          continue;
        }
        width += 2;
        continue;
      }

      const visibleSegment = baseVisible(segment);

      const hangulWidth = hangulClusterWidth(
        visibleSegment,
        eastAsianWidthOptions,
      );
      if (hangulWidth !== undefined) {
        width += hangulWidth;
        continue;
      }

      // EAW of the cluster's first visible scalar
      const codePoint = visibleSegment.codePointAt(0);
      width += eastAsianWidth(codePoint, eastAsianWidthOptions);

      // Add width for trailing Halfwidth/Fullwidth Forms (e.g. ﾞ, ﾟ, ｰ)
      width += trailingHalfwidthWidth(visibleSegment, eastAsianWidthOptions);
    }

    return width;
  };

  return measureTextWidth;
};
