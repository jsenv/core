import { valueInLocalStorage } from "@jsenv/navi";

const [
  readRoleGroupListDetailsOpened,
  storeRoleGroupListDetailsOpened,
  eraseRoleGroupListDetailsOpened,
] = valueInLocalStorage("role_group_list_details_opened", {
  type: "boolean",
});

export const roleGroupListDetailsOpenAtStart = readRoleGroupListDetailsOpened();

export const roleGroupListDetailsOnToggle = (detailsOpen) => {
  if (detailsOpen) {
    storeRoleGroupListDetailsOpened(true);
  } else {
    eraseRoleGroupListDetailsOpened();
  }
};
