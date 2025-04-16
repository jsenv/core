import { syncMarkdown } from "@jsenv/md-up";

syncMarkdown(new URL("./users/users.md", import.meta.url));
syncMarkdown(
  new URL("../packages/tooling/assert/tests/readme.md", import.meta.url),
);
syncMarkdown(
  new URL("../packages/tooling/file-size-impact/readme.md", import.meta.url),
);
