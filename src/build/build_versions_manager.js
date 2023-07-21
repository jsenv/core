// see https://github.com/rollup/rollup/blob/ce453507ab8457dd1ea3909d8dd7b117b2d14fab/src/utils/hashPlaceholders.ts#L1

import { createHash } from "node:crypto";
import {
  injectQueryParamIntoSpecifierWithoutEncoding,
  renderUrlOrRelativeUrlFilename,
} from "@jsenv/urls";

import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { isWebWorkerUrlInfo } from "../kitchen/web_workers.js";

const placeholderLeft = "!~{";
const placeholderRight = "}~";
const placeholderOverhead = placeholderLeft.length + placeholderRight.length;

export const createBuildVersionsManager = ({
  finalKitchen,
  versioning,
  versioningMethod,
  versionLength = 8,
  canUseImportmap,
  getBuildUrlFromBuildSpecifier,
}) => {
  const placeholderToReferenceMap = new Map();
  const buildSpecifierToPlaceholderMap = new Map();

  const referenceVersionedByCodeMap = new Map();
  const referenceVersionedByImportmapMap = new Map();
  const specifierVersionedInlineSet = new Set();
  const specifierVersionedByCodeSet = new Set();
  const specifierVersionedByImportmapSet = new Set();
  const versionMap = new Map();

  const buildSpecifierToBuildSpecifierVersionedMap = new Map();
  // - will be used by global and importmap registry
  // - will be used by build during "inject_urls_in_service_workers" and
  //   "resync_resource_hints"
  const getBuildSpecifierVersioned = (buildSpecifier) => {
    const fromCache =
      buildSpecifierToBuildSpecifierVersionedMap.get(buildSpecifier);
    if (fromCache) {
      return fromCache;
    }
    const buildSpecifierPlaceholder =
      buildSpecifierToPlaceholderMap.get(buildSpecifier);
    if (!buildSpecifierPlaceholder) {
      return null;
    }
    const buildUrl = getBuildUrlFromBuildSpecifier(buildSpecifier);
    const urlInfo = finalKitchen.graph.getUrlInfo(buildUrl);
    const version = versionMap.get(urlInfo);
    const buildSpecifierVersioned = replaceFirstPlaceholder(
      buildSpecifierPlaceholder,
      version,
    );
    buildSpecifierToBuildSpecifierVersionedMap.set(
      buildSpecifier,
      buildSpecifierVersioned,
    );
    return buildSpecifierVersioned;
  };

  return {
    getBuildUrl: (reference) => {
      const { specifier } = reference;
      let referenceWithoutPlaceholder =
        placeholderToReferenceMap.get(specifier);
      if (!referenceWithoutPlaceholder) {
        const placeholder = extractFirstPlaceholder(specifier);
        if (placeholder) {
          referenceWithoutPlaceholder =
            placeholderToReferenceMap.get(placeholder);
        }
      }
      if (referenceWithoutPlaceholder) {
        return referenceWithoutPlaceholder.url;
      }
      return null;
    },

    getVersion: (urlInfo) => versionMap.get(urlInfo),
    getBuildSpecifierVersioned,
  };
};

// https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47
// https://github.com/rollup/rollup/blob/5a5391971d695c808eed0c5d7d2c6ccb594fc689/src/Chunk.ts#L870
const generateVersion = (parts, length) => {
  const hash = createHash("sha256");
  parts.forEach((part) => {
    hash.update(part);
  });
  return hash.digest("hex").slice(0, length);
};

const injectVersionPlaceholderIntoBuildSpecifier = ({
  buildSpecifier,
  versionPlaceholder,
  versioningMethod,
}) => {
  if (versioningMethod === "search_param") {
    return injectQueryParamIntoSpecifierWithoutEncoding(
      buildSpecifier,
      "v",
      versionPlaceholder,
    );
  }
  return renderUrlOrRelativeUrlFilename(
    buildSpecifier,
    ({ basename, extension }) => {
      return `${basename}-${versionPlaceholder}${extension}`;
    },
  );
};

// unit test exports
export { generateVersion };
