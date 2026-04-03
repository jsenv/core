import { ActionRenderer, resource, useActionStatus } from "@jsenv/navi";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

const hardcodedUsers = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Charlie", age: 22 },
];

// Simulation d'un store en mémoire pour les tests
const userStore = new Map(hardcodedUsers.map((user) => [user.name, user]));
let nextId = 4;

// Compteurs de chargement par utilisateur
const loadCounters = new Map();

const USER = resource("user", {
  idKey: "id",
  uniqueKeys: ["name"],

  GET_MANY: () => {
    console.log("🔍 GET_MANY users");
    return Array.from(userStore.values());
  },

  GET: async ({ name }) => {
    console.log(`🔍 GET user: ${name}`);
    // Incrémenter le compteur pour cet utilisateur
    const currentCount = loadCounters.get(name) || 0;
    loadCounters.set(name, currentCount + 1);
    console.log(`📊 Load count for ${name}: ${currentCount + 1}`);

    await new Promise((resolve) => setTimeout(resolve, 800)); // Simuler un délai de chargement

    const user = userStore.get(name);
    if (!user) {
      throw new Error(`User ${name} not found`);
    }
    return user;
  },

  POST: ({ name, age }) => {
    console.log(`➕ POST user: ${name}, age: ${age}`);
    if (userStore.has(name)) {
      throw new Error(`User ${name} already exists`);
    }
    const newUser = { id: String(nextId++), name, age };
    userStore.set(name, newUser);
    return newUser;
  },

  DELETE: ({ name }) => {
    console.log(`🗑️ DELETE user: ${name}`);
    const user = userStore.get(name);
    if (!user) {
      throw new Error(`User ${name} not found`);
    }
    userStore.delete(name);
    return user;
  },

  DELETE_MANY: ({ names }) => {
    for (const name of names) {
      const user = userStore.get(name);
      if (!user) {
        throw new Error(`User ${name} not found`);
      }
      userStore.delete(name);
    }
    return names.map((name) => ({ name }));
  },

  PUT: ({ name, newName, age }) => {
    console.log(`✏️ PUT user: ${name} -> ${newName || name}, age: ${age}`);
    const user = userStore.get(name);
    if (!user) {
      throw new Error(`User ${name} not found`);
    }

    // Si le nom change, supprimer l'ancienne entrée
    if (newName && newName !== name) {
      userStore.delete(name);
      user.name = newName;
      userStore.set(newName, user);
    }

    if (age !== undefined) {
      user.age = age;
    }

    return user;
  },

  PATCH: ({ name, newName, age }) => {
    console.log(
      `📝 PATCH user: ${name}${newName ? ` -> ${newName}` : ""}, age: ${age}`,
    );
    const user = userStore.get(name);
    if (!user) {
      throw new Error(`User ${name} not found`);
    }

    // Si le nom change, supprimer l'ancienne entrée
    if (newName && newName !== name) {
      userStore.delete(name);
      user.name = newName;
      userStore.set(newName, user);
    }

    if (age !== undefined) {
      user.age = age;
    }
    return user;
  },
});

// Fonction utilitaire pour obtenir le compteur d'un utilisateur
const getLoadCount = (name) => loadCounters.get(name) || 0;

// Actions préparées pour les tests
const allUsersAction = USER.GET_MANY;
const aliceAction = USER.GET.bindParams({ name: "Alice" });
const bobAction = USER.GET.bindParams({ name: "Bob" });
const charlieAction = USER.GET.bindParams({ name: "Charlie" });
const testUserAction = USER.GET.bindParams({ name: "TestUser" }); // Utilisateur qui n'existe pas encore

