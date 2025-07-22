import { defineRoutes, resource, Route, useDocumentUrl } from "@jsenv/navi";
import { render } from "preact";

import.meta.css = /* css */ `
  body {
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }
  .nav-links {
    margin-bottom: 20px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 5px;
  }
  .nav-links a {
    margin-right: 15px;
    text-decoration: none;
    color: #007bff;
    padding: 5px 10px;
    border-radius: 3px;
  }
  .nav-links a:hover {
    background: #e9ecef;
  }
  .nav-links a.active {
    background: #007bff;
    color: white;
  }
  .user-details {
    margin: 20px 0;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 5px;
  }
  .actions {
    margin-top: 15px;
  }
  button {
    margin-right: 10px;
    margin-bottom: 10px;
    padding: 8px 15px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    background: #007bff;
    color: white;
  }
  button:hover {
    background: #0056b3;
  }
  button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
  .current-url {
    margin-top: 10px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 3px;
    font-family: monospace;
    font-size: 14px;
  }
  .loading {
    opacity: 0.6;
  }
  .error {
    color: #dc3545;
    background: #f8d7da;
    padding: 10px;
    border-radius: 3px;
  }
`;

const App = () => {
  return (
    <div>
      <h1>User Navigation Test</h1>
      <Navigation />
      <Route route={USER_ROUTE}>{(user) => <UserPage user={user} />}</Route>
      <CurrentUrl />
    </div>
  );
};

const Navigation = () => {
  const users = USER.useArray();

  return (
    <div className="nav-links">
      {users.map((user) => (
        <a
          key={user.id}
          href={`/user/${user.name}`}
          className={
            window.location.pathname === `/user/${user.name}` ? "active" : ""
          }
        >
          {user.name}
        </a>
      ))}
    </div>
  );
};

const UserPage = ({ user }) => {
  const isRenamed = user.name !== user.originalName;

  const handleRename = async () => {
    const renameAction = USER.PUT.bindParams({
      username: user.name,
      property: "name",
      value: `${user.name}_2`,
    });
    await renameAction.load();
  };

  const handleRevert = async () => {
    const revertAction = USER.PUT.bindParams({
      username: user.name,
      property: "name",
      value: user.originalName,
    });
    await revertAction.load();
  };

  return (
    <div className="user-details">
      <h2>User: {user.name}</h2>
      <p>
        <strong>ID:</strong> {user.id}
      </p>
      <p>
        <strong>Email:</strong> {user.email}
      </p>
      <p>
        <strong>Original Name:</strong> {user.originalName}
      </p>
      <p>
        <strong>Current Name:</strong> {user.name}
      </p>
      <p>
        <strong>Status:</strong> {isRenamed ? "Renamed" : "Original"}
      </p>

      <div className="actions">
        <button
          onClick={handleRename}
          disabled={USER.PUT.loadingState === "LOADING"}
        >
          Rename to &quot;{user.name}_2&quot;
        </button>
        <button
          onClick={handleRevert}
          disabled={!isRenamed || USER.PUT.loadingState === "LOADING"}
        >
          Revert to Original Name
        </button>
      </div>
    </div>
  );
};

const CurrentUrl = () => {
  const documentUrl = useDocumentUrl();

  return (
    <div className="current-url">
      Current URL: <span>{documentUrl}</span>
    </div>
  );
};

const initialUsers = [
  {
    id: 1,
    name: "alice",
    email: "alice@example.com",
    originalName: "alice",
  },
  { id: 2, name: "bob", email: "bob@example.com", originalName: "bob" },
  {
    id: 3,
    name: "charlie",
    email: "charlie@example.com",
    originalName: "charlie",
  },
];
const USER = resource("user", {
  idKey: "id",
  mutableIdKeys: ["name"],
  GET_MANY: () => initialUsers,
  GET: async ({ username }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return initialUsers.find((user) => user.name === username);
  },
  PUT: ({ username, property, value }) => {
    const user = initialUsers.find((user) => user.name === username);
    return {
      ...user,
      [property]: value,
    };
  },
});

const [USER_ROUTE] = defineRoutes({
  "/user/:username": USER.GET,
});

// Populate initial users in the store
USER.store.upsert(initialUsers);

render(<App />, document.querySelector("#app"));
