export const parseAndTransformWebmanifestUrls = async (urlInfo, context) => {
  const content = urlInfo.content;
  const manifest = JSON.parse(content);
  const actions = [];
  const { icons = [] } = manifest;
  icons.forEach((icon) => {
    const [reference] = context.referenceUtils.found({
      type: "webmanifest_icon_src",
      specifier: icon.src,
    });
    actions.push(async () => {
      icon.src = await context.referenceUtils.readGeneratedSpecifier(reference);
    });
  });

  if (actions.length === 0) {
    return null;
  }
  await Promise.all(actions.map((action) => action()));
  return JSON.stringify(manifest, null, "  ");
};
