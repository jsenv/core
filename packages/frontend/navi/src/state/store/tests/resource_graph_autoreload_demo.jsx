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
  mutableIdKeys: ["name"],

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
        borderRadius: "8px",
        padding: "16px",
        margin: "8px 0",
        backgroundColor: "#f8f9fa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h4 style={{ margin: 0, color: "#007bff" }}>{displayName}</h4>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.7em",
              fontWeight: "bold",
              backgroundColor: "#6c757d",
              color: "white",
            }}
          >
            📊 {loadCount}x
          </span>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "0.8em",
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
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => action.rerun()}
                disabled={true}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "not-allowed",
                  opacity: 0.6,
                }}
              >
                🔄 Recharger
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
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => action.rerun()}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                🔄 Recharger
              </button>
            </div>
          </CardWrapper>
        ),

        completed: (data) => {
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
                    backgroundColor: "white",
                    padding: "8px",
                    borderRadius: "4px",
                    marginBottom: "8px",
                  }}
                >
                  ID: {data.id}
                  <br />
                  Nom: {data.name}
                  <br />
                  Âge: {data.age} ans
                </div>
              )}

              {isEditing && (
                <div
                  style={{
                    backgroundColor: "white",
                    padding: "12px",
                    borderRadius: "4px",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ marginBottom: "8px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        fontWeight: "bold",
                      }}
                    >
                      Nom:
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        border: "1px solid #ced4da",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        fontWeight: "bold",
                      }}
                    >
                      Âge:
                    </label>
                    <input
                      type="number"
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        border: "1px solid #ced4da",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
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

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  onClick={() => action.rerun()}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#17a2b8",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  🔄 Recharger
                </button>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => deleteUser(data)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  🗑️ Supprimer
                </button>
              </div>
            </CardWrapper>
          );
        },

        idle: () => (
          <CardWrapper statusColor="#6c757d" statusText="Non chargé">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => action.rerun()}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#17a2b8",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                � Charger
              </button>
            </div>
          </CardWrapper>
        ),
      }}
    </ActionRenderer>
  );
};

