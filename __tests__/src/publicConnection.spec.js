const KrakenPublicChannel = require('../../src/publicConnection');
const MockDate = require('mockdate');
const WS = require('ws');

const { datatype } = require('faker');

jest.genMockFromModule('ws');
jest.mock('ws');
jest.mock('kraken-api');

const mockSocketClient = {
	send: jest.fn(),
	on: jest.fn(),
	close: jest.fn(),
};

const mockApiKey = 'secret';
const mockPrivateKey = 'supersecret';
const mockConfig = {
	logger: jest.fn()
};

describe('KrakenPublicChannel', () => {
	const timestampMock = Date.now();
	let sut;

	beforeEach(() => {
		jest.clearAllMocks();
		WS.mockImplementation(() => mockSocketClient);

		MockDate.set(timestampMock);
	});

	describe('connectSocket', () => {
		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);

		it('should initiate a web socket connection and set the event listeners', () => {
			sut.connectSocket();

			expect(mockSocketClient.on).toHaveBeenCalledTimes(6);
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
			try {
				sut.onConnectionError('mock error');
			} catch (e) {
				expect(sut.connectionErrorHandler).toBe(undefined);
				expect(sut.onConnectionError).toThrow();
			}
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

	describe('onPong', () => {
		beforeEach(() => {
			sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
		});

		it('should call the "onPongHandler" if it is defined', () => {
			const pongEventMock = jest.fn();
			Object.defineProperty(sut, 'onPongHandler', {
				get: jest.fn(() => pongEventMock),
				set: jest.fn(() => pongEventMock)
			});

			sut.onPong('mock pong');

			expect(pongEventMock).toHaveBeenCalledWith('mock pong');
		});

		it('should do nothing by default', () => {
			const pong = sut.onPong('mock pong');

			expect(sut.onPongHandler).toBe(undefined);
			expect(pong).toEqual(undefined);
		});
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
		beforeEach(() => {
			sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
		});
		const heartBeatMock = { event: 'heartbeat' };

		it('should call the heartBeatEvent if it exists', () => {
			const heartbeatEventMock = jest.fn();

			Object.defineProperty(sut, 'heartBeatEvent', {
				get: jest.fn(() => heartbeatEventMock),
				set: jest.fn(() => heartbeatEventMock)
			});

			sut.onHeartBeat(heartBeatMock);

			expect(heartbeatEventMock).toHaveBeenCalledWith({ event: 'heartbeat' });
		});

		it('should do nothing if "heartBeatEvent" is not defined', () => {
			const result = sut.onHeartBeat(heartBeatMock);

			expect(sut.heartBeatEvent).toBe(undefined);
			expect(result).toEqual(undefined);
		});
	});

	describe('onClose', () => {
		beforeEach(() => {
			sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
		});

		it('should call the "onCloseEventHandler" if it is defined', () => {
			const closeEventMock = jest.fn();

			Object.defineProperty(sut, 'onCloseEventHandler', {
				get: jest.fn(() => closeEventMock),
				set: jest.fn(() => closeEventMock)
			});

			sut.onClose('damp it');

			expect(closeEventMock).toHaveBeenCalledWith('damp it');
		});

		it('should do nothing by default', () => {
			const result = sut.onClose('damp it');

			expect(sut.onCloseEvent).toBe(undefined);
			expect(result).toEqual(undefined);
		});
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
		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);

		it('should convert any payload to json on send to the ws server host', () => {
			const payload = { foo: 'bar' };

			sut.emitEvent(payload);

			expect(mockSocketClient.send).toHaveBeenCalledWith(JSON.stringify(payload));
		});
	});

	describe('subscriptionService', () => {
		beforeEach(() => {
			jest.clearAllMocks();

			sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
		});

		it('should handle constructing a payload to send to api', () => {
			const eventEmitter = jest.spyOn(sut, 'emitEvent');

			const mockRequest = 'subscribe';
			const mockChannel = 'ticker';
			const mockPairs = ['ATOM/USD'];

			sut.subscriptionService(mockRequest, mockChannel, mockPairs);

			expect(eventEmitter).toHaveBeenCalledWith({
				event: mockRequest,
				subscription: {
					name: mockChannel
				},
				pair: mockPairs
			});
		});

		it('should handle private subscriptions as well', () => {
			const eventEmitter = jest.spyOn(sut, 'emitEvent');

			const mockRequest = 'subscribe';
			const mockChannel = 'ticker';
			const mockToken = 'abcde';

			sut.subscriptionService(mockRequest, mockChannel, null, { token: mockToken });

			expect(eventEmitter).toHaveBeenCalledWith({
				event: mockRequest,
				subscription: {
					name: mockChannel,
					token: mockToken
				},
			});

		});
	});

	describe('onPublicMessage', () => {
		const publicMessageEventMock = jest.fn();
		const mockTickerMessage = [42, { a: [1, 2], b: [3, 4] }, 'ticker', 'ETH/USD'];

		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);

		it('should parse the incoming data and pass to "publicMessageEvent()"', () => {
			Object.defineProperty(sut, 'publicMessageEvent', {
				get: jest.fn(() => publicMessageEventMock),
				set: jest.fn(() => publicMessageEventMock)
			});

			sut.onPublicMessage(mockTickerMessage);

			expect(publicMessageEventMock).toHaveBeenCalledWith({
				channel_id: 42,
				event_data: { a: [1, 2], b: [3, 4] },
				event_type: 'ticker',
				pair: 'ETH/USD'
			});
		});
	});

	describe('onSubscriptionStatusEvent', () => {
		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);

		const ethTickerSubscription = {
			channelID: datatype.number(),
			channelName: 'ticker',
			event: 'subscriptionStatus',
			pair: 'ETH/USD',
			status: 'subscribed',
			subscription: { name: 'ticker' }
		};
		const atomTickerSubscription  = {
			channelID: datatype.number(),
			channelName: 'ticker',
			event: 'subscriptionStatus',
			pair: 'ATOM/USD',
			status: 'subscribed',
			subscription: { name: 'ticker' }
		};

		it('should add the subscription to the "subscriptions" property', () => {
			sut.onSubscriptionStatusEvent(ethTickerSubscription);
			sut.onSubscriptionStatusEvent(atomTickerSubscription);

			expect(sut.logger).toHaveBeenCalledTimes(2);
			expect(sut.subscriptions).toEqual({
				ticker: {
					'ETH/USD': {
						status: 'subscribed',
						lastUpdated: timestampMock,
						name: 'ticker'
					},
					'ATOM/USD': {
						status: 'subscribed',
						lastUpdated: timestampMock,
						name: 'ticker'
					},
				}
			});

		});
	});
});