import { resource } from "@jsenv/navi";
import { render } from "preact";
import { useState } from "preact/hooks";

const hardcodedUsers = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Charlie", age: 22 },
];

// Simulation d'un store en mémoire pour les tests
const userStore = new Map(hardcodedUsers.map((user) => [user.name, user]));
let nextId = 4;

const USER = resource("user", {
  idKey: "id",
  mutableIdKeys: ["name"],

  GET_MANY: () => {
    console.log("🔍 GET_MANY users");
    return Array.from(userStore.values());
  },

  GET: ({ name }) => {
    console.log(`🔍 GET user: ${name}`);
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

  PATCH: ({ name, age }) => {
    console.log(`📝 PATCH user: ${name}, age: ${age}`);
    const user = userStore.get(name);
    if (!user) {
      throw new Error(`User ${name} not found`);
    }
    if (age !== undefined) {
      user.age = age;
    }
    return user;
  },
});

// Actions préparées pour les tests
const allUsersAction = USER.GET_MANY();
const aliceAction = USER.GET.bindParams({ name: "Alice" });
const bobAction = USER.GET.bindParams({ name: "Bob" });
const charlieAction = USER.GET.bindParams({ name: "Charlie" });
const testUserAction = USER.GET.bindParams({ name: "TestUser" }); // Utilisateur qui n'existe pas encore

const UserCard = ({ name, action }) => {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const loadUser = async () => {
    try {
      setStatus("loading");
      setError(null);
      const result = await action.load();
      setData(result);
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
      setData(null);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "loading":
        return "#ffc107";
      case "success":
        return "#28a745";
      case "error":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "loading":
        return "Chargement...";
      case "success":
        return "Chargé";
      case "error":
        return "Erreur";
      default:
        return "Non chargé";
    }
  };

  return (
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
        <h4 style={{ margin: 0, color: "#007bff" }}>{name}</h4>
        <span
          style={{
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "0.8em",
            fontWeight: "bold",
            backgroundColor: getStatusColor(),
            color: "white",
          }}
        >
          {getStatusText()}
        </span>
      </div>

      {data && (
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
          Âge: {data.age}
        </div>
      )}

      {error && (
        <div
          style={{
            color: "#dc3545",
            backgroundColor: "#f8d7da",
            padding: "8px",
            borderRadius: "4px",
            marginBottom: "8px",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={loadUser}
        disabled={status === "loading"}
        style={{
          padding: "6px 12px",
          backgroundColor: "#17a2b8",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: status === "loading" ? "not-allowed" : "pointer",
          opacity: status === "loading" ? 0.6 : 1,
        }}
      >
        🔄 Recharger
      </button>
    </div>
  );
};

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("idle");

  const loadAllUsers = async () => {
    try {
      setStatus("loading");
      const result = await allUsersAction.load();
      setUsers(result);
      setStatus("success");
    } catch (err) {
      console.error("Erreur lors du chargement des utilisateurs:", err);
      setStatus("error");
    }
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
      </div>

      {status === "loading" && <div>Chargement de la liste...</div>}
      {status === "error" && (
        <div style={{ color: "#dc3545" }}>Erreur lors du chargement</div>
      )}

      {users.length > 0 && (
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
  const [deleteUserName, setDeleteUserName] = useState("TestUser");
  const [renameOldName, setRenameOldName] = useState("Alice");
  const [renameNewName, setRenameNewName] = useState("Alice2");
  const [patchUserName, setPatchUserName] = useState("Bob");
  const [patchUserAge, setPatchUserAge] = useState("30");

  const createUser = async () => {
    await USER.POST({ name: newUserName, age: parseInt(newUserAge) });
  };

  const deleteUser = async () => {
    await USER.DELETE({ name: deleteUserName });
  };

  const renameUser = async () => {
    await USER.PUT({
      name: renameOldName,
      newName: renameNewName,
      age: undefined,
    });
  };

  const patchUser = async () => {
    await USER.PATCH({ name: patchUserName, age: parseInt(patchUserAge) });
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
    console.log("🎯 Scénario: Renommer");

    // 1. Renommer Bob en Bob2
    await USER.PUT({ name: "Bob", newName: "Bob2" });
    console.log("Étape 1: Bob renommé en Bob2");

    // 2. Attendre un peu
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Renommer Bob2 en Bob
    await USER.PUT({ name: "Bob2", newName: "Bob" });
    console.log("Étape 2: Bob2 renommé en Bob");
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
            buttonText="✏️ Renommer Bob ↔ Bob2"
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
        <h2>👥 Actions GET individuelles</h2>
        <p style={{ color: "#6c757d", fontSize: "0.9em" }}>
          Ces actions GET devraient se recharger automatiquement quand les
          ressources correspondantes sont modifiées.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          <UserCard name="Alice" action={aliceAction} />
          <UserCard name="Bob" action={bobAction} />
          <UserCard name="Charlie" action={charlieAction} />
          <UserCard name="TestUser (inexistant)" action={testUserAction} />
        </div>
      </div>

      {/* Actions CRUD manuelles */}
      <div
        style={{
          backgroundColor: "#f8f9fa",
          padding: "16px",
          borderRadius: "8px",
          margin: "16px 0",
        }}
      >
        <h2>🛠️ Actions CRUD manuelles</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          <ActionForm
            title="➕ Créer un utilisateur"
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

          <ActionForm
            title="🗑️ Supprimer un utilisateur"
            onSubmit={deleteUser}
            buttonText="Supprimer"
            buttonColor="#dc3545"
          >
            <input
              type="text"
              placeholder="Nom à supprimer"
              value={deleteUserName}
              onChange={(e) => setDeleteUserName(e.target.value)}
              style={inputStyle}
            />
          </ActionForm>

          <ActionForm
            title="✏️ Renommer un utilisateur"
            onSubmit={renameUser}
            buttonText="Renommer"
            buttonColor="#ffc107"
          >
            <div>
              <input
                type="text"
                placeholder="Ancien nom"
                value={renameOldName}
                onChange={(e) => setRenameOldName(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Nouveau nom"
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                style={inputStyle}
              />
            </div>
          </ActionForm>

          <ActionForm
            title="📝 Modifier l'âge"
            onSubmit={patchUser}
            buttonText="Modifier"
            buttonColor="#17a2b8"
          >
            <div>
              <input
                type="text"
                placeholder="Nom"
                value={patchUserName}
                onChange={(e) => setPatchUserName(e.target.value)}
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="Nouvel âge"
                value={patchUserAge}
                onChange={(e) => setPatchUserAge(e.target.value)}
                style={inputStyle}
              />
            </div>
          </ActionForm>
        </div>
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
            chargement, Rouge = erreur
          </li>
          <li>
            <strong>Testez l&apos;autoreload</strong> :
            <ul>
              <li>
                Créez &quot;TestUser&quot; → l&apos;action GET
                &quot;TestUser&quot; devrait passer de rouge à vert
                automatiquement
              </li>
              <li>
                Supprimez puis recréez Alice → l&apos;action GET
                &quot;Alice&quot; devrait se recharger
              </li>
              <li>
                Renommez un utilisateur → les actions liées devraient se mettre
                à jour
              </li>
            </ul>
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
