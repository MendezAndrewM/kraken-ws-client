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
			const result = sut.stayFresh();

			expect(result).toBe(undefined);
			expect(getTokenMock).not.toHaveBeenCalled();
		});

		it('should call "getWsToken" if a valid token does not exist', () => {
			const getTokenMock = jest.spyOn(sut, 'getWsToken');
			Object.defineProperty(sut, 'isFresh', {
				get: jest.fn(() => false),
			});
			sut.stayFresh();

			expect(getTokenMock).toHaveBeenCalledTimes(1);
		});
	});

	describe('privateSubscriptionService', () => {
		it('should add the socket token to a subscription call', () => {
			const subscriptionServiceMock = jest.spyOn(sut, 'subscriptionService');
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => sut.setWsToken('secret'));

			sut.privateSubscriptionService('subscribe', 'ownTrades');

			expect(stayFreshMock).toHaveBeenCalledTimes(1);
			expect(subscriptionServiceMock).toHaveBeenCalledWith(
				'subscribe',
				'ownTrades',
				null,
				{ token: 'secret' }
			);
		});
	});

	describe('addOrder', () => {
		it('literally just formats the request and sends to the socket host', () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => sut.setWsToken('secret'));
			const reqId = 42;
			const mockRequest = {
				type: 'buy',
				pair: 'ATOM/USD',
				price: 1234.56789
			};
			sut.addOrder(mockRequest, reqId);

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
		it('is not really even worth testing', () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => sut.setWsToken('secret'));
			const mockOrders = ['mock-order-id'];
			const mockReqId = 42;

			sut.cancelOrder(mockOrders, mockReqId);

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
		it('sends a request to cancel all orders', () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => sut.setWsToken('secret'));
			const mockReqId = 42;

			sut.cancelAllOrders(mockReqId);

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
		it('sends a request to cancal all orders on a specified timeout', () => {
			const eventEmiterMock = jest.spyOn(sut, 'emitEvent').mockImplementation(jest.fn);
			const stayFreshMock = jest.spyOn(sut, 'stayFresh')
				.mockImplementationOnce(() => sut.setWsToken('secret'));
			const mockTimeout = 30000;

			sut.cancelAllOrdersAfter(mockTimeout);

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
