import { readFile, statSync } from "node:fs";

const _internalFs = process.binding("fs");

const readFileAsync = (url) =>
  new Promise((resolve, reject) => {
    readFile(new URL(url), (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });

const getFileState = (file) => {
  try {
    // const fileContent = readFileSync(file);
    const { mtimeMs } = statSync(file);
    return {
      found: true,
      mtimeMs,
      // content: String(fileContent),
    };
  } catch (e) {
    if (e.code === "ENOENT") {
      return {
        found: false,
      };
    }
    throw e;
  }
};

const openOriginal = _internalFs.open;
const closeOriginal = _internalFs.close;
const callWithoutSpy = (fn) => {
  const openPrev = _internalFs.open;
  const closePrev = _internalFs.close;
  _internalFs.open = openOriginal;
  _internalFs.close = closeOriginal;
  try {
    return fn();
  } finally {
    _internalFs.open = openPrev;
    _internalFs.close = closePrev;
  }
};
const testAGivenSpy = async (name, openSpy, closeSpy) => {
  let openSpyExecuting = false;
  _internalFs.open = function (...args) {
    if (openSpyExecuting) {
      return openOriginal.call(this, ...args);
    }
    openSpyExecuting = true;
    try {
      return openSpy.call(this, ...args);
    } finally {
      openSpyExecuting = false;
    }
  };
  if (closeSpy) {
    let closeSpyExecuting = false;
    _internalFs.close = function (...args) {
      if (closeSpyExecuting) {
        return closeOriginal.call(this, ...args);
      }
      closeSpyExecuting = true;
      try {
        return closeSpy.call(this, ...args);
      } finally {
        closeSpyExecuting = false;
      }
    };
  }

  console.log(`"${name}": start`);
  await readFileAsync(import.meta.url);
  await readFileAsync(import.meta.url);
  console.log(`"${name}": OK`);
  _internalFs.open = openOriginal;
  _internalFs.close = closeOriginal;
};

// await testAGivenSpy("do nothing", function (...args) {
//   return openOriginal.call(this, ...args);
// });
// await testAGivenSpy("do not return", function (...args) {
//   openOriginal.call(this, ...args);
// });
// await testAGivenSpy("read sync before", function (...args) {
//   readFileSync(new URL(import.meta.url));
//   openOriginal.call(this, ...args);
// });
// await testAGivenSpy("hook into callback", function (...args) {
//   const [, , , callback] = args;
//   if (callback) {
//     const original = callback.oncomplete;
//     callback.oncomplete = function (...args) {
//       callback.oncomplete = original;
//       const [error, fd] = args;
//       if (error) {
//         original.call(this, ...args);
//       } else {
//         console.log("fd is", fd);
//         original.call(this, ...args);
//       }
//     };
//   }
//   openOriginal.call(this, ...args);
// });
// await testAGivenSpy(
//   "hook into open and close callback",
//   function (...args) {
//     const [, , , callback] = args;
//     if (callback) {
//       //   if (callback.context) {
//       //     const original = callback.context.callback;
//       //     callback.context.callback = function (...args) {
//       //       callback.context.callback = original;
//       //       const [error, fd] = args;
//       //       if (error) {
//       //         original.call(this, ...args);
//       //       } else {
//       //         console.log("fd is", fd);
//       //         original.call(this, ...args);
//       //       }
//       //     };
//       //     openOriginal.call(this, ...args);
//       //     return;
//       //   }
//       const original = callback.oncomplete;
//       callback.oncomplete = function (...args) {
//         callback.oncomplete = original;
//         const [error, fd] = args;
//         if (error) {
//           original.call(this, ...args);
//         } else {
//           console.log("fd is", fd);
//           original.call(this, ...args);
//         }
//       };
//       openOriginal.call(this, ...args);
//       return;
//     }
//     openOriginal.call(this, ...args);
//   },
//   function (...args) {
//     const [, callback] = args;
//     if (callback) {
//       if (callback.context) {
//         const original = callback.context.callback;
//         callback.context.callback = function (...args) {
//           callback.context.callback = original;
//           const [error] = args;
//           if (error) {
//             original.call(this, ...args);
//           } else {
//             original.call(this, ...args);
//             console.log("close done ASYNC AFTER READ");
//           }
//         };
//         closeOriginal.call(this, ...args);
//         return;
//       }
//       const original = callback.oncomplete;
//       callback.oncomplete = function (...args) {
//         callback.oncomplete = original;
//         const [error] = args;
//         if (error) {
//           original.call(this, ...args);
//         } else {
//           original.call(this, ...args);
//           console.log("close done ASYNC REGULAR");
//         }
//       };
//       closeOriginal.call(this, ...args);
//       return;
//     }
//     console.log("close done sync");
//     closeOriginal.call(this, ...args);
//   },
// );

const fdPathMap = new Map();
const stateBeforeOpenMap = new Map();
await testAGivenSpy(
  "all together",
  function (...args) {
    const [path, , , callback] = args;
    // const stateBeforeOpen = getFileState(path);
    // stateBeforeOpenMap.set(path, stateBeforeOpen);
    if (callback) {
      if (callback.context) {
        const original = callback.context.callback;
        callback.context.callback = function (...args) {
          callback.context.callback = original;
          const [error, fd] = args;
          if (error) {
            original.call(this, ...args);
          } else {
            console.log("fd is", fd);
            original.call(this, ...args);
          }
        };
        openOriginal.call(this, ...args);
        return;
      }
      const original = callback.oncomplete;
      callback.oncomplete = function (...args) {
        callback.oncomplete = original;
        const [error, fd] = args;
        if (error) {
          original.call(this, ...args);
        } else {
          fdPathMap.set(fd, path);
          console.log("fd is", fd);
          original.call(this, ...args);
        }
      };
      openOriginal.call(this, ...args);
      return;
    }
    openOriginal.call(this, ...args);
  },
  function (...args) {
    const [fd, callback] = args;
    if (callback) {
      if (callback.context) {
        const original = callback.context.callback;
        callback.context.callback = function (...args) {
          callback.context.callback = original;
          const [error] = args;
          if (error) {
            original.call(this, ...args);
          } else {
            original.call(this, ...args);
            const path = fdPathMap.get(fd);
            if (path) {
              const stateBefore = stateBeforeOpenMap.get(path);
              const stateAfter = callWithoutSpy(() => getFileState(path));
              console.log("after close state", stateBefore, stateAfter);
            } else {
              console.log("close done ASYNC AFTER READ");
            }
          }
        };
        closeOriginal.call(this, ...args);
        return;
      }
      const original = callback.oncomplete;
      callback.oncomplete = function (...args) {
        callback.oncomplete = original;
        const [error] = args;
        if (error) {
          original.call(this, ...args);
        } else {
          original.call(this, ...args);
          console.log("close done ASYNC REGULAR");
        }
      };
      closeOriginal.call(this, ...args);
      return;
    }
    console.log("close done sync");
    closeOriginal.call(this, ...args);
  },
);
