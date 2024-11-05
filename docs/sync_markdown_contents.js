import { syncMarkdown } from "@jsenv/md-up";

syncMarkdown(new URL("./users/users.md", import.meta.url));
syncMarkdown(
  new URL("../packages/independent/assert/tests/readme.md", import.meta.url),
);
