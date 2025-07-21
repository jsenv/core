import { valueInLocalStorage } from "@jsenv/navi";

const [
  readRoleWithOwnershipListDetailsOpened,
  storeRoleWithOwnershipListDetailsOpened,
  eraseRoleWithOwnsershipListDetailsOpened,
] = valueInLocalStorage("role_with_ownership_list_details_opened", {
  type: "boolean",
});

export const roleWithOwnershipListDetailsOpenAtStart =
  readRoleWithOwnershipListDetailsOpened();

export const roleWithOwnershipListDetailsOnToggle = (detailsOpen) => {
  if (detailsOpen) {
    storeRoleWithOwnershipListDetailsOpened(true);
  } else {
    eraseRoleWithOwnsershipListDetailsOpened();
  }
};
