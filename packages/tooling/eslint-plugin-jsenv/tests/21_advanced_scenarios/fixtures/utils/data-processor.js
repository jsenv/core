export function processData({ input, format }) {
  console.log("Processing:", input, "as", format);
  return { processed: true, input, format };
}
