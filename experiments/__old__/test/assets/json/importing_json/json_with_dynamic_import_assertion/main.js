const json = await import("./data.json", { assert: { type: "json" } })

const data = json.default

export { data }
