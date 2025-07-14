import { ActionRenderer, createAction } from "@jsenv/navi";
import { render } from "preact";
import { createRoute } from "./route.js";
import { setupRoutingViaHistory } from "./routing_via_history.js";

setupRoutingViaHistory(() => {});

const loadPageAction = createAction(async ({ pageName }) => {
  return `${pageName}: content`;
});
const pageRoute = createRoute("page/:pageName");
const loadPageFromUrlAction = pageRoute.bindAction(loadPageAction);

const App = () => {
  const pageAUrl = pageRoute.buildUrl({ pageName: "a" });
  const pageBUrl = pageRoute.buildUrl({ pageName: "b" });

  return (
    <>
      <nav>
        <ul>
          <li>
            <a href={pageAUrl}>A</a>
          </li>
          <li>
            <a href={pageBUrl}>B</a>
          </li>
        </ul>
      </nav>
      <main>
        <ActionRenderer action={loadPageFromUrlAction}>
          {(content) => content}
        </ActionRenderer>
      </main>
    </>
  );
};

render(<App />, document.querySelector("#root"));
