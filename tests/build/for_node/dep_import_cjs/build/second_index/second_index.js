var second = {};

var third = {};

var hasRequiredThird;

function requireThird () {
	if (hasRequiredThird) return third;
	hasRequiredThird = 1;
	console.log('third');
	return third;
}

var hasRequiredSecond;

function requireSecond () {
	if (hasRequiredSecond) return second;
	hasRequiredSecond = 1;
	requireThird();

	console.log('bar');
	return second;
}

requireSecond();
