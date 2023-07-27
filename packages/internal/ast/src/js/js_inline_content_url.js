import { injectQueryParams } from "@jsenv/urls";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { generateUrlForInlineContent } from "../inline_content_url.js";

export const getUrlForContentInsideJs = (inlineReferenceInfo, { url }) => {
  const { inlinedFromUrl } = inlineReferenceInfo;
  if (inlinedFromUrl) {
    return injectQueryParams(inlinedFromUrl, { inlined: "" });
  }
  return generateUrlForInlineContent({
    url,
    extension: CONTENT_TYPE.asFileExtension(inlineReferenceInfo.contentType),
    line: inlineReferenceInfo.line,
    column: inlineReferenceInfo.column,
    lineEnd: inlineReferenceInfo.lineEnd,
    columnEnd: inlineReferenceInfo.columnEnd,
  });
};
