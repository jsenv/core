import { humanize } from "@jsenv/humanize";

console.log(
  humanize({
    boolean: true,
    number: 10,
    string: "hello world",
  }),
);
