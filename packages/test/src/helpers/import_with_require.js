import { createRequire } from "node:module";

export const importWithRequire = createRequire(import.meta.url);
