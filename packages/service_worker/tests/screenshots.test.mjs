/*
 * start a build server
 * open a chrome on that build server (playwright)
 * open 2 tabs on that same html page
 * take a screenshot of both tabs
 * register the worker
 * take a screenshot of both tabs
 * resolve install
 * take a screenshot of both tabs
 * resolve activate
 * take a screenshot of both tabs
 *
 * now regen a new build updating the animal url
 * call check for updates on tab 1
 * take a screenshot of both tabs
 * resolve install
 * take a screenshot (we should see that update can be activated and page will reload)
 * activate it
 * ensure both tabs are reloaded
 * take a screenshot of both tabs
 *
 * now check the checkbox to allow hot update
 * rebuild a new animal and recheck everything is fine
 */
