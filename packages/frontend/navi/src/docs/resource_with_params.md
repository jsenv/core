# Resource `withParams()` Method

The `withParams()` method creates a parameterized version of a resource with isolated autoreload behavior. This solves the cross-contamination problem where actions with different parameters would incorrectly trigger each other's autoreload.

## Problem Solved

Without `withParams()`, this scenario causes unwanted behavior:

```javascript
const ROLE = resource("role", {
  GET_MANY: (params) => fetchRoles(params),
  GET: (params) => fetchRole(params),
  DELETE: (params) => deleteRole(params),
});

const ADMIN = ROLE.GET_MANY.bindParams({ admin: true });
const NON_ADMIN = ROLE.GET_MANY.bindParams({ admin: false });

await ROLE.DELETE.bindParams({ id: "123" }); // ❌ Triggers reload for both ADMIN and NON_ADMIN
```

## Solution

With `withParams()`, actions are isolated by parameter sets:

```javascript
const ROLE = resource("role", {
  GET_MANY: (params) => fetchRoles(params),
  GET: (params) => fetchRole(params),
  DELETE: (params) => deleteRole(params),
});

// Create isolated parameter scopes
const ROLE_ADMIN = ROLE.withParams({ canlogin: true });
const ROLE_GUEST = ROLE.withParams({ canlogin: false });

// Now actions only affect their own parameter scope
await ROLE_ADMIN.DELETE({ id: 123 }); // ✅ Only reloads adminRoles.GET actions
await ROLE_GUEST.GET({ id: 456 }); // ✅ Independent from admin actions
```

## API

### `resource.withParams(params)`

**Parameters:**

- `params` (Object, required): Parameters to bind to all actions of this resource

**Returns:**
A new resource instance where:

- All HTTP actions are bound with the provided parameters
- Autoreload follows a hierarchical pattern: child scopes reload their parent scopes
- The same store is shared with the original resource

**Throws:**

- `Error` if `params` is empty or undefined

## Features

### Hierarchical Autoreload

The autoreload system follows a parent-child hierarchy where parameterized actions reload their parent scopes:

```javascript
const ADMIN = resource("admin", { GET_MANY: () => fetch("/api/admin") });
const ROLE = resource("role", { GET_MANY: () => fetch("/api/roles") });

// Create hierarchical scopes
const adminWithDept = ADMIN.withParams({ department: "engineering" });
const roleWithLogin = ROLE.withParams({ canlogin: true });

// When you modify a child scope, parent scopes are also reloaded
await adminWithDept.POST({ name: "Alice" });
// ✅ Reloads: adminWithDept.GET_MANY + ADMIN.GET_MANY (parent)

await roleWithLogin.DELETE({ id: 123 });
// ✅ Reloads: roleWithLogin.GET_MANY + ROLE.GET_MANY (parent)
```

**Hierarchy Rules:**

- Child scopes (with parameters) reload their parent scopes (with fewer/no parameters)
- Sibling scopes (different parameter sets) remain isolated from each other
- Root scope (no parameters) is reloaded by all parameterized children

### Parameter Isolation Between Siblings

Actions with different parameters operate in separate autoreload scopes:

```javascript
const adminUsers = USER.withParams({ role: "admin" });
const guestUsers = USER.withParams({ role: "guest" });

// Sibling scopes don't interfere with each other
await adminUsers.POST({ name: "Alice" });
// ✅ Reloads: adminUsers.GET_MANY + USER.GET_MANY (parent)
// ✅ Does NOT reload: guestUsers.GET_MANY (sibling)

await guestUsers.DELETE({ id: 1 });
// ✅ Reloads: guestUsers.GET_MANY + USER.GET_MANY (parent)
// ✅ Does NOT reload: adminUsers.GET_MANY (sibling)
```

### Multi-Level Parameter Hierarchy

Complex parameter hierarchies are supported with automatic parent reloading:

```javascript
const allUsers = USER; // Root scope (no parameters)
const adminUsers = USER.withParams({ role: "admin" });
const engineeringAdmins = adminUsers.withParams({ department: "engineering" });

// Hierarchy: engineeringAdmins → adminUsers → allUsers

await engineeringAdmins.POST({ name: "Alice" });
// ✅ Reloads in order:
// 1. engineeringAdmins.GET_MANY (same scope)
// 2. adminUsers.GET_MANY (parent - subset of params)
// 3. allUsers.GET_MANY (root parent - no params)

// Other scopes remain unaffected
const salesAdmins = adminUsers.withParams({ department: "sales" });
// ✅ salesAdmins.GET_MANY is NOT reloaded (sibling scope)
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

### Hierarchical Scope Resolution

- Parent-child relationships are determined by parameter subset comparison
- A scope is considered a parent if its parameters are a subset of the child's parameters
- Uses `isParamSubset()` to detect hierarchical relationships efficiently
- Symbol-based scope IDs enable fast parent scope lookup during autoreload

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
