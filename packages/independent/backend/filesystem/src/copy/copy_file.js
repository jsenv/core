import { copyEntry } from "./copy_entry.js";

export const copyFile = ({ from, to, ...options }) => {
  copyEntry({
    from,
    to,
    ...options,
  });
};
