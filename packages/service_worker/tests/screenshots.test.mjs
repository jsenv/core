/*
 * TO BE TESTED TOO (somewhere else)
 * when there is an error during install/activate
 * the service worker is still registered and cannot be unregistered by API
 * test that is we rebuild a correct service worker (one that does not throw)
 * the registration happens somehow and everything works fine
 * test this also when the update fails to install/activate

 * start a build server
 * open a chrome on that build server (playwright)
 * open 2 tabs on that same html page
 * take a screenshot of both tabs
 * register the worker
 * wait a bit then take a screenshot of both tabs
 * refresh + take a new screenshot
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
