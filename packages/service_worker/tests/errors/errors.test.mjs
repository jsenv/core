/*
 * when there is an error during install/activate
 * the service worker is still registered and cannot be unregistered by API
 * test that is we rebuild a correct service worker (one that does not throw)
 * the registration happens somehow and everything works fine
 * test this also when the update fails to install/activate
 */
