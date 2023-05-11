import { createDetailedMessage } from "./detailed_message.js";

export const remapSourcePosition = async ({
  url,
  line,
  column,
  resolveFile,
  urlToSourcemapConsumer,
  readErrorStack = (e) => e.stack,
}) => {
  const position = { url, line, column };
  const sourceMapConsumer = await urlToSourcemapConsumer(url);

  if (!sourceMapConsumer) {
    return position;
  }

  try {
    const originalPosition = sourceMapConsumer.originalPositionFor(position);

    // Only return the original position if a matching line was found. If no
    // matching line is found then we return position instead, which will cause
    // the stack trace to print the path and line for the compiled file. It is
    // better to give a precise location in the compiled file than a vague
    // location in the original file.
    const originalSource = originalPosition.source;
    if (originalSource === null) {
      return position;
    }
    return {
      url: resolveFile(originalSource, url),
      line: originalPosition.line,
      column: originalPosition.column,
    };
  } catch (e) {
    console.warn(
      createDetailedMessage(`error while remapping position.`, {
        ["error stack"]: readErrorStack(e),
        ["url"]: url,
        ["line"]: line,
        ["column"]: column,
      }),
    );
    return position;
  }
};
