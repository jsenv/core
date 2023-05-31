import { createRequire } from "node:module";

export const requireBabelPlugin = createRequire(import.meta.url);
