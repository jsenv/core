import { FOO } from "./jsenv_core_node_modules.js";

const answer = 42;

const startDevServer = () => {
  console.log("start dev server", answer, FOO);
};

export { startDevServer };
