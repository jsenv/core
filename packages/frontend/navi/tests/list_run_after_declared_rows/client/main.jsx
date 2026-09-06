/*
 * A run of rows preceded by rows given one by one.
 *
 * The list numbers its rows from its own first one; the collection the run
 * reads numbers its own from ITS first one. A run that is the whole list makes
 * the two the same number, which is why every list in an application is fine
 * until one of them declares a row before its run — the group's admin above
 * the members read by range, in the report this comes from.
 *
 * Three lists here, differing only by how many rows are declared before the
 * run. All three must draw the same three items, in order, and ask for the
 * same range: the collection has three rows wherever the run happens to sit.
 */

import { List } from "@jsenv/navi";
import { render } from "preact";

const ALL = [
  { id: "a", label: "item 0" },
  { id: "b", label: "item 1" },
  { id: "c", label: "item 2" },
];

window.asks = {};
const readRange = (listId) => {
  const asks = [];
  window.asks[listId] = asks;
  return ({ start, end }) => {
    asks.push(`${start}-${end}`);
    const from = start < 0 ? ALL.length + start : start;
    const to = end > ALL.length - 1 ? ALL.length - 1 : end;
    const items = to < from ? [] : ALL.slice(from, to + 1);
    return Promise.resolve({ items, start: from, count: ALL.length });
  };
};

const Run = ({ listId }) => (
  <List.Items
    count={ALL.length}
    pageSize={50}
    itemsAction={readRange(listId)}
    renderSkeleton={() => <List.Item>loading</List.Item>}
    renderItem={(item) => <List.Item key={item.id}>{item.label}</List.Item>}
  />
);

const App = () => {
  return (
    <div>
      <List id="alone" borderWidth="0" scroller="document">
        <Run listId="alone" />
      </List>
      <List id="one_declared" borderWidth="0" scroller="document">
        <List.Item id="declared_a">declared a</List.Item>
        <Run listId="one_declared" />
      </List>
      <List id="two_declared" borderWidth="0" scroller="document">
        <List.Item id="declared_a">declared a</List.Item>
        <List.Item id="declared_b">declared b</List.Item>
        <Run listId="two_declared" />
      </List>
    </div>
  );
};

render(<App />, document.querySelector("#app"));
