export const closePage = async (page) => {
  try {
    if (!page.isClosed()) {
      await page.close()
    }
  } catch (e) {
    if (e.message.match(/^Protocol error \(.*?\): Target closed/)) {
      return
    }
    throw e
  }
}
