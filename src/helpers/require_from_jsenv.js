import { createRequire } from "node:module";

export const requireFromJsenv = createRequire(import.meta.url);
