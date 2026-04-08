import { useAsyncData } from "@jsenv/navi";

import { ROLE_GET_ACTION } from "../routes.js";
import { RoleCanLoginPage } from "./role_can_login/role_can_login_page.jsx";
import { RoleGroupPage } from "./role_group/role_group_page.jsx";

export const RolePage = () => {
  const [role] = useAsyncData(ROLE_GET_ACTION);

  if (role.rolcanlogin) {
    return <RoleCanLoginPage role={role} />;
  }
  return <RoleGroupPage role={role} />;
};
