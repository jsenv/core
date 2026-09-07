import { render } from "preact";

import {
  Box,
  Button,
  ErrorBoundary,
  Link,
  Loading,
  Nav,
  Route,
  Text,
  useAsyncData,
} from "@jsenv/navi";

import { DemoHeader } from "../../../internal/demo_header.jsx";
import { DocumentToc } from "../../../internal/document_toc.jsx";
import { FakeBackend } from "../../../internal/fake_backend.jsx";
import {
  backend,
  GAME_PAGE_CODE,
  GAME_ROUTE,
  HOME_ROUTE,
  STATS_PAGE_CODE,
  STATS_ROUTE,
} from "./demo_backend.js";

const GamePage = () => {
  const [Page] = useAsyncData(GAME_PAGE_CODE);
  return <Page />;
};
const StatsPage = () => {
  const [Page] = useAsyncData(STATS_PAGE_CODE);
  return <Page />;
};

const Heading = ({ level = 2, id, children }) => {
  const Tag = `h${level}`;
  return (
    <Tag id={id}>
      <Link anchor revealOnInteraction href={`#${id}`}>
        #
      </Link>
      {children}
    </Tag>
  );
};

const App = () => {
  return (
    <div>
      <DemoHeader title="Code splitting demo" />
      <TableOfContents />
      <NominalDemo />
    </div>
  );
};

const TableOfContents = () => (
  <div className="demo-section">
    <h2>Table of contents</h2>
    <DocumentToc />
  </div>
);

const NominalDemo = () => (
  <div className="demo-section">
    <Heading id="nominal">Cas nominal</Heading>
    <FakeBackend backend={backend}>{() => <Pages />}</FakeBackend>
  </div>
);

const Pages = () => {
  return (
    <Box flex="y" spacing="m">
      <Nav spacing="s">
        <Link variant="tab" currentIndicator padding="s" route={HOME_ROUTE}>
          Accueil
        </Link>
        <Link
          variant="tab"
          currentIndicator
          padding="s"
          route={GAME_ROUTE}
          routeParams={{ gameId: "1" }}
        >
          Partie
        </Link>
        <Link
          variant="tab"
          currentIndicator
          padding="s"
          route={STATS_ROUTE}
          prefetch={false}
        >
          Statistiques
        </Link>
      </Nav>
      <div className="page">
        <Route>
          <Route route={HOME_ROUTE} element={HomePage} />
          <ErrorBoundary fallback={PageError}>
            <Loading fallback={<PageSkeleton />}>
              <Route route={GAME_ROUTE} element={GamePage} />
              <Route route={STATS_ROUTE} element={StatsPage} />
            </Loading>
          </ErrorBoundary>
          <Route fallback element={NotFoundPage} />
        </Route>
      </div>
    </Box>
  );
};

const HomePage = () => (
  <Box flex="y" spacing="m">
    <Box flex="y" spacing="s">
      <Text>Accueil — dans le bundle principal.</Text>
      <Text>
        Partie — code préchargé au survol du lien, donnée à l'ouverture.
      </Text>
      <Text>
        Statistiques — prefetch={"{false}"} : code chargé à l'ouverture.
      </Text>
    </Box>
    <Box flex="y" spacing="s">
      <Text bold>Plan du club — un composant chargé à la demande</Text>
      <PlanSection />
    </Box>
  </Box>
);
// A component inside a page that stays draws its own wait and its own failure,
// in its own frame: it knows what stands there.
const PlanSection = () => {
  const [Plan, loading, error] = useAsyncData(
    () =>
      backend
        .call("import ./plan.jsx", () => import("./plan.jsx"))
        .then((m) => m.Plan),
    { loading: true, error: true },
  );
  return (
    <PlanFrame>
      {loading ? <Text>chargement…</Text> : null}
      {error ? (
        <>
          <Text style={{ color: "red" }}>{error.message}</Text>
          <Button action={() => error.action.rerun()}>Réessayer</Button>
        </>
      ) : null}
      {Plan ? <Plan /> : null}
    </PlanFrame>
  );
};
// The frame belongs to the eager side: it is drawn before the plan's own code
// exists.
const PlanFrame = ({ children }) => (
  <Box
    flex="y"
    spacing="s"
    style={{
      minHeight: "60px",
      padding: "10px",
      background: "#eef3ee",
      border: "1px solid #b7c9b7",
      borderRadius: "6px",
    }}
  >
    {children}
  </Box>
);
const NotFoundPage = () => <Text>Page introuvable.</Text>;
const PageSkeleton = () => (
  <Box flex="y" spacing="s">
    <Box style={{ width: "180px", height: "1lh", background: "#e5e5e5" }} />
    <Box style={{ width: "120px", height: "1lh", background: "#e5e5e5" }} />
  </Box>
);
const PageError = ({ error }) => (
  <Box flex="y" spacing="s">
    <Text style={{ color: "red" }}>{error.message}</Text>
    <Button action={() => error.action.rerun()}>Réessayer</Button>
  </Box>
);

render(<App />, document.querySelector("#root"));
