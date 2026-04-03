# Resource Dependencies Documentation

The `withParams` method now supports cross-resource dependencies, allowing you to set up autoreload relationships between different resources.

## Basic Usage

```js
const role = resource("role", {
  GET_MANY: () => fetchRoles(),
  POST: (data) => createRole(data),
  DELETE: (id) => deleteRole(id),
});

const database = resource("database", {
  GET_MANY: () => fetchDatabases(),
  POST: (data) => createDatabase(data),
  DELETE: (id) => deleteDatabase(id),
});

const tables = resource("tables", {
  GET_MANY: () => fetchTables(),
  POST: (data) => createTable(data),
  DELETE: (id) => deleteTable(id),
});

// Create a parameterized resource with cross-resource dependencies
const ROLE_WITH_OWNERSHIP = role.withParams(
  { owners: true },
  {
    dependencies: [role, database, tables],
  },
);
```

## How It Works

When you specify `dependencies`, any non-GET action (POST, PUT, PATCH, DELETE) on the dependency resources will trigger an autoreload of the GET_MANY actions in the parameterized resource.

### Autoreload Behavior

- **Triggering Actions**: Any POST, PUT, PATCH, or DELETE on dependency resources
- **Target Actions**: GET_MANY actions in the parameterized resource (same param scope only)
- **Scope Isolation**: Only actions with the same parameter scope are affected

### Example Scenarios

1. **Creating a table**: `tables.POST.load(newTableData)` → triggers `ROLE_WITH_OWNERSHIP.GET_MANY` reload
2. **Deleting a database**: `database.DELETE.load(dbId)` → triggers `ROLE_WITH_OWNERSHIP.GET_MANY` reload
3. **Updating a role**: `role.PUT.load(roleData)` → triggers `ROLE_WITH_OWNERSHIP.GET_MANY` reload

## Advanced Usage

### Parameterized Dependencies

You can also use parameterized resources as dependencies:

```js
const recentTables = tables.withParams({ recent: true });
const adminTables = tables.withParams({ owner: "admin" });

const ROLE_WITH_RECENT_OWNERSHIP = role.withParams(
  { owners: true },
  {
    dependencies: [recentTables], // Only affected by recent tables
  },
);

const ROLE_WITH_ADMIN_OWNERSHIP = role.withParams(
  { owners: true },
  {
    dependencies: [adminTables], // Only affected by admin tables
  },
);
```

### Custom Autoreload Settings

You can also customize the autoreload behavior:

```js
const ROLE_WITH_OWNERSHIP = role.withParams(
  { owners: true },
  {
    dependencies: [role, database, tables],
    autoreloadGetManyAfter: ["POST", "DELETE", "PUT"], // Custom trigger verbs
    autoreloadGetAfter: false, // Disable GET autoreload
  },
);
```

## Implementation Details

- **Global Registry**: Dependencies are tracked in a global registry to enable cross-resource communication
- **Memory Management**: The system uses WeakSets to avoid memory leaks
- **Async Execution**: Autoreloads are triggered asynchronously with `setTimeout` to ensure proper sequencing
- **Parameter Isolation**: Each parameter scope maintains its own autoreload behavior

## Benefits

1. **Reactive Updates**: Automatically keep related data in sync across different resources
2. **Parameter Isolation**: Avoid unwanted cross-contamination between different parameter sets
3. **Flexible Dependencies**: Mix and match regular and parameterized resources as dependencies
4. **Performance**: Only reload what's actually needed based on the dependency graph
