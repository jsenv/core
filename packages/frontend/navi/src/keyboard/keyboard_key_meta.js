import { isMac } from "./os.js";

// Maps canonical browser key names to their user-friendly aliases.
// Used for both event matching and ARIA normalization.
export const keyMapping = {
  " ": { alias: ["space"] },
  "escape": { alias: ["esc"] },
  "arrowup": { alias: ["up"] },
  "arrowdown": { alias: ["down"] },
  "arrowleft": { alias: ["left"] },
  "arrowright": { alias: ["right"] },
  "delete": { alias: ["del"] },
  // Platform-specific mappings
  ...(isMac
    ? { delete: { alias: ["backspace"] } }
    : { backspace: { alias: ["delete"] } }),
};
