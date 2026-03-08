import { valueInLocalStorage } from "@jsenv/navi";

const [
  readRoleCanLoginListDetailsOpened,
  storeRoleCanLoginListDetailsOpened,
  eraseRoleCanLoginListDetailsOpened,
] = valueInLocalStorage("role_can_login_list_details_opened", {
  type: "boolean",
});

export const roleCanLoginListDetailsOpenAtStart =
  readRoleCanLoginListDetailsOpened();

export const roleCanLoginListDetailsOnToggle = (detailsOpen) => {
  if (detailsOpen) {
    storeRoleCanLoginListDetailsOpened(true);
  } else {
    eraseRoleCanLoginListDetailsOpened();
  }
};
