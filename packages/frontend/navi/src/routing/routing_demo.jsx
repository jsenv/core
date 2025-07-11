import { ActionRenderer, createAction } from "@jsenv/navi";
import { render } from "preact";
import { setupNavigateHandler } from "./nav.js";
import { createRoute } from "./route.js";

setupNavigateHandler(() => {});

const loadPageAction = createAction(async ({ pageName }) => {
  return `${pageName}: content`;
});
const pageRoute = createRoute("page/:pageName");
const loadPageFromUrlAction = loadPageAction.bindParams(pageRoute.paramsSignal);

const App = () => {
  const pageAUrl = pageRoute.buildUrl({ pageName: "a" });

  return (
    <>
      <nav>
        <ul>
          <li>
            <a href={pageAUrl}>A</a>
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
