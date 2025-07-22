import { defineRoutes, resource, Route } from "@jsenv/navi";
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

const App = () => {};

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

// UI Functions
function updateNavigation() {
  const nav = document.getElementById("navigation");
  const currentPath = window.location.pathname;

  const users = USER.store.arraySignal.value;
  nav.innerHTML = users
    .map((user) => {
      const userPath = `/user/${user.name}`;
      const isActive = currentPath === userPath;
      return `<a href="${userPath}" class="${isActive ? "active" : ""}" data-route="${userPath}">${user.name}</a>`;
    })
    .join("");
}

function updateUserContent() {
  const content = document.getElementById("user-content");

  if (!userRoute.active) {
    content.innerHTML = "<p>No user selected. Click on a user link above.</p>";
    return;
  }

  const action = boundGetUserAction;
  const currentUser = action.data;

  if (action.loadingState === "LOADING") {
    content.innerHTML =
      '<div class="user-details loading"><p>Loading user...</p></div>';
    return;
  }

  if (action.loadingState === "FAILED") {
    content.innerHTML = `<div class="error">Error: ${action.error?.message || "Failed to load user"}</div>`;
    return;
  }

  if (!currentUser) {
    content.innerHTML = "<p>User not found.</p>";
    return;
  }

  const isRenamed = currentUser.name !== currentUser.originalName;

  content.innerHTML = `
                <div class="user-details">
                    <h2>User: ${currentUser.name}</h2>
                    <p><strong>ID:</strong> ${currentUser.id}</p>
                    <p><strong>Email:</strong> ${currentUser.email}</p>
                    <p><strong>Original Name:</strong> ${currentUser.originalName}</p>
                    <p><strong>Current Name:</strong> ${currentUser.name}</p>
                    <p><strong>Status:</strong> ${isRenamed ? "Renamed" : "Original"}</p>
                    
                    <div class="actions">
                        <button onclick="renameUser('${currentUser.id}', '${currentUser.name}_2')" 
                                ${renameUserAction.loadingState === "LOADING" ? "disabled" : ""}>
                            Rename to "${currentUser.name}_2"
                        </button>
                        <button onclick="revertUserName('${currentUser.id}')" 
                                ${!isRenamed || renameUserAction.loadingState === "LOADING" ? "disabled" : ""}>
                            Revert to Original Name
                        </button>
                    </div>
                </div>
            `;
}

render(<App />, document.querySelector("#app"));
