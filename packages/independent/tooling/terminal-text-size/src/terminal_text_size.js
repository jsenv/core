import emojiRegex from "emoji-regex-xs";
import { eastAsianWidth } from "get-east-asian-width";
import { stripVTControlCharacters } from "node:util";

const segmenter = new Intl.Segmenter();

const defaultIgnorableCodePointRegex = /^\p{Default_Ignorable_Code_Point}$/u;

export const measureTextWidth = (
  string,
  {
    ambiguousIsNarrow = true,
    countAnsiEscapeCodes = false,
    skipEmojis = false,
  } = {},
) => {
  if (typeof string !== "string" || string.length === 0) {
    return 0;
  }

  if (!countAnsiEscapeCodes) {
    string = stripVTControlCharacters(string);
  }

  if (string.length === 0) {
    return 0;
  }

  let width = 0;
  const eastAsianWidthOptions = { ambiguousAsWide: !ambiguousIsNarrow };

  for (const { segment: character } of segmenter.segment(string)) {
    const codePoint = character.codePointAt(0);

    // Ignore control characters
    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      continue;
    }

    // Ignore zero-width characters
    if (
      (codePoint >= 0x20_0b && codePoint <= 0x20_0f) || // Zero-width space, non-joiner, joiner, left-to-right mark, right-to-left mark
      codePoint === 0xfe_ff // Zero-width no-break space
    ) {
      continue;
    }

    // Ignore combining characters
    if (
      (codePoint >= 0x3_00 && codePoint <= 0x3_6f) || // Combining diacritical marks
      (codePoint >= 0x1a_b0 && codePoint <= 0x1a_ff) || // Combining diacritical marks extended
      (codePoint >= 0x1d_c0 && codePoint <= 0x1d_ff) || // Combining diacritical marks supplement
      (codePoint >= 0x20_d0 && codePoint <= 0x20_ff) || // Combining diacritical marks for symbols
      (codePoint >= 0xfe_20 && codePoint <= 0xfe_2f) // Combining half marks
    ) {
      continue;
    }

    // Ignore surrogate pairs
    if (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff) {
      continue;
    }

    // Ignore variation selectors
    if (codePoint >= 0xfe_00 && codePoint <= 0xfe_0f) {
      continue;
    }

    // This covers some of the above cases, but we still keep them for performance reasons.
    if (defaultIgnorableCodePointRegex.test(character)) {
      continue;
    }

    if (!skipEmojis && emojiRegex().test(character)) {
      if (process.env.CAPTURING_SIDE_EFFECTS) {
        if (character === "✔️") {
          width += 2;
          continue;
        }
      }
      width += measureTextWidth(character, {
        skipEmojis: true,
        countAnsiEscapeCodes: true, // to skip call to stripVTControlCharacters
      });
      continue;
    }

    width += eastAsianWidth(codePoint, eastAsianWidthOptions);
  }

  return width;
};
