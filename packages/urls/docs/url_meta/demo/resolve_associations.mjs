import { URL_META } from "@jsenv/urls"

const associations = URL_META.resolveAssociations(
  {
    visible: {
      "**/*/": true,
      "**/.git/": false,
    },
  },
  "file:///Users/directory/",
)
console.log(JSON.stringify(associations, null, "  "))
