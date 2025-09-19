import fs from "fs";

// Test the regex parsing directly
const content = `export function createUser({ name, email }) {
  console.log("Creating user:", name, email);
  return { id: Date.now(), name, email };
}

export function updateUser({ id, name }) {
  console.log("Updating user:", id, name);
  return { id, name, updatedAt: new Date() };
}

export function deleteUser({ id }) {
  console.log("Deleting user:", id);
  return { deleted: true, id };
}`;

const exportFunctionRegex = /export\s+function\s+(\w+)\s*\(([^)]*)\)/g;
let match;
const functions = [];

console.log("Testing regex parsing:");
while ((match = exportFunctionRegex.exec(content)) !== null) {
  const functionName = match[1];
  const params = match[2];
  console.log(`Found function: ${functionName} with params: ${params}`);
  functions.push({ name: functionName, params });
}

console.log(`Total functions found: ${functions.length}`);
