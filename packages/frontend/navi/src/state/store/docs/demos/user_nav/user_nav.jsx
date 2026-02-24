import {
  resource,
  Route,
  setupRoutes,
  useDocumentState,
  useDocumentUrl,
} from "@jsenv/navi";
import { useSignal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

import.meta.css = /* css */ `
  body {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
  }
  .nav-links {
    margin-bottom: 20px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 5px;
  }
  .nav-links a {
    margin-right: 15px;
    padding: 5px 10px;
    color: #007bff;
    text-decoration: none;
    border-radius: 3px;
  }
  .nav-links a:hover {
    background: #e9ecef;
  }
  .nav-links a.active {
    color: white;
    background: #007bff;
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
    color: white;
    background: #007bff;
    border: none;
    border-radius: 3px;
    cursor: pointer;
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
    font-size: 14px;
    font-family: monospace;
    background: #f8f9fa;
    border-radius: 3px;
  }
  .loading {
    opacity: 0.6;
  }
  .error {
    padding: 10px;
    color: #dc3545;
    background: #f8d7da;
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
        const url = USER_ROUTE.buildUrl({ name: user.name });
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
    console.log("handleRename called for user:", user.name);
    const renameAction = USER.PUT.bindParams({
      name: user.name,
      property: "name",
      value: `${user.name}_2`,
    });
    console.log("About to call renameAction.load()");
    await renameAction.reload();
    console.log("renameAction.load() completed");
  };

  const handleRevert = async () => {
    const revertAction = USER.PUT.bindParams({
      name: user.name,
      property: "name",
      value: user.originalName,
    });
    await revertAction.reload();
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
  // Create a signal that tracks the ORIGINAL user's name (this should NOT change)
  const [originalName] = useState(currentUser.name);
  const originalUserNameSignal = useSignal(originalName);

  // Use signalForMutableIdKey to get a signal that tracks the user by the ORIGINAL name
  const userFromMutableIdSignal = USER.store.signalForMutableIdKey(
    "name",
    originalUserNameSignal,
  );

  // Get the current value
  const [signalValue, setSignalValue] = useState(userFromMutableIdSignal.value);

  // Subscribe to changes
  useEffect(() => {
    console.log(
      "MutableIdSignalDemo: Setting up subscription to userFromMutableIdSignal",
    );
    const unsubscribe = userFromMutableIdSignal.subscribe((newValue) => {
      console.log(
        "MutableIdSignalDemo: userFromMutableIdSignal changed to:",
        newValue,
      );
      setSignalValue(newValue);
    });
    return unsubscribe;
  }, []);

  console.log("MutableIdSignalDemo render:", {
    originalName,
    currentUserName: currentUser.name,
    currentUserId: currentUser.id,
    signalValueName: signalValue?.name,
    signalValueId: signalValue?.id,
    originalUserNameSignalValue: originalUserNameSignal.value,
  });

  // Check if a rename has occurred
  const hasBeenRenamed = currentUser.name !== originalName;

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
        <strong>Signal Tracking Original Name:</strong>{" "}
        {originalUserNameSignal.value}
      </p>
      <p>
        <strong>Signal Value:</strong>{" "}
        {signalValue ? `${signalValue.name} (ID: ${signalValue.id})` : "null"}
      </p>
      <p style={{ fontSize: "0.9em", color: "#666" }}>
        💡 This signal tracks by the original name &quot;{originalName}&quot;
        but should return the same user even after renaming, demonstrating the
        caching behavior of signalForMutableIdKey.
      </p>
      {signalValue && signalValue.id === currentUser.id && hasBeenRenamed && (
        <p style={{ color: "green", fontWeight: "bold" }}>
          ✅ Signal correctly returns the same user instance even after rename!
        </p>
      )}
      {signalValue && signalValue.id === currentUser.id && !hasBeenRenamed && (
        <p style={{ color: "blue", fontWeight: "bold" }}>
          🔵 Signal correctly returns the user (no rename yet)
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
          ❌ Signal returned null (user not found in store) - Looking for
          original name: &quot;{originalUserNameSignal.value}&quot;
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
  GET: async ({ name }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return initialUsers.find((user) => user.name === name);
  },
  PUT: ({ name, property, value }) => {
    console.log("PUT action called:", { name, property, value });
    const userIndex = initialUsers.findIndex((user) => user.name === name);
    if (userIndex === -1) {
      throw new Error(`User with name "${name}" not found`);
    }
    const user = initialUsers[userIndex];
    console.log("Found user:", user);
    const updatedUser = {
      ...user,
      [property]: value,
    };
    console.log("Updated user:", updatedUser);

    // Update the initialUsers array so future lookups work
    initialUsers[userIndex] = updatedUser;

    return updatedUser;
  },
});

const [USER_ROUTE] = setupRoutes({
  "/user/:name": USER.GET,
});

// Populate initial users in the store
USER.store.upsert(initialUsers);

render(<App />, document.querySelector("#app"));
