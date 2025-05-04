import { signal, effect } from "@preact/signals";
import { useDetails } from "@jsenv/router";

const navbarInfoSignal = signal({ currentUser: null, users: [] });
effect(async () => {
  const response = await fetch(`/.internal/database/api/nav`);
  const data = await response.json();
  navbarInfoSignal.value = data;
});

export const DatabaseNavbar = () => {
  return (
    <nav>
      <DatabaseNavGroupUsers />
    </nav>
  );
};

const DatabaseNavGroupUsers = () => {
  const { currentUserName, users } = navbarInfoSignal.value;

  const items = users.map((user) => {
    return {
      text: (
        <>
          {user.rolname.startsWith("pg_") ? (
            <span style="width: 1em; height: 1em">
              <PgUserSvg color="#333" />
            </span>
          ) : (
            <span style="width: 1em; height: 1em">
              <UserSvg color="#333" />
            </span>
          )}
          {user.rolname === currentUserName ? (
            <span style="width: 1em; height: 1em">
              <ActiveUserSvg />
            </span>
          ) : null}
          <span>{user.rolname}</span>
        </>
      ),
      url: `/.internal/database/api/users/${user.rolname}`,
    };
  });

  return <DatabaseNavGroup label="users" items={items} />;
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

const UserSvg = ({ color = "currentColor" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      fill="none"
    >
      <path
        d="M12.1992 12C14.9606 12 17.1992 9.76142 17.1992 7C17.1992 4.23858 14.9606 2 12.1992 2C9.43779 2 7.19922 4.23858 7.19922 7C7.19922 9.76142 9.43779 12 12.1992 12Z"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M3 22C3.57038 20.0332 4.74796 18.2971 6.3644 17.0399C7.98083 15.7827 9.95335 15.0687 12 15C16.12 15 19.63 17.91 21 22"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

const PgUserSvg = ({ color = "currentColor" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
    >
      <path
        d="M4 21C4 17.4735 6.60771 14.5561 10 14.0709M19.8726 15.2038C19.8044 15.2079 19.7357 15.21 19.6667 15.21C18.6422 15.21 17.7077 14.7524 17 14C16.2923 14.7524 15.3578 15.2099 14.3333 15.2099C14.2643 15.2099 14.1956 15.2078 14.1274 15.2037C14.0442 15.5853 14 15.9855 14 16.3979C14 18.6121 15.2748 20.4725 17 21C18.7252 20.4725 20 18.6121 20 16.3979C20 15.9855 19.9558 15.5853 19.8726 15.2038ZM15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
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
