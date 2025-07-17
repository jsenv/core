import { RoleCanLoginPage } from "./role_can_login/role_can_login_page.jsx";
import { RoleGroupPage } from "./role_group/role_group_page.jsx";

export const RolePage = ({ role }) => {
  if (role.rolcanlogin) {
    return <RoleCanLoginPage role={role} />;
  }
  return <RoleGroupPage role={role} />;
};
