import { FOO } from "/jsenv_core_node_modules.js";
import { answer } from "/main_build.js";

const startDevServer = () => {
  console.log("start dev server", FOO, answer);
};

export { startDevServer };
