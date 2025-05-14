/**
 * I'll re-implement a custom validity api
 * because the native one is not configurable enough:
 *
 * - REALLY PAINFUL can't tell if the message is displayed or not, nor remove it with escape or something
 * - ok but complex: have to listen many evens in all directions to decide wether it's time to display the message or not
 * - ok but sitll not great: have to hack setCustomValidity to hold many validation messages
 * - ok but might be great to have some form of control on the design: can't customize the message
 */
