export const loadUsingDocumentWrite = (scriptSrc) => {
  // document.write force browser to wait for the script to load
  // before doing anything else.
  // it allows to use the library immediatly without having to wait for DOMContentLoaded
  // it requires to escape the closing script tag
  document.write(
    `<script type="text/javascript" charset="utf-8" crossOrigin="anonymous" src="${scriptSrc}">${"</s"}${"cript>"}`,
  )
}
