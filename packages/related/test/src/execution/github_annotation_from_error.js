import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";

export const githubAnnotationFromError = (
  error,
  { rootDirectoryUrl, executionInfo },
) => {
  if (error.isException) {
    return {
      annotation_level: "failure",
      title: error.site.message,
      message: replaceUrls(
        error.stackNormalized,
        ({ match, url, line, column }) => {
          if (urlIsInsideOf(url, rootDirectoryUrl)) {
            const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
            match = stringifyUrlSite({ url: relativeUrl, line, column });
          }
          return match;
        },
      ),
      ...(typeof error.site.line === "number"
        ? {
            start_line: error.site.line,
            end_line: error.site.line,
          }
        : {}),
    };
  }
  if (error.stack) {
    const annotation = {
      annotation_level: "failure",
      path: executionInfo.fileRelativeUrl,
    };
    let firstSite = true;
    const stack = replaceUrls(error.stack, ({ match, url, line, column }) => {
      if (urlIsInsideOf(url, rootDirectoryUrl)) {
        const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
        match = stringifyUrlSite({ url: relativeUrl, line, column });
      }
      if (firstSite) {
        firstSite = false;
        annotation.path = url;
        annotation.start_line = line;
        annotation.end_line = line;
      }
      return match;
    });
    annotation.message = stack;
    return annotation;
  }
  if (error.message) {
    return {
      annotation_level: "failure",
      path: executionInfo.fileRelativeUrl,
      message: error.message,
    };
  }
  return {
    annotation_level: "failure",
    path: executionInfo.fileRelativeUrl,
    message: error,
  };
};

const stringifyUrlSite = ({ url, line, column }) => {
  let string = url;
  if (typeof line === "number") {
    string += `:${line}`;
    if (typeof column === "number") {
      string += `:${column}`;
    }
  }
  return string;
};

const replaceUrls = (source, replace) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, (match) => {
    let replacement = "";
    const lastChar = match[match.length - 1];

    // hotfix because our url regex sucks a bit
    const endsWithSeparationChar = lastChar === ")" || lastChar === ":";
    if (endsWithSeparationChar) {
      match = match.slice(0, -1);
    }

    const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
    const lineAndColumMatch = match.match(lineAndColumnPattern);
    if (lineAndColumMatch) {
      const lineAndColumnString = lineAndColumMatch[0];
      const lineString = lineAndColumMatch[1];
      const columnString = lineAndColumMatch[2];
      replacement = replace({
        match: lineAndColumMatch,
        url: match.slice(0, -lineAndColumnString.length),
        line: lineString ? parseInt(lineString) : null,
        column: columnString ? parseInt(columnString) : null,
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);
      if (lineMatch) {
        const lineString = lineMatch[0];
        replacement = replace({
          match: lineMatch,
          url: match.slice(0, -lineString.length),
          line: lineString ? parseInt(lineString) : null,
        });
      } else {
        replacement = replace({
          match: lineMatch,
          url: match,
        });
      }
    }
    if (endsWithSeparationChar) {
      return `${replacement}${lastChar}`;
    }
    return replacement;
  });
};
