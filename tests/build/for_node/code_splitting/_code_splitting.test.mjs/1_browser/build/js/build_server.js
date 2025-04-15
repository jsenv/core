import { FOO } from "/jsenv_core_node_modules.js";
import { answer } from "/main_build.js";

const startBuildServer = async () => {
  await import("/js/bar_index.js");

  console.log("start build server", FOO, answer);
};

export { startBuildServer };