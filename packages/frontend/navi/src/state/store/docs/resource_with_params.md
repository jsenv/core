# Resource `withParams()` Method

Creates a parameterized version of a resource with isolated autoreload behavior. Solves cross-contamination where actions with different parameters incorrectly trigger each other's autoreload.

## Problem & Solution

Without `withParams()`:

```javascript
const ROLE = resource("role", {
  GET_MANY: (params) => fetchRoles(params),
  DELETE: (params) => deleteRole(params),
});

// These actions interfere with each other
await ROLE.GET_MANY.bindParams({ admin: true });
await ROLE.DELETE.bindParams({ id: 123 }); // ❌ Reloads both admin and non-admin queries
```

With `withParams()`:

```javascript
const adminRoles = ROLE.withParams({ admin: true });
const guestRoles = ROLE.withParams({ admin: false });

await adminRoles.DELETE({ id: 123 }); // ✅ Only reloads admin queries
```

## API

### `resource.withParams(params)`

**Parameters:** `params` (Object, required) - Parameters to bind to all actions

**Returns:** New resource instance with parameter-bound actions and isolated autoreload

**Throws:** Error if params is empty

## Autoreload Hierarchy

Actions follow a parent-child hierarchy where child scopes reload their parents:

```javascript
const ROLE = resource("role", { GET_MANY: () => fetch("/roles") });
const ROLE_ADMIN = ROLE.withParams({ type: "admin" });
const ROLE_ADMIN_MALE = ROLE_ADMIN.withParams({ gender: "male" });

// Si ROLE_ADMIN_MALE.POST() est exécuté, il recharge :
// ✅ ROLE_ADMIN_MALE.GET_MANY (même scope: { type: "admin", gender: "male" })
// ✅ ROLE_ADMIN.GET_MANY (parent scope: { type: "admin" })
// ✅ ROLE.GET_MANY (root parent: {})
// ❌ Ne recharge PAS femaleAdmin.GET_MANY ({ type: "admin", gender: "female" })

// Si ROLE_ADMIN.POST() est exécuté, il recharge :
// ✅ ROLE_ADMIN.GET_MANY (même scope: { type: "admin" })
// ✅ ROLE.GET_MANY (root parent: {})
// ❌ Ne recharge PAS ROLE_ADMIN_MALE.GET_MANY (enfant, pas parent)

// Si ROLE.POST() est exécuté, il recharge :
// ✅ ROLE.GET_MANY (même scope: {})
// ❌ Ne recharge PAS ROLE_ADMIN.GET_MANY ni ROLE_ADMIN_MALE.GET_MANY (enfants, pas parents)
```

## Chaining

```javascript
const maleAdmins = USER.withParams({ role: "admin" }).withParams({
  gender: "male",
});

// Equivalent to:
const maleAdmins = USER.withParams({ role: "admin", gender: "male" });
```

## Key Features

- **Isolation**: Different parameter sets have separate autoreload behavior
- **Hierarchy**: Child scopes reload parent scopes automatically
- **Shared Store**: All parameterized resources use the same data store
- **Efficient**: Parameter comparison is cached for performance
