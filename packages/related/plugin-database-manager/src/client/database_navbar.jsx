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
  const {
    // currentUser,
    users,
  } = navbarInfoSignal.value;

  const items = users.map((user) => {
    return {
      icon: user.rolname.startsWith("pg_") ? (
        <span style="width: 1em; height: 1em">
          <PgUserSvg color="#333" />
        </span>
      ) : (
        <span style="width: 1em; height: 1em">
          <UserSvg color="#333" />
        </span>
      ),
      text: <span>{user.rolname}</span>,
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
      <ul>
        {items.map((item) => {
          return (
            <li key={item.url}>
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
    <a href={url} style="display: flex; gap: 0.2em; align-items: center;">
      {icon}

      {text}
    </a>
  );
};

const UserSvg = ({ color = "currentColor" }) => {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
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
      <g>
        <UserSvg color={color} />
      </g>
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
