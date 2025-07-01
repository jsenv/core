import { valueInLocalStorage } from "@jsenv/router";
import { ROLE } from "../role_store.js";

const [
  readRoleCanLoginListDetailsOpened,
  storeRoleCanLoginListDetailsOpened,
  eraseRoleCanLoginListDetailsOpened,
] = valueInLocalStorage("role_can_login_list_details_opened", {
  type: "boolean",
});

if (readRoleCanLoginListDetailsOpened()) {
  // et encore c'est seulement si on est sur la bonne page sinon c'est con
  ROLE.GET_MANY_CAN_LOGIN.preload();
}

export const onRoleCanLoginListDetailsToggle = (opened) => {
  if (opened) {
    storeRoleCanLoginListDetailsOpened(true);
  } else {
    eraseRoleCanLoginListDetailsOpened();
  }
};
