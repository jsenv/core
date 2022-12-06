import { setLinkHrefForParentWindow } from "../util/iframe_to_parent_href.js"

export const renderToolbarDocumentIndexLink = () => {
  setLinkHrefForParentWindow(
    document.querySelector(".document_index_link"),
    "/",
  )
}
