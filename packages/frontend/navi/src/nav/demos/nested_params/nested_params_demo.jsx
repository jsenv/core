import { render } from "preact";

import {
  Link,
  Nav,
  Route,
  route,
  setupRoutes,
  useUrlSearchParam,
} from "@jsenv/navi";

const HOME_ROUTE = route("");
const GALLERY_ROUTE = route("/gallery/*");
const PHOTOS_ROUTE = route("/gallery/photos");
const ALBUMS_ROUTE = route("/gallery/albums");
setupRoutes([HOME_ROUTE, GALLERY_ROUTE, PHOTOS_ROUTE, ALBUMS_ROUTE]);

const HomePage = () => {
  return (
    <div>
      <h2>Home</h2>
      <p>
        Navigate to the gallery to see how sub-pages inherit the color theme.
      </p>
    </div>
  );
};
const GalleryPage = () => {
  const [color] = useUrlSearchParam("color");

  return (
    <div>
      <h2>Gallery</h2>
      <p>
        Color theme: <strong>{color || "blue"}</strong>
      </p>

      <h3>Gallery Sections</h3>
      <p>Photos and albums will inherit the current color theme:</p>
      <Nav spacing="s">
        <Link route={PHOTOS_ROUTE} routeParams={{ color }} />
        <Link route={ALBUMS_ROUTE} routeParams={{ color }} />
      </Nav>

      <Route>
        <Route route={PHOTOS_ROUTE} element={<PhotosPage />} />
        <Route route={ALBUMS_ROUTE} element={<AlbumsPage />} />
      </Route>
    </div>
  );
};
const PhotosPage = () => {
  const [color] = useUrlSearchParam("color");

  return (
    <div>
      <h2>Photos</h2>
      <p>
        Showing photos with <strong>{color || "blue"}</strong> theme.
      </p>
      <p>
        This page displays photos using the gallery's color theme preference.
      </p>
    </div>
  );
};
const AlbumsPage = () => {
  const [color] = useUrlSearchParam("color");

  return (
    <div>
      <h2>Albums</h2>
      <p>
        Showing albums with <strong>{color || "blue"}</strong> theme.
      </p>
      <p>
        This page displays albums using the same color theme from the gallery.
      </p>
    </div>
  );
};

const App = () => {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h1>Nested Parameters Demo</h1>
      <p>Test how gallery sub-pages inherit the color theme.</p>

      {/* Top level navigation - always available */}
      <div style={{ marginBottom: "20px" }}>
        <Nav spacing="s">
          <Link route={HOME_ROUTE}>Home</Link>
          <Link route={GALLERY_ROUTE} routeParams={{ color: "red" }} />
          <Link route={GALLERY_ROUTE} routeParams={{ color: "green" }} />
        </Nav>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          backgroundColor: "#fafafa",
        }}
      >
        <Route>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={GALLERY_ROUTE} element={<GalleryPage />} />
        </Route>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
