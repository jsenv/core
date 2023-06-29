// see https://github.com/rollup/rollup/blob/ce453507ab8457dd1ea3909d8dd7b117b2d14fab/src/utils/hashPlaceholders.ts#L1

import { createHash } from "node:crypto";
import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

const placeholderLeft = "!~{";
const placeholderRight = "}~";
const placeholderOverhead = placeholderLeft.length + placeholderRight.length;

export const createBuildVersionsManager = ({ versionLength = 8 } = {}) => {
  const urlInfoToVersionPlaceholderMap = new Map();
  const versionPlaceholderToUrlInfoMap = new Map();

  const getVersionPlaceholderFromUrlInfo = (urlInfo) => {
    return urlInfoToVersionPlaceholderMap.get(urlInfo);
  };
  const getUrlInfoFromVersionPlaceholder = (versionPlaceholder) => {
    return versionPlaceholderToUrlInfoMap.get(versionPlaceholder);
  };

  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
  const base = 64;
  const toBase64 = (value) => {
    let outString = "";
    do {
      const currentDigit = value % base;
      value = (value / base) | 0;
      outString = chars[currentDigit] + outString;
    } while (value !== 0);
    return outString;
  };

  let nextIndex = 0;
  const generatePlaceholder = (urlInfo) => {
    const existing = getVersionPlaceholderFromUrlInfo(urlInfo);
    if (existing) return existing;
    nextIndex++;
    const uniqueId = toBase64(nextIndex);
    const versionPlaceholder = `${placeholderLeft}${uniqueId.padStart(
      versionLength - placeholderOverhead,
      "0",
    )}${placeholderRight}`;
    nextIndex++;
    urlInfoToVersionPlaceholderMap.set(urlInfo, versionPlaceholder);
    versionPlaceholderToUrlInfoMap.set(versionPlaceholder, urlInfo);
    return versionPlaceholder;
  };

  const REPLACER_REGEX = new RegExp(
    `${escapeRegexpSpecialChars(placeholderLeft)}[0-9a-zA-Z_$]{1,${
      versionLength - placeholderOverhead
    }}${escapeRegexpSpecialChars(placeholderRight)}`,
    "g",
  );

  const replacePlaceholders = (code, replacer) => {
    return code.replace(REPLACER_REGEX, replacer);
  };

  const replaceOnePlaceholder = (code, versionPlaceholder, value) => {
    return code.replace(REPLACER_REGEX, (match) => {
      return match === versionPlaceholder ? value : match;
    });
  };

  const defaultPlaceholder = `${placeholderLeft}${"0".repeat(
    versionLength - placeholderOverhead,
  )}${placeholderRight}`;
  const replaceWithDefaultAndPopulateContainedPlaceholders = (
    code,
    containedPlaceholders,
  ) => {
    const transformedCode = code.replace(REPLACER_REGEX, (placeholder) => {
      containedPlaceholders.add(placeholder);
      return defaultPlaceholder;
    });
    return transformedCode;
  };

  // https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
  // https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
  const generateVersion = (parts) => {
    const hash = createHash("sha256");
    parts.forEach((part) => {
      hash.update(part);
    });
    return hash.digest("hex").slice(0, versionLength);
  };

  return {
    generatePlaceholder,
    replacePlaceholders,
    replaceOnePlaceholder,
    replaceWithDefaultAndPopulateContainedPlaceholders,
    getUrlInfoFromVersionPlaceholder,
    getVersionPlaceholderFromUrlInfo,
    generateVersion,
  };
};
