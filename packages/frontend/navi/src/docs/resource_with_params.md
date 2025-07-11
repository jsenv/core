# Resource `withParams()` Method

The `withParams()` method creates a parameterized version of a resource with isolated autoreload behavior. This solves the cross-contamination problem where actions with different parameters would incorrectly trigger each other's autoreload.

## Problem Solved

Without `withParams()`, this scenario causes unwanted behavior:

```javascript
const ROLE = resource("role", {
  GET: (params) => fetchRole(params),
  DELETE: (params) => deleteRole(params),
});

// These actions interfere with each other
await ROLE.DELETE({ canlogin: true }); // ❌ Triggers reload for ALL role actions
await ROLE.GET({ canlogin: false }); // ❌ Gets reloaded unnecessarily
```

## Solution

With `withParams()`, actions are isolated by parameter sets:

```javascript
const ROLE = resource("role", {
  GET: (params) => fetchRole(params),
  DELETE: (params) => deleteRole(params),
});

// Create isolated parameter scopes
const adminRoles = ROLE.withParams({ canlogin: true });
const guestRoles = ROLE.withParams({ canlogin: false });

// Now actions only affect their own parameter scope
await adminRoles.DELETE({ id: 123 }); // ✅ Only reloads adminRoles.GET actions
await guestRoles.GET({ id: 456 }); // ✅ Independent from admin actions
```

## API

### `resource.withParams(params)`

**Parameters:**

- `params` (Object, required): Parameters to bind to all actions of this resource

**Returns:**
A new resource instance where:

- All HTTP actions are bound with the provided parameters
- Autoreload is isolated to actions with identical parameters
- The same store is shared with the original resource

**Throws:**

- `Error` if `params` is empty or undefined

## Features

### Parameter Isolation

Actions with different parameters operate in separate autoreload scopes:

```javascript
const userResource = USER.withParams({ role: "admin" });
const guestResource = USER.withParams({ role: "guest" });

// These don't interfere with each other
await userResource.POST({ name: "Alice" }); // Only reloads admin users
await guestResource.GET({ id: 1 }); // Independent operation
```

### Parameter Merging via Chaining

You can chain `withParams()` calls to merge parameters:

```javascript
const adminUsers = USER.withParams({ role: "admin" });
const maleAdminUsers = adminUsers.withParams({ gender: "male" });

// Equivalent to:
const maleAdminUsers = USER.withParams({ role: "admin", gender: "male" });
```

### Shared Store

All parameterized resources share the same underlying data store:

```javascript
const adminUsers = USER.withParams({ role: "admin" });
const guestUsers = USER.withParams({ role: "guest" });

// Both see the same user data, just with different autoreload behavior
console.log(adminUsers.useArray()); // Same data as USER.useArray()
console.log(guestUsers.useById(123)); // Same data as USER.useById(123)
```

## Implementation Details

### Scope Identity

- Uses deep parameter comparison via `compareTwoJsValues()` to determine scope identity
- Identical parameter objects share the same autoreload scope
- Each unique parameter set gets a Symbol-based identifier for efficient comparison

### Performance

- Parameter comparison is cached - identical parameter sets reuse the same scope object
- Symbol-based scope IDs enable fast autoreload filtering
- No performance impact on the shared data store

### Memory Management

- Uses WeakSet for scope caching to allow garbage collection
- Parameterized resources don't create duplicate data, only duplicate actions

## Real-World Example

```javascript
// User management with role-based filtering
const USER = resource("user", {
  GET_MANY: ({ role, department }) =>
    fetch(`/api/users?role=${role}&department=${department}`),
  POST: (userData) =>
    fetch("/api/users", { method: "POST", body: JSON.stringify(userData) }),
  DELETE: ({ id }) => fetch(`/api/users/${id}`, { method: "DELETE" }),
});

// Create department-specific user resources
const engineeringAdmins = USER.withParams({
  department: "engineering",
}).withParams({ role: "admin" });

const salesUsers = USER.withParams({
  department: "sales",
  role: "user",
});

// Independent operations with isolated autoreload
await engineeringAdmins.POST({ name: "Alice", role: "admin" });
// ↑ Only triggers reload for engineering admin user lists

await salesUsers.DELETE({ id: 123 });
// ↑ Only triggers reload for sales user lists

// Engineering admins are unaffected by sales operations
```

## Best Practices

1. **Create parameter scopes early**: Define your parameterized resources at module level
2. **Use descriptive parameters**: Choose parameter names that clearly indicate the scope
3. **Leverage chaining**: Build complex parameter sets through method chaining
4. **Share common patterns**: Create utility functions for common parameter combinations

```javascript
// Good: Clear parameter scoping
const createDepartmentUsers = (dept) => USER.withParams({ department: dept });
const engineeringUsers = createDepartmentUsers("engineering");
const salesUsers = createDepartmentUsers("sales");

// Good: Descriptive chaining
const activeEngineeringManagers = USER.withParams({ department: "engineering" })
  .withParams({ role: "manager" })
  .withParams({ status: "active" });
```
