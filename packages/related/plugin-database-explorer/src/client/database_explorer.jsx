// TODO: SPA
// ability to get the list of tables (everything for now)
// and so on

import { render } from "preact";

const App = () => {
  return (
    <div>
      <h1>Database Explorer</h1>
      <p>Explore and manage your database.</p>
    </div>
  );
};

render(<App />, document.querySelector("#app"));
