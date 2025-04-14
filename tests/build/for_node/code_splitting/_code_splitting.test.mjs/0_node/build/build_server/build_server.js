import { FOO } from "./jsenv_core_node_modules.js";

const answer = 42;

const startBuildServer = async () => {
  await import("./bar_index/bar_index.js");

  console.log("start build server", FOO, answer);
};

export { startBuildServer };
