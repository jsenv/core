import { writeFileSync } from "node:fs";

writeFileSync(new URL("./my_snapshots/", import.meta.url), "b");
