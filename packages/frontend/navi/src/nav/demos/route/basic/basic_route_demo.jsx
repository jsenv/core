import {
  ActionRenderer,
  createAction,
  enableDebugActions,
  setupRoutes,
  // enableDebugOnDocumentLoading,
  useActionStatus,
  useRouteStatus,
} from "@jsenv/navi";
import { render } from "preact";

enableDebugActions();
// enableDebugOnDocumentLoading();

const loadPageAction = createAction(
  async ({ pageName }) => {
    // Simulate some loading time
    await new Promise((resolve) => setTimeout(resolve, 800));
    return `${pageName}: content loaded at ${new Date().toLocaleTimeString()}`;
  },
  {
    name: "loadPage",
  },
);
const [PAGE_ROUTE] = setupRoutes({ PAGE_ROUTE: "page/:pageName" });
const loadPageFromUrlAction = pageRoute.action;

const RouteStatus = ({ route }) => {
  const { active, params } = useRouteStatus(route);

  return (
    <div
      style={{
        padding: "10px",
        margin: "10px 0",
        border: "1px solid #ccc",
        borderRadius: "4px",
        backgroundColor: "#f8f9fa",
      }}
    >
      <h3>Route Status:</h3>
      <div>
        <strong>Pattern:</strong> {route.pattern}
      </div>
      <div>
        <strong>Current URL:</strong> {route.relativeUrl}
      </div>
      <div>
        <strong>Active:</strong> {active ? "✅ Yes" : "❌ No"}
      </div>
      <div>
        <strong>Params:</strong> {JSON.stringify(params)}
      </div>
    </div>
  );
};

const getStatusColor = (loadingState) => {
  switch (loadingState) {
    case "IDLE":
      return "#6c757d";
    case "LOADING":
      return "#0d6efd";
    case "LOADED":
      return "#198754";
    case "FAILED":
      return "#dc3545";
    case "ABORTED":
      return "#fd7e14";
    default:
      return "#6c757d";
  }
};
const getStatusIcon = (loadingState) => {
  switch (loadingState) {
    case "IDLE":
      return "⏸️";
    case "LOADING":
      return "⏳";
    case "LOADED":
      return "✅";
    case "FAILED":
      return "❌";
    case "ABORTED":
      return "⏹️";
    default:
      return "❓";
  }
};
const ActionStatus = ({ action }) => {
  const { loadingState, loadRequested, data, error, params } =
    useActionStatus(action);

  return (
    <div
      style={{
        padding: "10px",
        margin: "10px 0",
        border: "1px solid #ccc",
        borderRadius: "4px",
        backgroundColor: "#f8f9fa",
      }}
    >
      <h3>Action Status:</h3>
      <div>
        <strong>Name:</strong> {action.name}
      </div>
      <div>
        <strong>Status:</strong>
        <span
          style={{
            color: getStatusColor(loadingState),
            marginLeft: "8px",
            fontWeight: "bold",
          }}
        >
          {getStatusIcon(loadingState)} {loadingState.id}
        </span>
      </div>
      <div>
        <strong>Load Requested:</strong> {loadRequested ? "✅ Yes" : "❌ No"}
      </div>
      <div>
        <strong>Params:</strong> {JSON.stringify(params)}
      </div>
      {error && (
        <div style={{ color: "#dc3545" }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}
      {data && (
        <div style={{ color: "#198754" }}>
          <strong>Data:</strong> {data}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const pageAUrl = PAGE_ROUTE.buildUrl({ pageName: "a" });
  const pageBUrl = PAGE_ROUTE.buildUrl({ pageName: "b" });

  return (
    <>
      <nav
        style={{
          padding: "20px",
          borderBottom: "1px solid #ccc",
          marginBottom: "20px",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            display: "flex",
            gap: "20px",
            margin: 0,
            padding: 0,
          }}
        >
          <li>
            <a
              draggable="false"
              href={pageAUrl}
              style={{
                textDecoration: "none",
                padding: "8px 16px",
                border: "1px solid #007bff",
                borderRadius: "4px",
                color: "#007bff",
              }}
            >
              Page A
            </a>
          </li>
          <li>
            <a
              draggable="false"
              href={pageBUrl}
              style={{
                textDecoration: "none",
                padding: "8px 16px",
                border: "1px solid #007bff",
                borderRadius: "4px",
                color: "#007bff",
              }}
            >
              Page B
            </a>
          </li>
        </ul>
      </nav>

      <div style={{ padding: "0 20px" }}>
        <h1>Routing Demo</h1>

        <RouteStatus route={PAGE_ROUTE} />
        <ActionStatus action={loadPageFromUrlAction} />

        <main
          style={{
            padding: "20px",
            margin: "20px 0",
            border: "2px solid #007bff",
            borderRadius: "8px",
            backgroundColor: "#e7f3ff",
          }}
        >
          <h2>Page Content:</h2>
          <ActionRenderer action={loadPageFromUrlAction}>
            {(content) => (
              <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                {content}
              </div>
            )}
          </ActionRenderer>
        </main>
      </div>
    </>
  );
};

render(<App />, document.querySelector("#root"));
