/*
 * What a <Form> sends, when it sends nothing, and what follows a send — read
 * as values: every case's action records what it receives
 * (window.formCalls), and the fields are read off the DOM.
 *
 * A case waits for what it expects (a send, the end of a run) with a bound
 * that is only there for when it never comes: a send that does not happen
 * then reads as no send, which is the answer some cases are about.
 */

"jsenv:allocate 120s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage as openHarnessPage,
  startNaviDevServer,
  waitFrames,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
const pageUrl = `${devServer.origin}/tests/form_send_and_reset/client/form_send_and_reset.html`;

const openPage = async (browser) => {
  const { page, errors, warnings } = await openHarnessPage(browser, pageUrl);
  await page.waitForSelector("#named_submit_publish", { timeout: 5000 });
  await waitFrames(page);
  return { page, errors, warnings };
};

const readCalls = (page, caseId) =>
  page.evaluate(
    // eslint-disable-next-line no-undef
    (id) => window.formCalls[id] || [],
    caseId,
  );
const waitForCallCount = (page, caseId, count) =>
  page
    .waitForFunction(
      ({ id, n }) =>
        // eslint-disable-next-line no-undef
        (window.formCalls[id] || []).length >= n,
      { id: caseId, n: count },
      { timeout: 2000 },
    )
    .catch(() => {});
const readValue = (page, selector) =>
  page.evaluate(
    // eslint-disable-next-line no-undef
    (s) => document.querySelector(s).value,
    selector,
  );
// What a refusal says: the callout navi opens on the field it is about.
const sendAndReadCallout = async (page, caseId) => {
  await page.evaluate(
    // eslint-disable-next-line no-undef
    (id) => document.querySelector(`#${id} form`).requestSubmit(),
    caseId,
  );
  await page
    .waitForSelector(".navi_callout", { timeout: 2000 })
    .catch(() => {});
  return page.evaluate(() => {
    // eslint-disable-next-line no-undef
    const callout = document.querySelector(".navi_callout");
    return callout ? callout.textContent.replace(/\s+/g, " ").trim() : null;
  });
};
const readOnlyOf = (page, selector) =>
  page.evaluate((s) => {
    /* eslint-disable no-undef */
    const element = document.querySelector(s);
    return {
      "aria-readonly": element.getAttribute("aria-readonly"),
      "data-readonly-reason": element.getAttribute("data-readonly-reason"),
    };
    /* eslint-enable no-undef */
  }, selector);

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

