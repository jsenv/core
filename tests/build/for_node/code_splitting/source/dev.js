import { FOO } from "foo";
import { answer } from "./shared.js";

export const startDevServer = () => {
  console.log("start dev server", answer, FOO);
};
