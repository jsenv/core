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

  const items = users.map(user => {
    return {
      text: user.username,
      url: `/.internal/database/api/users/${user.username}`,
    };
  })

  return <DatabaseNavGroup label="users" items={users} />;
};

const DatabaseNavGroup = ({ label, items }) => {
  return (
    <details>
      <summary>{label}</summary>
      <nav>
        {items.map((item) => {
          return <a href={item.url}>{item.text}</>;
        })}
      </nav>
    </details>
  );
};
