## Prochain truc a faire:

1. write a test to ensure I can create many ressource and they are properly gc'ed
   Right now it look like actions creating resources are kept in memory because I can do
   window.actions.activationRegistry.getInfo()
   And I see the many actions used to create resources are still there in a loaded state
   As there is no UI element referencing them nor anything else
   I would expect them to disapear (be garbage collected)
2. resource.describe avec une relation 1:n
