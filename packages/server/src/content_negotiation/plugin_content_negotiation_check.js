import { checkContentNegotiation } from "./checkContentNegotiation.js"

export const pluginContentNegotiationCheck = () => {
  return {
    content_negotiation_check: {
      onRequest: (request, { warn }) => {
        return {
          onResponse: (response) => {
            checkContentNegotiation(request, response, { warn })
          },
        }
      },
    },
  }
}