const UsersList = () => {
  const [users, setUsers] = useState([]); // Initialiser avec un tableau vide au lieu de []
  const [status, setStatus] = useState("idle");

  const loadAllUsers = async () => {
    try {
      setStatus("loading");
      // Utiliser la nouvelle syntaxe fonction directement
      const result = await allUsersAction();
      setUsers(result || []); // S'assurer qu'on a toujours un tableau
      setStatus("success");
    } catch (err) {
      console.error("Erreur lors du chargement des utilisateurs:", err);
      setUsers([]); // Réinitialiser avec un tableau vide en cas d'erreur
      setStatus("error");
    }
  };

  const deleteAliceAndBob = () => {
    USER.DELETE_MANY({ names: ["Alice", "Bob"] });
  };

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: "8px",
        padding: "16px",
        margin: "16px 0",
        backgroundColor: "#f8f9fa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h3 style={{ margin: 0 }}>📋 Liste de tous les utilisateurs</h3>
        <button
          onClick={loadAllUsers}
          disabled={status === "loading"}
          style={{
            padding: "6px 12px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.6 : 1,
          }}
        >
          🔄 Recharger la liste
        </button>
        <button
          onClick={deleteAliceAndBob}
          disabled={status === "loading"}
          style={{
            padding: "6px 12px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.6 : 1,
          }}
        >
          Supprimer Alice et Bob
        </button>
      </div>

      {status === "loading" && <div>Chargement de la liste...</div>}
      {status === "error" && (
        <div style={{ color: "#dc3545" }}>Erreur lors du chargement</div>
      )}

      {users && users.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            padding: "12px",
            borderRadius: "4px",
            fontFamily: "monospace",
          }}
        >
          {users.map((user) => (
            <div key={user.id} style={{ marginBottom: "4px" }}>
              {user.name} (ID: {user.id}, Âge: {user.age})
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActionForm = ({
  title,
  children,
  onSubmit,
  buttonText,
  buttonColor = "#28a745",
}) => {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await onSubmit();
      setStatus("success");
      setMessage("✅ Action réussie !");
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 3000);
    } catch (error) {
      setStatus("error");
      setMessage(`❌ Erreur: ${error.message}`);
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 5000);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #dee2e6",
        borderRadius: "8px",
        padding: "16px",
        margin: "8px 0",
        backgroundColor: "white",
      }}
    >
      <h4 style={{ marginTop: 0, color: "#495057" }}>{title}</h4>
      {children}

      {message && (
        <div
          style={{
            margin: "8px 0",
            padding: "8px",
            borderRadius: "4px",
            backgroundColor: status === "success" ? "#d4edda" : "#f8d7da",
            color: status === "success" ? "#155724" : "#721c24",
          }}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        style={{
          padding: "8px 16px",
          backgroundColor: buttonColor,
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: status === "loading" ? "not-allowed" : "pointer",
          opacity: status === "loading" ? 0.6 : 1,
          marginTop: "8px",
        }}
      >
        {status === "loading" ? "⏳ En cours..." : buttonText}
      </button>
    </form>
  );
};

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

  const inputStyle = {
    padding: "6px 10px",
    border: "1px solid #ced4da",
    borderRadius: "4px",
    marginRight: "8px",
    marginBottom: "8px",
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

      <p
        style={{
          backgroundColor: "#e7f3ff",
          padding: "15px",
          borderRadius: "8px",
          border: "1px solid #b3d9ff",
        }}
      >
        Cette interface teste le système d&apos;autoreload pour les ressources
        avec mutableId. Observez comment les actions GET se rechargent
        automatiquement après les modifications.
        <br />
        <strong>Astuce:</strong> Ouvrez la console pour voir les logs détaillés.
      </p>

      {/* Scénarios automatiques */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "16px",
          borderRadius: "8px",
          margin: "16px 0",
        }}
      >
        <h2>🎯 Scénarios de test automatiques</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <ActionForm
            title=""
            onSubmit={runDeleteRecreateScenario}
            buttonText="🔄 Supprimer puis recréer Alice"
            buttonColor="#6f42c1"
          >
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: "0.9em",
                color: "#6c757d",
              }}
            >
              Teste l&apos;autoreload POST avec mutableId
            </p>
          </ActionForm>

          <ActionForm
            title=""
            onSubmit={runRenameScenario}
            buttonText="✏️ PUT: Bob ↔ TestUser"
            buttonColor="#6f42c1"
          >
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: "0.9em",
                color: "#6c757d",
              }}
            >
              Teste l&apos;autoreload PUT avec changement de mutableId
            </p>
          </ActionForm>

          <ActionForm
            title=""
            onSubmit={runPatchRenameScenario}
            buttonText="📝 PATCH: Bob ↔ TestUser"
            buttonColor="#6f42c1"
          >
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: "0.9em",
                color: "#6c757d",
              }}
            >
              Teste l&apos;autoreload PATCH avec changement de mutableId
            </p>
          </ActionForm>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <UsersList />

      {/* Actions GET individuelles */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "16px",
          borderRadius: "8px",
          margin: "16px 0",
        }}
      >
        <h2>👥 Actions GET individuelles avec CRUD</h2>
        <p style={{ color: "#6c757d", fontSize: "0.9em" }}>
          Ces actions GET devraient se recharger automatiquement quand les
          ressources correspondantes sont modifiées. Chaque carte permet aussi
          de modifier ou supprimer l&apos;utilisateur.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
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
          padding: "16px",
          borderRadius: "8px",
          margin: "16px 0",
        }}
      >
        <h2>➕ Créer un nouvel utilisateur</h2>

        <ActionForm
          title="Créer un utilisateur"
          onSubmit={createUser}
          buttonText="Créer"
          buttonColor="#28a745"
        >
          <div>
            <input
              type="text"
              placeholder="Nom"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="Âge"
              value={newUserAge}
              onChange={(e) => setNewUserAge(e.target.value)}
              style={inputStyle}
            />
          </div>
        </ActionForm>
      </div>

      <div
        style={{
          backgroundColor: "#fff3cd",
          border: "1px solid #ffeaa7",
          borderRadius: "8px",
          padding: "16px",
          margin: "16px 0",
        }}
      >
        <h3 style={{ marginTop: 0 }}>💡 Instructions de test</h3>
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
                Modifiez un utilisateur directement depuis sa carte →
                l&apos;affichage devrait se mettre à jour automatiquement
              </li>
            </ul>
          </li>
          <li>
            <strong>Actions dans les cartes</strong> : Chaque utilisateur a des
            boutons Modifier et Supprimer. Le mode édition permet de changer le
            nom, l&apos;âge, ou les deux.
          </li>
          <li>
            <strong>Vérifiez les logs</strong> dans la console pour voir les
            détails des autoreloads
          </li>
        </ol>
      </div>
    </div>
  );
};

render(<App />, document.querySelector("#root"));
