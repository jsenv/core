import stripAnsi from "strip-ansi";
import { writeFileSync } from "@jsenv/filesystem";

export const reporterFile = ({ url }) => {
  return {
    reporter: "file",
    beforeAll: () => {
      let rawOutput = "";
      const { write } = process.stdout;
      process.stdout.write = (...args) => {
        for (const arg of args) {
          rawOutput += stripAnsi(arg);
          writeFileSync(url, rawOutput);
        }
        return write.apply(process.stdout, args);
      };
      return {
        afterAll: () => {
          process.stdout.write = write;
        },
      };
    },
  };
};
