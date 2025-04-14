import { FOO } from "/jsenv_core_node_modules.js";
import { answer } from "/main_build.js";

const build = () => {
  console.log("build", answer, FOO);
};

export { build };
