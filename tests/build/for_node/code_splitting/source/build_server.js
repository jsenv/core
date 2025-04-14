import { FOO } from "foo";
import { answer } from "./shared.js";

export const startBuildServer = async () => {
  await import("bar");

  console.log("start build server", FOO, answer);
};
