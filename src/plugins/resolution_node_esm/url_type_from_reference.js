export const urlTypeFromReference = (reference, context) => {
  if (reference.type === "sourcemap_comment") {
    return "sourcemap";
  }
  if (reference.injected) {
    return reference.expectedType;
  }
  const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl);
  if (parentUrlInfo) {
    return parentUrlInfo.type;
  }
  return "entry_point";
};