const untouchedCase =
  (caseId) =>
  async ({ browser }) => {
    const { page, errors } = await openPage(browser);
    try {
      const saveAtMount = await readOnlyOf(page, `#${caseId}_save`);
      await page.click(`#${caseId}_save`);
      await waitFrames(page);
      return {
        save_at_mount: saveAtMount,
        calls_after_save: await readCalls(page, caseId),
        errors,
      };
    } finally {
      await page.close();
    }
  };

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(
      test,
      "untouched form holding a boolean checkbox",
      untouchedCase("untouched_boolean"),
    );
    testInEngines(
      test,
      "untouched form holding a checkbox group",
      untouchedCase("untouched_checkbox_group"),
    );
    testInEngines(
      test,
      "untouched form holding a named control group",
      untouchedCase("untouched_control_group"),
    );
    testInEngines(
      test,
      "untouched form editing a record",
      untouchedCase("record_untouched"),
    );

    testInEngines(
      test,
      "optimistic form typed into while its send is out",
      async ({ browser }) => {
        const { page, errors } = await openPage(browser);
        try {
          await page.click("#optimistic_typing_title");
          await page.keyboard.type("hello");
          await page.keyboard.press("Enter");
          await waitForCallCount(page, "optimistic_typing", 1);
          await page.keyboard.type(" world");
          await page
            .waitForFunction(
              () =>
                // eslint-disable-next-line no-undef
                !document
                  .querySelector("#optimistic_typing form")
                  .hasAttribute("data-optimistic"),
              null,
              { timeout: 2000 },
            )
            .catch(() => {});
          await page.keyboard.press("Enter");
          await waitForCallCount(page, "optimistic_typing", 2);
          return {
            calls: await readCalls(page, "optimistic_typing"),
            errors,
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "form refused at once by a synchronous throw",
      async ({ browser }) => {
        const { page } = await openPage(browser);
        try {
          await page.click("#sync_failure_title");
          await page.keyboard.type("abc");
          await page.keyboard.press("Enter");
          await waitForCallCount(page, "sync_failure", 1);
          await waitFrames(page);
          return {
            calls: await readCalls(page, "sync_failure"),
            title_after_refusal: await readValue(page, "#sync_failure_title"),
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "enter in a field of a nested group",
      async ({ browser }) => {
        const { page, errors } = await openPage(browser);
        try {
          await page.click("#nested_group_enter_street");
          await page.keyboard.type("x");
          await page.keyboard.press("Enter");
          await waitForCallCount(page, "nested_group_enter", 1);
          await waitFrames(page);
          return {
            calls: await readCalls(page, "nested_group_enter"),
            street_after_send: await readValue(
              page,
              "#nested_group_enter_street",
            ),
            errors,
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(test, "requestSubmit()", async ({ browser }) => {
      const { page, errors } = await openPage(browser);
      try {
        await page.click("#request_submit_title");
        await page.keyboard.type("x");
        await page.evaluate(() =>
          // eslint-disable-next-line no-undef
          document.querySelector("#request_submit_form").requestSubmit(),
        );
        await waitForCallCount(page, "request_submit", 1);
        await waitFrames(page);
        return {
          calls: await readCalls(page, "request_submit"),
          title_after_send: await readValue(page, "#request_submit_title"),
          errors,
        };
      } finally {
        await page.close();
      }
    });

    testInEngines(
      test,
      "required checkbox with no group around it",
      async ({ browser }) => {
        const { page, errors } = await openPage(browser);
        try {
          return {
            rendered: await page.evaluate(() =>
              Boolean(
                // eslint-disable-next-line no-undef
                document.querySelector("#lone_required_checkbox_input"),
              ),
            ),
            errors,
          };
        } finally {
          await page.close();
        }
      },
    );

    for (const caseId of ["month_step", "week_step", "datetime_step"]) {
      testInEngines(
        test,
        `step on a ${caseId.replace("_step", "")} field`,
        async ({ browser }) => {
          const { page, errors } = await openPage(browser);
          try {
            return {
              callout: await sendAndReadCallout(page, caseId),
              calls: await readCalls(page, caseId),
              errors,
            };
          } finally {
            await page.close();
          }
        },
      );
    }

    testInEngines(test, "message written on the field", async ({ browser }) => {
      const { page, errors } = await openPage(browser);
      try {
        return {
          callout: await sendAndReadCallout(page, "field_message"),
          calls: await readCalls(page, "field_message"),
          errors,
        };
      } finally {
        await page.close();
      }
    });

    testInEngines(
      test,
      "record save the server normalizes",
      async ({ browser }) => {
        const { page, errors } = await openPage(browser);
        try {
          await page.click("#record_normalized_name");
          await page.keyboard.press("ControlOrMeta+a");
          await page.keyboard.type("Bob ");
          await page.click("#record_normalized_save");
          await waitForCallCount(page, "record_normalized", 1);
          await page
            .waitForFunction(
              () =>
                // eslint-disable-next-line no-undef
                document.querySelector("#record_normalized_name").value ===
                "Bob",
              null,
              { timeout: 2000 },
            )
            .catch(() => {});
          await waitFrames(page);
          return {
            calls: await readCalls(page, "record_normalized"),
            name_after_save: await readValue(page, "#record_normalized_name"),
            save_after_save: await readOnlyOf(page, "#record_normalized_save"),
            errors,
          };
        } finally {
          await page.close();
        }
      },
    );

    for (const caseId of ["plain_signal_rollback", "state_signal_rollback"]) {
      testInEngines(
        test,
        `checkbox on a ${caseId.startsWith("plain") ? "plain signal" : "stateSignal"}, saved then refused`,
        async ({ browser }) => {
          const { page } = await openPage(browser);
          const boxSelector = `#${caseId}_box`;
          try {
            await page.click(boxSelector);
            await waitForCallCount(page, caseId, 1);
            await page
              .waitForFunction(
                // eslint-disable-next-line no-undef
                (s) => !document.querySelector(s).closest("[aria-busy='true']"),
                boxSelector,
                { timeout: 2000 },
              )
              .catch(() => {});
            await page.click(boxSelector);
            await waitForCallCount(page, caseId, 2);
            await page
              .waitForFunction(
                // eslint-disable-next-line no-undef
                (s) => document.querySelector(s).checked === true,
                boxSelector,
                { timeout: 2000 },
              )
              .catch(() => {});
            await waitFrames(page);
            return {
              calls: await readCalls(page, caseId),
              checked_after_refusal: await page.evaluate(
                // eslint-disable-next-line no-undef
                (s) => document.querySelector(s).checked,
                boxSelector,
              ),
            };
          } finally {
            await page.close();
          }
        },
      );
    }

    testInEngines(
      test,
      "value refused, then asked again",
      async ({ browser }) => {
        const { page } = await openPage(browser);
        try {
          await page.click("#retry_refused_input");
          await page.keyboard.type("x");
          await page.keyboard.press("Tab");
          await waitForCallCount(page, "retry_refused", 1);
          // The refusal puts the field back where it was, empty.
          await page
            .waitForFunction(
              () =>
                // eslint-disable-next-line no-undef
                document.querySelector("#retry_refused_input").value === "",
              null,
              { timeout: 2000 },
            )
            .catch(() => {});
          await page.click("#retry_refused_input");
          await page.keyboard.type("x");
          await page.keyboard.press("Tab");
          await waitForCallCount(page, "retry_refused", 2);
          return {
            calls: await readCalls(page, "retry_refused"),
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "reset after a send goes to the default",
      async ({ browser }) => {
        const { page, errors } = await openPage(browser);
        try {
          await page.click("#reset_to_default_title");
          await page.keyboard.press("ControlOrMeta+a");
          await page.keyboard.type("x");
          await page.keyboard.press("Enter");
          await waitForCallCount(page, "reset_to_default", 1);
          await page
            .waitForFunction(
              () =>
                // eslint-disable-next-line no-undef
                document.querySelector("#reset_to_default_title").value ===
                "draft",
              null,
              { timeout: 2000 },
            )
            .catch(() => {});
          return {
            calls: await readCalls(page, "reset_to_default"),
            title_after_send: await readValue(page, "#reset_to_default_title"),
            errors,
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "named submit refused, then enter",
      async ({ browser }) => {
        const { page } = await openPage(browser);
        try {
          await page.click("#named_submit_title");
          await page.keyboard.type("a");
          await page.click("#named_submit_publish");
          await waitForCallCount(page, "named_submit", 1);
          await page.click("#named_submit_title");
          await page.keyboard.type("b");
          await page.keyboard.press("Enter");
          await waitForCallCount(page, "named_submit", 2);
          return {
            calls: await readCalls(page, "named_submit"),
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "picker popup form refused after the close took it away",
      async ({ browser }) => {
        const { page, errors } = await openPage(browser);
        try {
          await page.click("#left_popup_refused_picker");
          await page.waitForSelector("#left_popup_refused_title", {
            timeout: 2000,
          });
          await page.click("#left_popup_refused_title");
          await page.keyboard.press("ControlOrMeta+a");
          await page.keyboard.type("new");
          await waitFrames(page);
          await page.keyboard.press("Enter");
          await waitForCallCount(page, "left_popup_refused", 1);
          const readPicker = () =>
            page.evaluate(() => ({
              // eslint-disable-next-line no-undef
              value: window.leftPopupSignal.value,
              popup_mounted: Boolean(
                // eslint-disable-next-line no-undef
                document.querySelector("#left_popup_refused_title"),
              ),
            }));
          const whileSaving = await readPicker();
          await page
            .waitForFunction(
              // eslint-disable-next-line no-undef
              () => window.leftPopupSignal.value?.title === "old",
              null,
              { timeout: 2000 },
            )
            .catch(() => {});
          return {
            calls: await readCalls(page, "left_popup_refused"),
            while_saving: whileSaving,
            after_refusal: await readPicker(),
            errors,
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "reset reaching a nested group runs none of its command",
      async ({ browser }) => {
        const { page, errors } = await openPage(browser);
        try {
          await page.click("#nested_group_command_a");
          await waitForCallCount(page, "nested_group_command", 1);
          await page.click("#nested_group_command_reset");
          // A second send would be the group's --navi-send run by the reset.
          await waitForCallCount(page, "nested_group_command", 2);
          return {
            calls: await readCalls(page, "nested_group_command"),
            a_checked_after_reset: await page.evaluate(
              // eslint-disable-next-line no-undef
              () => document.querySelector("#nested_group_command_a").checked,
            ),
            errors,
          };
        } finally {
          await page.close();
        }
      },
    );
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
