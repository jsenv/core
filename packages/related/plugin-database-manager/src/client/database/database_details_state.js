import { valueInLocalStorage } from "@jsenv/navi";

const [
  readDatabaseListDetailsOpened,
  storeDatabaseListDetailsOpened,
  eraseDatabaseListDetailsOpened,
] = valueInLocalStorage("databases_details_opened", {
  type: "boolean",
});

export const databaseListDetailsOpenAtStart = readDatabaseListDetailsOpened();

export const databaseListDetailsOnToggle = (detailsOpen) => {
  if (detailsOpen) {
    storeDatabaseListDetailsOpened(true);
  } else {
    eraseDatabaseListDetailsOpened();
  }
};
