import { parentPort } from "node:worker_threads";
import { readFileSync } from "node:fs";
import vm from "node:vm";

parentPort.once("message", ({ filePath }) => {
  const fileContents = readFileSync(filePath, "utf8");
  const codeToRun = wrapCodeToRunInVm(fileContents);
  const script = new vm.Script(codeToRun);
  try {
    const returnValue = script.runInNewContext(
      {},
      {
        contextCodeGeneration: {
          wasm: false,
        },
      },
    );
    const exportNames = Object.keys(returnValue);
    parentPort.postMessage({
      exportNames,
    });
  } catch (e) {
    parentPort.postMessage({
      errorMessage: e.message,
    });
  }
});

const wrapCodeToRunInVm = (code) => {
  return `const exports = {};
const module = { exports };
${code};;
module.exports;`;
};
