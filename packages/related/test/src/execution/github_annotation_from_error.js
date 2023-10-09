import { urlIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";

import {
  formatExecutionLabel,
  formatExecution,
} from "./logs_file_execution.js";

export const githubAnnotationFromError = (
  error,
  { rootDirectoryUrl, executionInfo },
) => {
  const annotation = {
    annotation_level: "failure",
    path: executionInfo.fileRelativeUrl,
    start_line: 1,
    end_line: 1,
    title: formatExecutionLabel(executionInfo),
  };
  const exception =
    error && error.isException
      ? error
      : asException(error, { rootDirectoryUrl });
  if (typeof exception.site.line === "number") {
    annotation.path = urlToRelativeUrl(exception.site.url, rootDirectoryUrl);
    annotation.start_line = exception.site.line;
    annotation.end_line = exception.site.line;
    annotation.start_column = exception.site.column;
    annotation.end_column = exception.site.column;
  }
  annotation.message = formatExecution({
    ...executionInfo,
    executionResult: {
      ...executionInfo.executionResult,
      errors: [exception],
    },
  });
  return annotation;
};

const asException = (error, { rootDirectoryUrl }) => {
  const exception = {
    isException: true,
    stack: "",
    site: {},
  };
  if (error === null || error === undefined || typeof error === "string") {
    exception.message = String(error);
    return exception;
  }
  if (error) {
    exception.message = error.message;
    if (error.stack) {
      let firstSite = true;
      exception.stack = replaceUrls(
        error.stack,
        ({ match, url, line = 1, column = 1 }) => {
          if (urlIsInsideOf(url, rootDirectoryUrl)) {
            const relativeUrl = urlToRelativeUrl(url, rootDirectoryUrl);
            match = stringifyUrlSite({ url: relativeUrl, line, column });
          }
          if (firstSite) {
            firstSite = false;
            exception.site.url = url;
            exception.site.line = line;
            exception.site.column = column;
          }
          return match;
        },
      );
    }

    return exception;
  }
  exception.message = error;
  return exception;
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
        line: lineString ? parseInt(lineString) : undefined,
        column: columnString ? parseInt(columnString) : undefined,
      });
    } else {
      const linePattern = /:([0-9]+)$/;
      const lineMatch = match.match(linePattern);
      if (lineMatch) {
        const lineString = lineMatch[0];
        replacement = replace({
          match: lineMatch,
          url: match.slice(0, -lineString.length),
          line: lineString ? parseInt(lineString) : undefined,
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
