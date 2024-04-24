/*
 * see also https://github.com/vadimdemedes/ink
 */

import stringWidth from "string-width";
import ansiEscapes from "ansi-escapes";

export const createDynamicLog = ({
  stream = process.stdout,
  clearTerminalAllowed,
  onVerticalOverflow = () => {},
  onWriteFromOutside = () => {},
} = {}) => {
  const { columns = 80, rows = 24 } = stream;
  const dynamicLog = {
    destroyed: false,
    onVerticalOverflow,
    onWriteFromOutside,
  };

  let lastOutput = "";
  let lastOutputFromOutside = "";
  let clearAttemptResult;
  let writing = false;

  const getErasePreviousOutput = () => {
    // nothing to clear
    if (!lastOutput) {
      return "";
    }
    if (clearAttemptResult !== undefined) {
      return "";
    }

    const logLines = lastOutput.split(/\r\n|\r|\n/);
    let visualLineCount = 0;
    for (const logLine of logLines) {
      const width = stringWidth(logLine);
      if (width === 0) {
        visualLineCount++;
      } else {
        visualLineCount += Math.ceil(width / columns);
      }
    }

    if (visualLineCount > rows) {
      if (clearTerminalAllowed) {
        clearAttemptResult = true;
        return ansiEscapes.clearTerminal;
      }
      // the whole log cannot be cleared because it's vertically to long
      // (longer than terminal height)
      // readline.moveCursor cannot move cursor higher than screen height
      // it means we would only clear the visible part of the log
      // better keep the log untouched
      clearAttemptResult = false;
      dynamicLog.onVerticalOverflow();
      return "";
    }

    clearAttemptResult = true;
    return ansiEscapes.eraseLines(visualLineCount);
  };

  const update = (string) => {
    if (dynamicLog.destroyed) {
      throw new Error("Cannot write log after destroy");
    }
    let stringToWrite = string;
    if (lastOutput) {
      if (lastOutputFromOutside) {
        // We don't want to clear logs written by other code,
        // it makes output unreadable and might erase precious information
        // To detect this we put a spy on the stream.
        // The spy is required only if we actually wrote something in the stream
        // something else than this code has written in the stream
        // so we just write without clearing (append instead of replacing)
        lastOutput = "";
        lastOutputFromOutside = "";
      } else {
        stringToWrite = `${getErasePreviousOutput()}${string}`;
      }
    }
    writing = true;
    stream.write(stringToWrite);
    lastOutput = string;
    writing = false;
    clearAttemptResult = undefined;
  };

  const clearDuringFunctionCall = (
    callback,
    ouputAfterCallback = lastOutput,
  ) => {
    // 1. Erase the current log
    // 2. Call callback (expected to write something on stdout)
    // 3. Restore the current log
    // During step 2. we expect a "write from outside" so we uninstall
    // the stream spy during function call
    update("");

    writing = true;
    callback();
    writing = false;

    update(ouputAfterCallback);
  };

  const writeFromOutsideEffect = (value) => {
    if (!lastOutput) {
      // we don't care if the log never wrote anything
      // or if last update() wrote an empty string
      return;
    }
    if (writing) {
      return;
    }
    lastOutputFromOutside = value;
    dynamicLog.onWriteFromOutside(value);
  };

  let removeStreamSpy;
  if (stream === process.stdout) {
    const removeStdoutSpy = spyStreamOutput(
      process.stdout,
      writeFromOutsideEffect,
    );
    const removeStderrSpy = spyStreamOutput(
      process.stderr,
      writeFromOutsideEffect,
    );
    removeStreamSpy = () => {
      removeStdoutSpy();
      removeStderrSpy();
    };
  } else {
    removeStreamSpy = spyStreamOutput(stream, writeFromOutsideEffect);
  }

  const destroy = () => {
    dynamicLog.destroyed = true;
    if (removeStreamSpy) {
      removeStreamSpy();
      removeStreamSpy = null;
      lastOutput = "";
      lastOutputFromOutside = "";
    }
  };

  Object.assign(dynamicLog, {
    update,
    destroy,
    stream,
    clearDuringFunctionCall,
  });
  return dynamicLog;
};

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
const spyStreamOutput = (stream, callback) => {
  const originalWrite = stream.write;

  let output = "";
  let installed = true;

  stream.write = function (...args /* chunk, encoding, callback */) {
    output += args;
    callback(output);
    return originalWrite.call(stream, ...args);
  };

  const uninstall = () => {
    if (!installed) {
      return;
    }
    stream.write = originalWrite;
    installed = false;
  };

  return () => {
    uninstall();
    return output;
  };
};
