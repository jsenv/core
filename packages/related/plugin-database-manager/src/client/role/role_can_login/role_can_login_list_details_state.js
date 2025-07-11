import { valueInLocalStorage } from "@jsenv/navi";
import { ROLE_CAN_LOGIN } from "../role_store.js";

const [
  readRoleCanLoginListDetailsOpened,
  storeRoleCanLoginListDetailsOpened,
  eraseRoleCanLoginListDetailsOpened,
] = valueInLocalStorage("role_can_login_list_details_opened", {
  type: "boolean",
});

export const roleCanLoginListDetailsOpenAtStart =
  readRoleCanLoginListDetailsOpened();

if (roleCanLoginListDetailsOpenAtStart) {
  ROLE_CAN_LOGIN.GET_MANY.preload(); // et encore c'est seulement si on est sur la bonne page sinon c'est con
}

export const roleCanLoginListDetailsOnToggle = (detailsOpen) => {
  if (detailsOpen) {
    storeRoleCanLoginListDetailsOpened(true);
  } else {
    eraseRoleCanLoginListDetailsOpened();
  }
};
