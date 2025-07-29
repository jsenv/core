import { prefixFirstAndIndentRemainingLines } from "../utils/indentation.js";

export const formatError = (error) => {
  let text = "";
  text += error.stack;
  const { cause } = error;
  if (cause) {
    const formatCause = (cause, depth) => {
      let causeText = prefixFirstAndIndentRemainingLines(cause.stack, {
        prefix: "  [cause]:",
        indentation: "  ".repeat(depth + 1),
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
