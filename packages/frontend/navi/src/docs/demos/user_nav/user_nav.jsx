import {
  defineRoutes,
  resource,
  Route,
  useDocumentState,
  useDocumentUrl,
} from "@jsenv/navi";
import { signal } from "@preact/signals";
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
      <Route route={USER_ROUTE}>{(user) => <UserPage user={user} />}</Route>
      <DocumentInfo />
    </div>
  );
};

const Navigation = () => {
  const users = USER.useArray();

  return (
    <div className="nav-links">
      {users.map((user) => {
        const url = USER_ROUTE.buildUrl({ username: user.name });
        return (
          <a key={user.id} href={url}>
            {user.name}
          </a>
        );
      })}
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

      <MutableIdSignalDemo currentUser={user} />
    </div>
  );
};

const MutableIdSignalDemo = ({ currentUser }) => {
  // Create a signal that tracks the current user's name
  const currentUserNameSignal = signal(currentUser.name);

  // Update the signal when the user changes
  useEffect(() => {
    currentUserNameSignal.value = currentUser.name;
  }, [currentUser.name]);

  // Use signalForMutableIdKey to get a signal that tracks the user by name
  const userFromMutableIdSignal = USER.store.signalForMutableIdKey(
    "name",
    currentUserNameSignal,
  );

  // Get the current value
  const [signalValue, setSignalValue] = useState(userFromMutableIdSignal.value);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = userFromMutableIdSignal.subscribe((newValue) => {
      setSignalValue(newValue);
    });
    return unsubscribe;
  }, []);

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "15px",
        backgroundColor: "#f0f8ff",
        borderRadius: "5px",
        border: "1px solid #007bff",
      }}
    >
      <h3>signalForMutableIdKey Demo</h3>
      <p>
        <strong>Current Route User:</strong> {currentUser.name} (ID:{" "}
        {currentUser.id})
      </p>
      <p>
        <strong>Signal Value:</strong>{" "}
        {signalValue ? `${signalValue.name} (ID: ${signalValue.id})` : "null"}
      </p>
      <p style={{ fontSize: "0.9em", color: "#666" }}>
        💡 This signal should return the same user even if you rename them,
        demonstrating the caching behavior of signalForMutableIdKey.
      </p>
      {signalValue && signalValue.id === currentUser.id && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✅ Signal correctly returns the same user instance!
        </p>
      )}
      {signalValue && signalValue.id !== currentUser.id && (
        <p style={{ color: "orange", fontWeight: "bold" }}>
          ⚠️ Signal returned a different user (this might happen during
          transitions)
        </p>
      )}
      {!signalValue && (
        <p style={{ color: "red", fontWeight: "bold" }}>
          ❌ Signal returned null (user not found in store)
        </p>
      )}
    </div>
  );
};

const DocumentInfo = () => {
  const documentUrl = useDocumentUrl();
  const documentState = useDocumentState();

  return (
    <div>
      <div>
        Current URL: <div className="current-url">{documentUrl}</div>
      </div>
      <div className="current-state">
        Current State: <pre>{JSON.stringify(documentState, null, 2)}</pre>
      </div>
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
  {
    id: 2,
    name: "bob",
    email: "bob@example.com",
    originalName: "bob",
  },
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
