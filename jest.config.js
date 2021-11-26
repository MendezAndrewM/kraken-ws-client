// /* eslint-disable no-undef */
// const { configure } = require('enzyme');
// // require('jest-enzyme');

// configure({ adapter: new Adapter() });

module.exports = {
	collectCoverage: true,
	coverageReporters: [
		'json',
		'html',
		'text'
	],
	collectCoverageFrom: ['src/**/*.js'],
	moduleDirectories: ['node_modules', 'src', 'test'],
	// testRegex: '(/__tests__/.*(\\.|/)test|spec))\\.(js?|ts?)$',
	// setupFiles: ['./__tests__/init.js'],
	// transform: {
	// 	'^.+\\.(ts|js)$': 'js-jest'
	// },
	globals: {
		'js-jest': {
			jsConfig: '<rootDir>/jsconfig.json'
		}
	}
};
