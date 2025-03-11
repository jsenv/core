import { copyEntry } from "./copy_entry.js";

export const copyDirectory = ({ from, to, ...options }) => {
  copyEntry({
    from,
    to,
    ...options,
  });
};
