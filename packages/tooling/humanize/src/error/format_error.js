export const formatError = (error) => {
  let text = "";
  text += error.stack;
  const { cause } = error;
  if (cause) {
    const formatCause = (cause, depth) => {
      let causeText = prefixFirstAndIndentRemainingLines({
        prefix: "  [cause]:",
        indentation: "  ".repeat(depth + 1),
        text: cause.stack,
      });
      const nestedCause = cause.cause;
      if (nestedCause) {
        const nestedCauseText = formatCause(nestedCause, depth + 1);
        causeText += `\n${nestedCauseText}`;
      }
      return causeText;
    };
    const causeText = formatCause(cause, 0);
    text += `\n${causeText}`;
  }
  return text;
};

const prefixFirstAndIndentRemainingLines = ({
  prefix,
  indentation,
  text,
  trimLines,
  trimLastLine,
}) => {
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
