import { resource } from "@jsenv/navi";
import { render } from "preact";

const hardcodedUsers = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Charlie", age: 22 },
];

const USER = resource("user", {
  idKey: "id",
  mutableIdKeys: ["name"],

  GET_MANY: () => hardcodedUsers,
  GET: ({ name }) => {},
  POST: ({ name, age }) => {},
  DELETE: ({ name }) => {},
  PUT: ({ name, prop, value }) => {},
  PATCH: ({ name, age }) => {},
});

const App = () => {
  // TODO: A UI displaying the users, with abilitty to preform CRUD operations
  // we can also create a user
};

render(<App />, document.querySelector("#root"));
