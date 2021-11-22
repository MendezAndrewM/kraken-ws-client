const nonFunctionError = (input) => {
	return new Error(`Expected a function. Recieved: ${typeof input}`);
};

const nonFunctionArrayError = (input) => {
	return new Error(`Expected an Array of function(s). Recieved: ${typeof input}`);
}

module.exports = {nonFunctionError, nonFunctionArrayError};