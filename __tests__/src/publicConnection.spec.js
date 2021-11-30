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

	describe('subscriptionService', () => {
		beforeEach(() => {
			jest.clearAllMocks();

			sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);
		});

		it('should handle constructing a payload to send to api', () => {
			const eventEmitter = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
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
			const eventEmitter = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);

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

	describe('onSubscribedMessage', () => {
		const onSubscribedMessageMock = jest.fn();
		const mockTickerMessage = [42, { a: [1, 2], b: [3, 4] }, 'ticker', 'ETH/USD'];

		sut = new KrakenPublicChannel(mockApiKey, mockPrivateKey, mockConfig);

		it('should parse the incoming data and pass to "publicMessageEvent()"', () => {
			Object.defineProperty(sut, 'publicMessageEvent', {
				get: jest.fn(() => onSubscribedMessageMock),
				set: jest.fn(() => onSubscribedMessageMock)
			});

			sut.onSubscribedMessage(mockTickerMessage);

			expect(onSubscribedMessageMock).toHaveBeenCalledWith({
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
		const errorStatus = {
			status: 'error',
			errorMessage: 'mock error'
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

		it('should throw if an error status is recieved', () => {
			try {
				sut.onSubscriptionStatusEvent(errorStatus);
			} catch (err) {
				expect(sut.onSubscriptionStatusEvent).toThrow();
				expect(err).toEqual(Error('mock error'));
			}
		});
	});
});