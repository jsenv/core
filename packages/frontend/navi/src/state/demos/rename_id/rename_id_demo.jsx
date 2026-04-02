import { ActionRenderer, Button, resource } from "@jsenv/navi";
import { render } from "preact";

// flat list — the color name IS the id
const colorsStore = [{ name: "red" }, { name: "blue" }, { name: "green" }];

const COLOR = resource("color", {
  idKey: "name",

  GET_MANY: () => [...colorsStore],

  PUT: ({ name, new_name }) => {
    const color = colorsStore.find((c) => c.name === name);
    if (!color) throw new Error(`Color "${name}" not found`);
    color.name = new_name;
    // 3-arg form: [propertyToMatchBy, valueToMatch, newProps]
    // tells the store: find item where name==="red", update it to {name:"red_2"}
    return ["name", name, { name: new_name }];
  },
});

const allColorsAction = COLOR.GET_MANY;
allColorsAction.prerun();

const ColorRow = ({ color }) => {
  return (
    <li>
      <code>{color.name}</code>
      <Button
        action={() => {
          COLOR.PUT({ name: color.name, new_name: `${color.name}_2` });
        }}
      >
        rename
      </Button>
    </li>
  );
};

const App = () => {
  return (
    <div>
      <ActionRenderer action={allColorsAction}>
        {(colors) => (
          <ul>
            {colors.map((color) => (
              <ColorRow key={color.name} color={color} />
            ))}
          </ul>
        )}
      </ActionRenderer>
    </div>
  );
};

render(<App />, document.getElementById("root"));