const App = () => {
  const [newUserName, setNewUserName] = useState("TestUser");
  const [newUserAge, setNewUserAge] = useState("28");

  const createUser = async () => {
    await USER.POST({ name: newUserName, age: parseInt(newUserAge) });
  };

  const runDeleteRecreateScenario = async () => {
    console.log("🎯 Scénario: Supprimer puis recréer");

    // 1. Supprimer Alice
    await USER.DELETE({ name: "Alice" });
    console.log("Étape 1: Alice supprimée");

    // 2. Attendre un peu
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Recréer Alice
    await USER.POST({ name: "Alice", age: 31 });
    console.log("Étape 2: Alice recréée");
  };

  const runRenameScenario = async () => {
    console.log("🎯 Scénario: Renommer avec PUT");

    // 1. Renommer Bob en TestUser
    await USER.PUT({ name: "Bob", newName: "TestUser" });
    console.log("Étape 1: Bob renommé en TestUser");
  };

  const runPatchRenameScenario = async () => {
    console.log("🎯 Scénario: Renommer avec PATCH");

    // 1. Renommer Bob en TestUser avec PATCH
    await USER.PATCH({ name: "Bob", newName: "TestUser", age: 40 });
    console.log("Étape 1: Bob renommé en TestUser avec PATCH");
  };

  const deleteAliceAndBob = () => {
    USER.DELETE_MANY({ names: ["Alice", "Bob"] });
  };

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1
        style={{
          color: "#333",
          borderBottom: "3px solid #007bff",
          paddingBottom: "10px",
        }}
      >
        🧪 Test MutableId Autoreload System
      </h1>

      <details
        style={{
          backgroundColor: "#e7f3ff",
          padding: "10px 15px",
          borderRadius: "8px",
          border: "1px solid #b3d9ff",
          marginBottom: "16px",
        }}
      >
        <summary
          style={{ cursor: "pointer", fontWeight: "bold", color: "#0056b3" }}
        >
          À propos &amp; instructions
        </summary>
        <p style={{ margin: "10px 0 0" }}>
          Cette interface teste le système d&apos;autoreload pour les ressources
          avec mutableId. Observez comment les actions GET se rechargent
          automatiquement après les modifications.
          <br />
          <strong>Astuce:</strong> Ouvrez la console pour voir les logs
          détaillés.
        </p>
        <ol style={{ marginBottom: 0 }}>
          <li>
            <strong>Chargez d&apos;abord les utilisateurs</strong> avec les
            boutons &quot;Recharger&quot;
          </li>
          <li>
            <strong>Observez les statuts</strong> : Vert = chargé, Jaune =
            chargement, Rouge avec 404 = utilisateur inexistant
          </li>
          <li>
            <strong>Testez l&apos;autoreload</strong> :
            <ul>
              <li>
                Créez &quot;TestUser&quot; → l&apos;action GET
                &quot;TestUser&quot; devrait passer de 404 à vert
                automatiquement
              </li>
              <li>
                Supprimez puis recréez Alice → l&apos;action GET
                &quot;Alice&quot; devrait se recharger
              </li>
              <li>
                Modifiez un utilisateur depuis sa carte → l&apos;affichage
                devrait se mettre à jour automatiquement
              </li>
            </ul>
          </li>
          <li>
            <strong>Vérifiez les logs</strong> dans la console pour voir les
            détails des autoreloads
          </li>
        </ol>
      </details>

      {/* Scénarios automatiques */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "10px 14px",
          borderRadius: "8px",
          margin: "12px 0",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: "0.85em", color: "#495057" }}>
          🎯 Scénarios :
        </strong>
        <button
          onClick={runDeleteRecreateScenario}
          style={{
            padding: "4px 10px",
            backgroundColor: "#6f42c1",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.85em",
          }}
        >
          🔄 Supprimer Alice puis la recréer
        </button>
        <button
          onClick={runRenameScenario}
          style={{
            padding: "4px 10px",
            backgroundColor: "#6f42c1",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.85em",
          }}
        >
          ✏️ Renommer Bob → TestUser (PUT)
        </button>
        <button
          onClick={runPatchRenameScenario}
          style={{
            padding: "4px 10px",
            backgroundColor: "#6f42c1",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.85em",
          }}
        >
          📝 Renommer Bob → TestUser (PATCH)
        </button>
        <button
          onClick={deleteAliceAndBob}
          style={{
            padding: "4px 10px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.85em",
          }}
        >
          🗑️ Supprimer Alice &amp; Bob
        </button>
      </div>

      {/* Listes utilisateurs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          margin: "12px 0",
        }}
      >
        <UsersListStatic />
        <UsersListReactive />
      </div>

      {/* Actions GET individuelles */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "10px 14px",
          borderRadius: "8px",
          margin: "12px 0",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: "0.95em" }}>
          👥 Actions GET individuelles avec CRUD
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "8px",
          }}
        >
          <UserCard name="Alice" action={aliceAction} />
          <UserCard name="TestUser" action={testUserAction} />
          <UserCard name="Bob" action={bobAction} />
          <UserCard name="Charlie" action={charlieAction} />
        </div>
      </div>

      {/* Création d'utilisateurs */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "10px 14px",
          borderRadius: "8px",
          margin: "12px 0",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: "0.85em", color: "#495057" }}>
          ➕ Créer :
        </strong>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "0.85em",
          }}
        >
          Nom
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            style={{
              padding: "3px 7px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              width: "110px",
              fontSize: "0.9em",
            }}
          />
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "0.85em",
          }}
        >
          Âge
          <input
            type="number"
            value={newUserAge}
            onChange={(e) => setNewUserAge(e.target.value)}
            style={{
              padding: "3px 7px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              width: "60px",
              fontSize: "0.9em",
            }}
          />
        </label>
        <button
          onClick={createUser}
          style={{
            padding: "3px 12px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.85em",
          }}
        >
          Créer
        </button>
      </div>
    </div>
  );
};

