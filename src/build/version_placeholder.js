import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

// Four random characters from the private use area to minimize risk of conflicts
// const placeholderLeft = "\uf7f9\ue4d3";
// const placeholderRight = "\ue3cc\uf1fe";
const placeholderLeft = "$$";
const placeholderRight = "$$";
const placeholderOverhead = placeholderLeft.length + placeholderRight.length;

export const getVersionPlaceholderGenerator = () => {
  let nextIndex = 0;
  return (hashSize = 8) => {
    nextIndex++;
    const uniqueId = String(nextIndex);
    const placeholder = `${placeholderLeft}${uniqueId.padStart(
      hashSize - placeholderOverhead,
      "0",
    )}${placeholderRight}`;
    nextIndex++;
    return placeholder;
  };
};

const REPLACER_REGEX = new RegExp(
  `${escapeRegexpSpecialChars(placeholderLeft)}\\d{1,${
    8 - placeholderOverhead
  }}${escapeRegexpSpecialChars(placeholderRight)}`,
  "g",
);

export const replaceVersionPlaceholders = (code, replacer) => {
  return code.replace(REPLACER_REGEX, replacer);
};

export const replaceSingleVersionPlaceholder = (code, placeholder, value) => {
  return code.replace(REPLACER_REGEX, (match) =>
    match === placeholder ? value : match,
  );
};

export const replaceVersionPlaceholdersWithDefaultAndPopulateContainedPlaceholders =
  (code, containedPlaceholders) => {
    const transformedCode = code.replace(REPLACER_REGEX, (placeholder) => {
      containedPlaceholders.add(placeholder);
      return `${placeholderLeft}${"0".repeat(
        placeholder.length - placeholderOverhead,
      )}${placeholderRight}`;
    });
    return transformedCode;
  };
