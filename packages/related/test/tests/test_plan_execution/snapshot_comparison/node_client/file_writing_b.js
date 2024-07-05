import { writeFileSync } from "node:fs";

writeFileSync(new URL("./git_ignored/file.txt", import.meta.url), "b");
