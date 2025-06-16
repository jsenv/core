/* eslint-disable import-x/first */
const role = resource("role");
const table = resource("table");

role.getAll(() => {
  // fetch /roles
});
role.get(() => {
  // fetch /roles/:rolname
});
role.put(() => {
  // put /roles/:rolname/property
});

const tableOwner = table.one(role, "owner");
const roleTables = role.many(table, "tables");
const getRoleTables = roleTables.get(async () => {
  // fetch /:rolename/tables
});

// "members" is the equivalent of "groups" but from the perspective the role grouping other roles
const roleMembers = role.many(role, "members");
const getMembers = roleMembers.get(async ({ roleId }) => {
  // fetch /:roleId/members
});
const addMember = roleMembers.put(async ({ roleId, memberId }) => {
  // put /:roleId/members/:memberId
});
const removeMember = roleMembers.delete(async ({ roleId, memberId }) => {
  // delete /:roleId/members/:memberId
});
// "groups" is the equivalent of "members" but from the perspective of a role
const roleGroups = role.many(role, "groups");
const getGroups = roleMembers.get(async ({ roleId }) => {
  // fetch /:roleId/groups
});
const joinGroup = roleGroups.put(async ({ roleId, groupId }) => {
  // put /:roleId/groups/:groupId
});
const leaveGroup = roleGroups.delete(async ({ roleId, groupId }) => {
  // delete /:roleId/groups/:groupId
});

// now the implementation:
