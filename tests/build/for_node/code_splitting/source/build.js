import { FOO } from "foo";
import { answer } from "./shared.js";

export const build = async () => {
  await import("bar");

  console.log("build", FOO, answer);
};
