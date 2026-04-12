import { Code } from "@jsenv/navi";

import { Page, PageBody, PageHead } from "./layout/page.jsx";

export const NotFoundPage = () => {
  return (
    <Page data-ui-name="<NotFoundPage />">
      <PageHead>
        <PageHead.Label label={"Page not found"}></PageHead.Label>
      </PageHead>
      <PageBody>
        <div style="height: 800px; background: yellow; width: 2000px">
          Page <Code>{window.location.pathname}</Code> does not exists
        </div>
      </PageBody>
    </Page>
  );
};