const UsersListStatic = () => {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("idle");

  const loadAllUsers = async () => {
    try {
      setStatus("loading");
      const result = await allUsersAction();
      setUsers(result || []);
      setStatus("success");
    } catch (err) {
      console.error("Erreur lors du chargement des utilisateurs:", err);
      setUsers([]);
      setStatus("error");
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, []);

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: "8px",
        padding: "10px 14px",
        backgroundColor: "#f8f9fa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.9em" }}>
          📋 Liste statique{" "}
          <span
            style={{
              fontWeight: "normal",
              color: "#dc3545",
              fontSize: "0.85em",
            }}
          >
            (useState — non réactive, devient désynchronisée)
          </span>
        </h3>
        <button
          onClick={loadAllUsers}
          disabled={status === "loading"}
          style={{
            padding: "3px 10px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "0.8em",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.6 : 1,
          }}
        >
          🔄
        </button>
      </div>
      {status === "loading" && (
        <div style={{ fontSize: "0.85em", color: "#6c757d" }}>Chargement…</div>
      )}
      {status === "error" && (
        <div style={{ color: "#dc3545", fontSize: "0.85em" }}>
          Erreur lors du chargement
        </div>
      )}
      {users.length > 0 && (
        <div style={{ fontFamily: "monospace", fontSize: "0.8em" }}>
          {users.map((user) => (
            <div key={user.id}>
              #{user.id} · {user.name} · {user.age} ans
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
const UsersListReactive = () => {
  // Here we can use USER.useArray but we would display ANY user in the store
  // while we want to display exactly what allUsersAction has fetched.
  // Because other parts of the code might load users
  // unrelated to what server returned
  // - imagine a GET with filter returning filtered users)
  // - and an other part of the app loading your user for instance
  // which would not match the filters
  const users = allUsersAction.dataSignal.value;

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: "8px",
        padding: "10px 14px",
        backgroundColor: "#f8f9fa",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: "0.9em" }}>
        📋 Liste réactive{" "}
        <span
          style={{ fontWeight: "normal", color: "#28a745", fontSize: "0.85em" }}
        >
          (useArray — se met à jour automatiquement via signaux)
        </span>
      </h3>
      {users.length === 0 ? (
        <div style={{ fontSize: "0.85em", color: "#6c757d" }}>
          Aucun utilisateur dans le store
        </div>
      ) : (
        <div style={{ fontFamily: "monospace", fontSize: "0.8em" }}>
          {users.map((user) => (
            <div key={user.id}>
              #{user.id} · {user.name} · {user.age} ans
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
const UserCard = ({ name, action }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [loadCount, setLoadCount] = useState(0);

  // Get common data from action status
  const { data } = useActionStatus(action);
  const displayName = data ? `${data.name} (${data.age} ans)` : name;

  // Charger automatiquement au démarrage pour Alice, Bob et Charlie
  useEffect(() => {
    if (
      name === "Alice" ||
      name === "Bob" ||
      name === "Charlie" ||
      name === "TestUser"
    ) {
      console.log(`🚀 Auto-run ${name} on mount`);
      action.run();
    }
  }, [name, action]);

  // Mettre à jour le compteur périodiquement pour refléter les changements
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadCount(getLoadCount(name));
    }, 100);
    return () => clearInterval(interval);
  }, [name]);

  const deleteUser = async (data) => {
    if (!data) return;
    try {
      await USER.DELETE({ name: data.name });
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
    }
  };

  const renameUser = async (data) => {
    if (!data || !editName.trim()) return;
    try {
      await USER.PUT({ name: data.name, newName: editName.trim() });
      setIsEditing(false);
    } catch (err) {
      console.error("Erreur lors du renommage:", err);
    }
  };

  const updateAge = async (data) => {
    if (!data || !editAge.trim()) return;
    try {
      await USER.PATCH({ name: data.name, age: parseInt(editAge) });
      setIsEditing(false);
    } catch (err) {
      console.error("Erreur lors de la mise à jour de l'âge:", err);
    }
  };

  const updateNameAndAge = async (data) => {
    if (!data || !editName.trim() || !editAge.trim()) return;
    try {
      await USER.PUT({
        name: data.name,
        newName: editName.trim(),
        age: parseInt(editAge),
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Erreur lors de la mise à jour complète:", err);
    }
  };

  // Common UI wrapper component
  const CardWrapper = ({ children, statusColor, statusText }) => (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        padding: "6px 10px",
        margin: "4px 0",
        backgroundColor: "#f8f9fa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span
          style={{ fontWeight: "bold", color: "#007bff", fontSize: "0.9em" }}
        >
          {displayName}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              padding: "1px 5px",
              borderRadius: "3px",
              fontSize: "0.65em",
              fontWeight: "bold",
              backgroundColor: "#6c757d",
              color: "white",
            }}
          >
            {loadCount}x
          </span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "3px",
              fontSize: "0.7em",
              fontWeight: "bold",
              backgroundColor: statusColor,
              color: "white",
            }}
          >
            {statusText}
          </span>
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <ActionRenderer action={action}>
      {{
        loading: () => (
          <CardWrapper statusColor="#ffc107" statusText="Chargement...">
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <button
                onClick={() => action.rerun()}
                disabled={true}
                style={{
                  padding: "2px 7px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "not-allowed",
                  opacity: 0.6,
                  fontSize: "0.8em",
                }}
              >
                🔄
              </button>
            </div>
          </CardWrapper>
        ),
        error: (error) => (
          <CardWrapper
            statusColor="#dc3545"
            statusText={
              error.message && error.message.includes("not found")
                ? "404 - Non trouvé"
                : "Erreur"
            }
          >
            <div
              style={{
                color: "#dc3545",
                backgroundColor: "#f8d7da",
                padding: "8px",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            >
              {error.message || error}
            </div>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <button
                onClick={() => action.rerun()}
                style={{
                  padding: "2px 7px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.8em",
                }}
              >
                🔄
              </button>
            </div>
          </CardWrapper>
        ),
        completed: (data) => {
          if (!data) {
            return null;
          }

          // Initialiser les champs d'édition quand les données arrivent
          if (data && !isEditing && (!editName || !editAge)) {
            setEditName(data.name);
            setEditAge(data.age.toString());
          }

          return (
            <CardWrapper statusColor="#28a745" statusText="Chargé">
              {!isEditing && (
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.8em",
                    color: "#495057",
                    marginBottom: "6px",
                  }}
                >
                  #{data.id} · {data.name} · {data.age} ans
                </div>
              )}

              {isEditing && (
                <div
                  style={{
                    backgroundColor: "white",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    marginBottom: "6px",
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Nom"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{
                      width: "90px",
                      padding: "3px 6px",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.85em",
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Âge"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    style={{
                      width: "60px",
                      padding: "3px 6px",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      fontSize: "0.85em",
                    }}
                  />
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <button
                      onClick={() => renameUser(data)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#ffc107",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8em",
                      }}
                    >
                      Renommer
                    </button>
                    <button
                      onClick={() => updateAge(data)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#17a2b8",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8em",
                      }}
                    >
                      Changer âge
                    </button>
                    <button
                      onClick={() => updateNameAndAge(data)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#6f42c1",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8em",
                      }}
                    >
                      Tout modifier
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8em",
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  flexWrap: "wrap",
                  marginTop: "4px",
                }}
              >
                <button
                  onClick={() => action.rerun()}
                  style={{
                    padding: "2px 7px",
                    backgroundColor: "#17a2b8",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.8em",
                  }}
                >
                  🔄
                </button>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  style={{
                    padding: "2px 7px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.8em",
                  }}
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteUser(data)}
                  style={{
                    padding: "2px 7px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.8em",
                  }}
                >
                  🗑️
                </button>
              </div>
            </CardWrapper>
          );
        },
        idle: () => (
          <CardWrapper statusColor="#6c757d" statusText="Non chargé">
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                onClick={() => action.rerun()}
                style={{
                  padding: "2px 7px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.8em",
                }}
              >
                🔄
              </button>
            </div>
          </CardWrapper>
        ),
      }}
    </ActionRenderer>
  );
};

render(<App />, document.querySelector("#root"));
