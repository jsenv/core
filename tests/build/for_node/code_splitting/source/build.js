import { FOO } from "foo";
import { answer } from "./shared.js";

export const build = () => {
  console.log("build", answer, FOO);
};
