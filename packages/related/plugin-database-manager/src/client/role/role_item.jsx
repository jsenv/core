import { FontSizedSvg } from "../components/font_sized_svg.jsx";
import { CurrentSvg } from "../icons/icons.jsx";
import { pickRoleIcon } from "./role_icons.jsx";
import { useCurrentRole } from "./role_signals.js";

export const RoleItem = ({ role }) => {
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && role.rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);

  return (
    <>
      <FontSizedSvg>
        <RoleIcon color="#333" />
      </FontSizedSvg>
      {isCurrent ? (
        <FontSizedSvg>
          <CurrentSvg />
        </FontSizedSvg>
      ) : null}
    </>
  );
};
