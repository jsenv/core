import { signal, effect } from "@preact/signals";

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
      text: user.username,
      url: `/.internal/database/api/users/${user.username}`,
    };
  });

  return <DatabaseNavGroup label="users" items={items} />;
};

const DatabaseNavGroup = ({ label, items }) => {
  return (
    <details>
      <summary>
        <ArrowDown />
        {label}
      </summary>
      <nav>
        {items.map((item) => {
          return (
            <a key={item.url} href={item.url}>
              {item.text}
            </a>
          );
        })}
      </nav>
    </details>
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
