import { snapshotTests } from "@jsenv/snapshot";
import { resource } from "../resource_graph.js";

/**
 * Real-world scenario: a product catalog
 *
 * - Categories are independent resources
 * - Products reference a category via .one()
 * - Each product has embedded settings via .ownOne()
 * - When fetching products, the backend embeds the category object inline
 * - Updating a category reflects on all products referencing it
 */

await snapshotTests(import.meta.url, ({ test }) => {
  test("product catalog", async () => {
    const CATEGORY = resource("category", {
      PATCH: async ({ id, label }) => ({ id, label }),
    });

    const PRODUCT = resource("product", {
      GET_MANY: async () => [
        {
          id: 1,
          name: "Widget A",
          price: 9.99,
          category: { id: 10, label: "Widgets" },
        },
        {
          id: 2,
          name: "Gadget B",
          price: 24.99,
          category: { id: 11, label: "Gadgets" },
        },
      ],
      POST: async ({ name, price, categoryId }) => ({
        id: 3,
        name,
        price,
        category: { id: categoryId },
      }),
      PATCH: async ({ id, price }) => ({ id, price }),
      DELETE: async ({ id }) => id,
    });

    PRODUCT.one("category", CATEGORY);

    const PRODUCT_SETTINGS = PRODUCT.ownOne("settings", {
      GET: async ({ id }) => [id, { featured: false, tags: [] }],
      PATCH: async ({ id, featured, tags }) => [id, { featured, tags }],
    });

    // Load all products (categories embedded in response)
    await PRODUCT.GET_MANY.run();
    const productsAfterLoad = PRODUCT.store.arraySignal.value;
    const categoriesAfterLoad = CATEGORY.store.arraySignal.value;
    const widgetACategory = productsAfterLoad[0].category;

    // Rename the "Widgets" category — should reflect on product.category
    await CATEGORY.PATCH({ id: 10, label: "Premium Widgets" });
    const widgetACategoryAfterRename = productsAfterLoad[0].category;

    // Add a new product in the Widgets category
    await PRODUCT.POST({ name: "Widget C", price: 14.99, categoryId: 10 });
    const productsAfterPost = PRODUCT.store.arraySignal.value;

    // Update Widget A price
    await PRODUCT.PATCH({ id: 1, price: 12.99 });
    const widgetAAfterPatch = { ...PRODUCT.store.arraySignal.value[0] };

    // Load settings for Widget A
    await PRODUCT_SETTINGS.GET({ id: 1 });
    const widgetASettingsAfterGet = { ...productsAfterLoad[0].settings };

    await PRODUCT_SETTINGS.PATCH({ id: 1, featured: true, tags: ["sale"] });
    const widgetASettingsAfterPatch = { ...productsAfterLoad[0].settings };

    // Delete Gadget B
    await PRODUCT.DELETE({ id: 2 });
    const productsAfterDelete = PRODUCT.store.arraySignal.value;

    return {
      productsAfterLoad,
      categoriesAfterLoad,
      widgetACategory,
      widgetACategoryAfterRename,
      productsAfterPost,
      widgetAAfterPatch,
      widgetASettingsAfterGet,
      widgetASettingsAfterPatch,
      productsAfterDelete,
    };
  });
});
