import { defineRoutes, resource, Route, useRouteStatus } from "@jsenv/navi";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

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
      <Route route={USER_ROUTE}>
        <UserDetails />
      </Route>
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

const UserDetails = () => {
  const { active, params } = useRouteStatus(USER_ROUTE);
  const userAction = USER.GET.bindParams(params);

  useEffect(() => {
    if (active) {
      userAction.load();
    }
  }, [active, params.username]);

  if (!active) {
    return <p>No user selected. Click on a user link above.</p>;
  }

  if (userAction.loadingState === "LOADING") {
    return (
      <div className="user-details loading">
        <p>Loading user...</p>
      </div>
    );
  }

  if (userAction.loadingState === "FAILED") {
    return (
      <div className="error">
        Error: {userAction.error?.message || "Failed to load user"}
      </div>
    );
  }

  const currentUser = userAction.data;
  if (!currentUser) {
    return <p>User not found.</p>;
  }

  const isRenamed = currentUser.name !== currentUser.originalName;

  const handleRename = async () => {
    try {
      const renameAction = USER.PUT.bindParams({
        username: currentUser.name,
        property: "name",
        value: `${currentUser.name}_2`,
      });
      await renameAction.load();
      // Reload the current user to get updated data
      await userAction.reload();
    } catch (error) {
      console.error("Failed to rename user:", error);
      // eslint-disable-next-line no-alert
      window.alert(`Failed to rename user: ${error.message}`);
    }
  };

  const handleRevert = async () => {
    try {
      const revertAction = USER.PUT.bindParams({
        username: currentUser.name,
        property: "name",
        value: currentUser.originalName,
      });
      await revertAction.load();
      // Reload the current user to get updated data
      await userAction.reload();
    } catch (error) {
      console.error("Failed to revert user name:", error);
      // eslint-disable-next-line no-alert
      window.alert(`Failed to revert user name: ${error.message}`);
    }
  };

  return (
    <div className="user-details">
      <h2>User: {currentUser.name}</h2>
      <p>
        <strong>ID:</strong> {currentUser.id}
      </p>
      <p>
        <strong>Email:</strong> {currentUser.email}
      </p>
      <p>
        <strong>Original Name:</strong> {currentUser.originalName}
      </p>
      <p>
        <strong>Current Name:</strong> {currentUser.name}
      </p>
      <p>
        <strong>Status:</strong> {isRenamed ? "Renamed" : "Original"}
      </p>

      <div className="actions">
        <button
          onClick={handleRename}
          disabled={USER.PUT.loadingState === "LOADING"}
        >
          Rename to &quot;{currentUser.name}_2&quot;
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
  const [currentUrl, setCurrentUrl] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentUrl(window.location.pathname);
    };

    window.addEventListener("popstate", handleLocationChange);
    // Also listen for pushstate/replacestate
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleLocationChange();
    };

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return (
    <div className="current-url">
      Current URL: <span>{currentUrl}</span>
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
