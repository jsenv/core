/*

This test verifies that it's possible to cancel navigation induces by a popstate event.

It means user can click back/forward or even go somwhere specific in browser history and
website ui can start to navigate to this entry and user can still cancel this navigation and he
will be back to the previous entry (before hitting back/previous)

to test this we can check navigationEvent.type === 'popstate' and
where we want to go to cancel it.

After that we'll need to check no navigation occurs and website state is preserved
without asking to renaviguqte we are already are

*/
