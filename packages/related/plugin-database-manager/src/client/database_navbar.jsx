/**
 * - ability to select a user
 *   -> would open the user in <main> + naviguate in the url
 *   -> a visual indicator would show it's selected
 *
 *   the page displaying a user needs to be done
 * - ability to rename by enter
 * - a button to create an item (user) in the group (like in vscode)
 * by default would create a user at the bottom of the list of regular user
 * (we would resort afterwards to ensure it's at the correct location once created)
 * - cmd + backspace would allow to delete a user (after a confirm)
 */

import { signal, effect } from "@preact/signals";
import { useDetails, useRouteUrl } from "@jsenv/router";
import { UserWithHatSvg, UserSvg, UserWithCheckSvg } from "./user_svgs.jsx";
import { GET_ROLE_ROUTE } from "./role/role_routes.js";

const navbarInfoSignal = signal({ currentRole: null, roles: [] });
effect(async () => {
  const response = await fetch(`/.internal/database/api/nav`);
  const data = await response.json();
  navbarInfoSignal.value = data;
});

export const DatabaseNavbar = () => {
  return (
    <nav>
      <DatabaseNavGroupRoles />
    </nav>
  );
};

const DatabaseNavGroupRoles = () => {
  const { currentRole, roles } = navbarInfoSignal.value;

  roles.sort((a, b) => {
    const aIsCurrent = a.rolname === currentRole.rolname;
    if (aIsCurrent) {
      return -1;
    }
    const bIsCurrent = b.rolname === currentRole.rolname;
    if (bIsCurrent) {
      return 1;
    }
    const aIsPg = a.rolname.startsWith("pg_");
    const bIsPg = b.rolname.startsWith("pg_");
    if (aIsPg && !bIsPg) {
      return 1;
    }
    if (bIsPg && !aIsPg) {
      return -1;
    }
    return 0;
  });
  const items = roles.map((role) => {
    const roleName = role.rolname;
    const itemRouteUrl = useRouteUrl(GET_ROLE_ROUTE, { roleName });

    return {
      text: (
        <>
          <span style="width: 1em; height: 1em">
            {roleName.startsWith("pg_") ? (
              <UserWithCheckSvg color="#333" />
            ) : role.rolsuper ? (
              <UserWithHatSvg color="#333" />
            ) : (
              <UserSvg color="#333" />
            )}
          </span>
          {roleName === currentRole.rolname ? (
            <span style="width: 1em; height: 1em">
              <ActiveUserSvg />
            </span>
          ) : null}
          <span>{roleName}</span>
        </>
      ),
      url: itemRouteUrl,
    };
  });

  return <DatabaseNavGroup label="roles" items={items} />;
};

const DatabaseNavGroup = ({ label, items }) => {
  const detailsProps = useDetails(label);

  return (
    <details {...detailsProps}>
      <summary>
        <ArrowDown />
        {label}
      </summary>
      <ul className="nav_group_list">
        {items.map((item) => {
          return (
            <li className="nav_group_list_item" key={item.url}>
              <DatabaseNavItem
                url={item.url}
                text={item.text}
                icon={item.icon}
              />
            </li>
          );
        })}
      </ul>
    </details>
  );
};

const DatabaseNavItem = ({ url, text, icon }) => {
  return (
    <a
      href={url}
      style="display: flex; gap: 0.2em; align-items: center; white-space: nowrap;"
    >
      {icon}
      {text}
    </a>
  );
};

const ActiveUserSvg = () => {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <path
        d="m 8 0 c -3.3125 0 -6 2.6875 -6 6 c 0.007812 0.710938 0.136719 1.414062 0.386719 2.078125 l -0.015625 -0.003906 c 0.636718 1.988281 3.78125 5.082031 5.625 6.929687 h 0.003906 v -0.003906 c 1.507812 -1.507812 3.878906 -3.925781 5.046875 -5.753906 c 0.261719 -0.414063 0.46875 -0.808594 0.585937 -1.171875 l -0.019531 0.003906 c 0.25 -0.664063 0.382813 -1.367187 0.386719 -2.078125 c 0 -3.3125 -2.683594 -6 -6 -6 z m 0 3.691406 c 1.273438 0 2.308594 1.035156 2.308594 2.308594 s -1.035156 2.308594 -2.308594 2.308594 c -1.273438 -0.003906 -2.304688 -1.035156 -2.304688 -2.308594 c -0.003906 -1.273438 1.03125 -2.304688 2.304688 -2.308594 z m 0 0"
        fill="#2e3436"
      />
    </svg>
  );
};

const ArrowDown = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width="24"
      height="24"
      fill="currentColor"
    >
      <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z" />
    </svg>
  );
};
// const ArrowUp = () => {
//   return (
//     <svg
//       xmlns="http://www.w3.org/2000/svg"
//       viewBox="0 -960 960 960"
//       width="24"
//       height="24"
//       fill="currentColor"
//     >
//       <path d="M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z" />
//     </svg>
//   );
// };
