export const frameString = (
  string,
  { line, column, maxLineDisplayed = 5, maxColumnDisplayed = 120, annotation },
) => {
  const lineStrings = string.split(/\r?\n/);

  let lineStart = line - Math.floor(maxLineDisplayed / 2);
  let lineEnd = line + Math.ceil(maxLineDisplayed / 2);
  if (lineStart < 0) {
    lineStart = 0;
  }
  if (lineEnd > lineStrings.length) {
    lineEnd = lineStrings.length;
  }
  let columnStart = column - Math.floor(maxColumnDisplayed / 2);
  if (columnStart < 0) {
    columnStart = 0;
  }
  let columnEnd = column + Math.ceil(maxColumnDisplayed / 2);

  let stringFramed = "";
  let lineIndex = lineStart;
  while (lineIndex < lineEnd) {
    const lineString = lineStrings[lineIndex];
    const isMainLine = lineIndex === line;
    lineIndex++;
    const isLastLine = lineIndex === lineEnd;
    const lineStringTruncated = truncateLine(
      lineString,
      columnStart,
      columnEnd,
    );
    if (annotation && isMainLine) {
      const annotationIndented = `${` `.repeat(column)}${annotation}`;
      if (isLastLine) {
        stringFramed += `${lineStringTruncated}\n${annotationIndented}`;
      } else {
        stringFramed += `${lineStringTruncated}\n${annotationIndented}\n`;
      }
    } else if (isLastLine) {
      stringFramed += lineStringTruncated;
    } else {
      stringFramed += `${lineStringTruncated}\n`;
    }
  }
  return stringFramed;
};

const truncateLine = (line, start, end) => {
  const prefix = "…";
  const suffix = "…";
  const lastIndex = line.length;

  if (line.length === 0) {
    // don't show any ellipsis if the line is empty
    // because it's not truncated in that case
    return "";
  }

  const startTruncated = start > 0;
  const endTruncated = lastIndex > end;
  let from = startTruncated ? start + prefix.length : start;
  let to = endTruncated ? end - suffix.length : end;
  if (to > lastIndex) to = lastIndex;
  if (start >= lastIndex || from === to) {
    return "";
  }
  let result = "";
  while (from < to) {
    result += line[from];
    from++;
  }
  if (result.length === 0) {
    return "";
  }
  if (startTruncated && endTruncated) {
    return `${prefix}${result}${suffix}`;
  }
  if (startTruncated) {
    return `${prefix}${result}`;
  }
  if (endTruncated) {
    return `${result}${suffix}`;
  }
  return result;
};
