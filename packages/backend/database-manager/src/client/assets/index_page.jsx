import { Page, PageBody, PageHead } from "./layout/page.jsx";

export const IndexPage = () => {
  return (
    <Page data-ui-name="<NotFoundPage />">
      <PageHead>
        <PageHead.Label label={"Welcome"}></PageHead.Label>
      </PageHead>
      <PageBody>
        <div style="height: 800px; background: yellow; width: 2000px">
          Welcome
        </div>
      </PageBody>
    </Page>
  );
};
