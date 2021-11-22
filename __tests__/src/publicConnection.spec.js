const KrakenPublicChannel = require('../../src/publicConnection');
const ws = require('ws');
const { KRAKEN_WS_ENDPOINT } = require('../../src/constants');

jest.mock('kraken-api');
jest.mock('ws');

const mockApiKey = 'secret';
const mockPrivateKey = 'supersecret';
const mockConfig = {
	logger: jest.fn()
};

beforeEach(() => {
	ws.mockClear();
});

describe('KrakenPublicChannel', () => {
	let sut;

	describe('connectSocket', () => {
		//TODO: test with third party web socket testing library
		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);

		it('should initiate a web socket connection', () => {
			sut.connectSocket();

			expect(ws).toHaveBeenCalledWith(KRAKEN_WS_ENDPOINT);
		});

	});

	describe('onConnectionError', () => {
		beforeEach(() => {
			sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
		});

		it('should pass the the error into the connectionErrorHandler if it is defined', () => {
			const connectionErrorHandlerMock = jest.fn();
			Object.defineProperty(sut, 'connectionErrorHandler', {
				get: jest.fn(() => connectionErrorHandlerMock),
				set: jest.fn(() => connectionErrorHandlerMock)
			});

			sut.onConnectionError('mock error');

			expect(connectionErrorHandlerMock).toHaveBeenCalledWith('mock error');
		});

		it('should throw the error by default', () => {
			expect(sut.onConnectionError).toThrow();
		});
	});

	describe('onOpen', () => {
		//TODO: describe socket comunication api
		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);

		it('should only call the logger by default', () => {
			sut.onOpen();

			expect(sut.logger).toHaveBeenCalled();
		});
	});

	describe('onPongEvent', () => {
		//TODO: test with third party web socket testing library
	});

	describe('onSystemStatusChange', () => {
		const mockStatusEventData = {
			connectionID: 1,
			status: 'connected',
			version: 1
		};
		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
		sut.onSystemStatusChange(mockStatusEventData);

		expect(sut.logger).toHaveBeenCalledTimes(1);
		expect(sut.logger).toHaveBeenCalledWith({
			'System Status Event': {
				connectionID: 1,
				status: 'connected',
				version: 1,
				timestamp: expect.any(Number)
			}
		});
	});

	describe('onHeartBeat', () => {
		//TODO: test with third party web socket testing library
	});
	describe('onClose', () => {
		//TODO: test with third party web socket testing library
	});

	describe('pingServer', () => {
		it('should ping the kraken api', async () => {
			sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
			const eventEmitter = jest.spyOn(sut, 'emitEvent');
			const mockReqId = 999;

			sut.connectSocket();
			sut.pingServer(mockReqId);

			expect(eventEmitter).toHaveBeenCalledWith({ event: 'ping', reqid: mockReqId });
		});
	});

	describe('emitEvent', () => {
		//TODO: test with third party web socket testing library
	});

	describe('subscriptionService', () => {
		//TODO: test each event type
	});
	describe('onPublicMessage', () => {});
	describe('onSubscriptionStatusEvent', () => {});
});