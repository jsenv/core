export const closePage = async (page) => {
  try {
    await page.close()
  } catch (e) {
    if (e.message.match(/^Protocol error \(.*?\): Target closed/)) {
      return
    }
    throw e
  }
}
