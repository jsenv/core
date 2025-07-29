export const prefixFirstAndIndentRemainingLines = (
  text,
  { prefix, indentation, trimLines, trimLastLine },
) => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines.shift();
  if (indentation === undefined) {
    if (prefix) {
      indentation = "  "; // prefix + space
    } else {
      indentation = "";
    }
  }
  let result = prefix ? `${prefix} ${firstLine}` : firstLine;
  let i = 0;
  while (i < lines.length) {
    const line = trimLines ? lines[i].trim() : lines[i];
    i++;
    result += line.length
      ? `\n${indentation}${line}`
      : trimLastLine && i === lines.length
        ? ""
        : `\n`;
  }
  return result;
};

export const preNewLineAndIndentation = (
  value,
  { depth = 0, indentUsingTab, indentSize },
) => {
  return `${newLineAndIndent({
    count: depth + 1,
    useTabs: indentUsingTab,
    size: indentSize,
  })}${value}`;
};

const postNewLineAndIndentation = ({ depth, indentUsingTab, indentSize }) => {
  return newLineAndIndent({
    count: depth,
    useTabs: indentUsingTab,
    size: indentSize,
  });
};

const newLineAndIndent = ({ count, useTabs, size }) => {
  if (useTabs) {
    // eslint-disable-next-line prefer-template
    return "\n" + "\t".repeat(count);
  }
  // eslint-disable-next-line prefer-template
  return "\n" + " ".repeat(count * size);
};

export const wrapNewLineAndIndentation = (
  value,
  { depth = 0, indentUsingTab, indentSize },
) => {
  return `${preNewLineAndIndentation(value, {
    depth,
    indentUsingTab,
    indentSize,
  })}${postNewLineAndIndentation({ depth, indentUsingTab, indentSize })}`;
};
