const KrakenPrivateChannel = require('../../src/privateConnection');

jest.mock('kraken-api');

const mockApiKey = 'secret';
const mockPrivateKey = 'supersecret';
const mockConfig = {
	logger: jest.fn()
};

describe('KrakenPrivateChannel', () => {
	let sut;

	beforeEach(() => {
		jest.clearAllMocks();
		sut = new KrakenPrivateChannel(mockApiKey, mockPrivateKey, mockConfig);
	});

	describe('getWsToken', () => {
		it('should fetch and store a web socket auth token and expiration timer', async () => {
			const mockApiResponse = {
				error: [],
				result: { token:  'secret', expires: 30000 }
			};
			sut.api.mockImplementationOnce(() => mockApiResponse);

			expect(sut.isFresh).toBe(false);
			await sut.getWsToken();
			expect(sut.isFresh).toBe(true);
		});

		it('should throw if the kraken server responds with an error', async () => {
			const mockApiResponse = {
				error: ['mock kraken error'],
				result: {}
			};
			sut.api.mockImplementationOnce(() => mockApiResponse);
			try {
				await sut.getWsToken();
			} catch (err) {
				expect(err).toEqual(Error('mock kraken error'));
			}
			expect(sut.isFresh).toBe(false);
		});

		it('should throw an erro if the api service fails', async () => {
			sut.api.mockImplementationOnce(() => { throw new Error('mock error'); });

			try {
				await sut.getWsToken();
			} catch (err) {
				expect(err).toEqual(Error('mock error'));
			}
			expect(sut.isFresh).toBe(false);
		});
	});

	describe('stayFresh', () => {
		it('should do nothing if a valid websocket token already exists', () => {
			const getTokenMock = jest.spyOn(sut, 'getWsToken');
			Object.defineProperty(sut, 'isFresh', {
				get: jest.fn(() => true),
			});
			sut.stayFresh();

			expect(getTokenMock).not.toHaveBeenCalled();
		});

		it('should call "getWsToken" if a valid token does not exist', async () => {
			const getTokenMock = jest.spyOn(sut, 'getWsToken').mockImplementation(jest.fn);
			Object.defineProperty(sut, 'isFresh', {
				get: jest.fn(() => false),
			});
			await sut.stayFresh();

			expect(getTokenMock).toHaveBeenCalledTimes(1);
		});

		it('should set an interval to remain fresh', async () => {
			const getTokenMock = jest.spyOn(sut, 'getWsToken').mockImplementation(jest.fn);
			const intervalMock = jest.spyOn(global, 'setInterval').mockImplementation(jest.fn);
			Object.defineProperty(sut, 'isFresh', {
				get: jest.fn(() => false),
			});
			await sut.stayFresh();

			expect(getTokenMock).toHaveBeenCalledTimes(1);
			expect(intervalMock).toHaveBeenCalled();
		});
	});

	describe('subscriptionService', () => {
		it('should add the socket token to a subscription call', async () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => { sut.wsToken = 'secret'; });

			await sut.subscriptionService('subscribe', 'ownTrades');

			expect(stayFreshMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledWith({
				'event': 'subscribe',
				'subscription': {
					'name': 'ownTrades',
					'token': 'secret'
				}
			});
		});
	});

	describe('onSubscriptionStatusEvent', () => {
		sut = new KrakenPrivateChannel(mockApiKey, mockPrivateKey, mockConfig);


		const errorStatus = {
			status: 'error',
			errorMessage: 'mock error'
		};

		it('should add the subscription to the "subscriptions" property', () => {
			sut.onSubscriptionStatusEvent(ethTickerSubscription);s

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

	describe('addOrder', () => {
		it('literally just formats the request and sends to the socket host', async () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => { sut.wsToken = 'secret'; });
			const reqId = 42;
			const mockRequest = {
				type: 'buy',
				pair: 'ATOM/USD',
				price: 1234.56789
			};
			await sut.addOrder(mockRequest, reqId);

			expect(stayFreshMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledWith({
				event: 'addOrder',
				token: 'secret',
				reqid: 42,
				type: 'buy',
				pair: 'ATOM/USD',
				price: 1234.56789
			});
		});
	});

	describe('cancelOrder', () => {
		it('is not really even worth testing', async () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => { sut.wsToken = 'secret'; });
			const mockOrders = ['mock-order-id'];
			const mockReqId = 42;

			await sut.cancelOrder(mockOrders, mockReqId);

			expect(stayFreshMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledWith({
				event: 'cancelOrder',
				token: 'secret',
				txid: mockOrders,
				reqid: mockReqId
			});
		});
	});

	describe('cancelAllOrders', () => {
		it('sends a request to cancel all orders', async () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => { sut.wsToken = 'secret'; });
			const mockReqId = 42;

			await sut.cancelAllOrders(mockReqId);

			expect(stayFreshMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledWith({
				event: 'cancelAll',
				token: 'secret',
				reqid: mockReqId
			});
		});
	});

	describe('cancelAllOrdersAfter', () => {
		it('sends a request to cancal all orders on a specified timeout', async () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => { sut.wsToken = 'secret'; });
			const mockTimeout = 30000;

			await sut.cancelAllOrdersAfter(mockTimeout);

			expect(stayFreshMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledTimes(1);
			expect(eventEmiterMock).toHaveBeenCalledWith({
				event: 'cancelAllOrdersAfter',
				token: 'secret',
				timeout: mockTimeout
			});
		});
	});
});
