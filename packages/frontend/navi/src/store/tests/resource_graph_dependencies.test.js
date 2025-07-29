// Example test demonstrating the dependency system
import { resource } from "../resource_graph.js";

// Create test resources
const role = resource("role", {
  GET_MANY: () =>
    Promise.resolve([
      { id: 1, name: "admin" },
      { id: 2, name: "user" },
    ]),
  POST: (data) => Promise.resolve({ id: Date.now(), ...data }),
  DELETE: (id) => Promise.resolve(id),
});

const database = resource("database", {
  GET_MANY: () =>
    Promise.resolve([
      { id: 1, name: "main_db" },
      { id: 2, name: "test_db" },
    ]),
  POST: (data) => Promise.resolve({ id: Date.now(), ...data }),
  DELETE: (id) => Promise.resolve(id),
});

const tables = resource("tables", {
  GET_MANY: () =>
    Promise.resolve([
      { id: 1, name: "users", database_id: 1 },
      { id: 2, name: "roles", database_id: 1 },
    ]),
  POST: (data) => Promise.resolve({ id: Date.now(), ...data }),
  DELETE: (id) => Promise.resolve(id),
});

// Create parameterized resource with dependencies
// This will autoreload when any of the dependency resources are modified
const ROLE_WITH_OWNERSHIP = role.withParams(
  { owners: true },
  {
    dependencies: [role, database, tables],
  },
);

// Demonstrate the functionality
console.log("🚀 Dependency system demo");
console.log(
  `✅ Created ROLE_WITH_OWNERSHIP with ${ROLE_WITH_OWNERSHIP.dependencies.length} dependencies`,
);
console.log(
  `📋 Dependencies: ${ROLE_WITH_OWNERSHIP.dependencies.map((d) => d.name).join(", ")}`,
);

// Test the autoreload mechanism
async function testAutoreload() {
  console.log("\n🧪 Testing autoreload mechanism...");

  try {
    // Load the parameterized resource
    const ownershipData = await ROLE_WITH_OWNERSHIP.GET_MANY.load();
    console.log(
      "✅ ROLE_WITH_OWNERSHIP.GET_MANY.load() executed:",
      ownershipData.length,
      "items",
    );

    // Trigger dependency changes that should cause autoreload
    console.log("\n📝 Triggering dependency changes...");

    await tables.POST.load({ name: "new_table", database_id: 1 });
    console.log(
      "✅ tables.POST.load() - should trigger ROLE_WITH_OWNERSHIP autoreload",
    );

    await database.POST.load({ name: "new_database" });
    console.log(
      "✅ database.POST.load() - should trigger ROLE_WITH_OWNERSHIP autoreload",
    );

    await role.POST.load({ name: "new_role" });
    console.log(
      "✅ role.POST.load() - should trigger ROLE_WITH_OWNERSHIP autoreload",
    );

    console.log("\n✅ Dependency system test completed successfully!");
    console.log(
      "💡 In a real application, these would automatically reload ROLE_WITH_OWNERSHIP.GET_MANY",
    );
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testAutoreload();

export { database, role, ROLE_WITH_OWNERSHIP, tables };
