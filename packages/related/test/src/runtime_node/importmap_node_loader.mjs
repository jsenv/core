import { register } from "node:module";

register(new URL("./importmap_hooks.mjs", import.meta.url));
