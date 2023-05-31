/*
 *
 */

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
export const spyStreamOutput = (stream) => {
  const originalWrite = stream.write;

  let output = "";
  let installed = true;

  stream.write = function (...args /* chunk, encoding, callback */) {
    output += args;
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
