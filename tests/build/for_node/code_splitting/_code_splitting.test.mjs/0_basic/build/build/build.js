import { FOO } from "./jsenv_core_node_modules.js";

const answer = 42;

const build = () => {
  console.log("build", answer, FOO);
};

export { build };
