const KrakenSocket = require('./KrakenConnection');
const { KRAKEN_WS_AUTH_ENDPOINT } = require('./constants');
const { nonFunctionError } = require('./utils/errorTypes');

class KrakenPrivateChannel extends KrakenSocket {
	#WS_TOKEN;
	#TOKEN_EXPIRATION_TIME;
	#REFRESH_INTERVAL;

	constructor(wsKey, privateKey, config) {
		super(wsKey, privateKey, config);

		this.socketHost = KRAKEN_WS_AUTH_ENDPOINT;
		this.subscriptions = {};
		this.channels = {
			'openOrders': this.logger,
			'ownTrades': this.logger
		};
		this.onEvent['subscriptionStatus'] = this.onSubscriptionStatusEvent,
		this.onEvent['addOrderStatus'] = this.logger;
		this.onEvent['cancelOrderStatus'] = this.logger;
		this.onEvent['cancelAllStatus'] = this.logger;
		this.onEvent['cancelAllOrdersAfterStatus'] = this.logger;
	}

	/**
	 * Fetches and sets the WS token required to send private messages to Kraken
	 * @returns {number} seconds until token expires
	 */
	getWsToken = async () => {
		let fetchResponse;

		try {
			fetchResponse = await this.api('GetWebSocketsToken');
		} catch (err) {
			throw err;
		}
		const { error, result: { token, expires } } = fetchResponse;

		if (error.length) throw new Error(error);

		const milisecondsUntilExpiration = expires * 1000;
		this.#WS_TOKEN = token;
		this.#TOKEN_EXPIRATION_TIME = Date.now() + milisecondsUntilExpiration;
		return milisecondsUntilExpiration;
	};

	/**
	 * Gets a new WS Token if the current one is invalid
	 */
	stayFresh = async () => {
		if (this.isFresh) {
			return;
		} else {
			const refreshTimer = await this.getWsToken();
			this.#REFRESH_INTERVAL = setInterval(this.getWsToken, refreshTimer-15000);
		}
	};

	/**
	 * Handles subscribing or unsubscribing to channels.
	 * Details for the subscribe/unsubscribe can be found on the Kraken docs-> https://docs.kraken.com/websockets/#message-subscribe
	 * 
	 * @param {string} subscribe subscribe || unsubscribe
	 * @param {string} name name of subscription service. One of: openOrders|ownTrades
	 * @param {object} options subscription object as defined on Kraken's API
	 * @param {boolean} options.ratecounter Optional - whether to send rate-limit counter in updates (supported only for openOrders subscriptions; default = false)
	 * @param {boolean} options.snapshot Optional - whether to send historical feed data snapshot upon subscription (supported only for ownTrades subscriptions; default = true)
	 * 
	 * @fires websocket.send() sends the formated payload to the Kraken websocket service
	 */
	subscriptionService = async (subscribe, name, options = {}) => {
		await this.stayFresh();

		const payload = {
			event: subscribe,
			subscription: {
				name,
				token: this.#WS_TOKEN
			}
		};
		Object.keys(options).forEach(option => payload.subscription[option] = options[option]);

		return this.emitEvent(payload);
	};

	/**
	 * Formats and logs changes to a subscription status
	 * 
	 * @param {Object} data new status event from host
	 */
	onSubscriptionStatusEvent = (data) => {
		const { channelName, status } = data;
		if (status === 'error') throw new Error(data.errorMessage);

		this.subscriptions[channelName] = {
			status,
			lastUpdated: Date.now(),
			...data.subscription
		};

		this.logger(data);
		return data;
	};

	/**
	 * Generic function to create order of any type
	 * req/res details can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-addOrder
	 * more info on what each options property is used for can be found in the REST api docs -> https://docs.kraken.com/rest/#operation/addOrder
	 * 
	 * @param {object} options 
	 * @param {string} options.ordertype Order type - market|limit|stop-loss|take-profit|stop-loss-limit|take-profit-limit|settle-position
	 * @param {string} options.type Side, buy or sell
	 * @param {string} options.pair Currency pair
	 * @param {string} options.price Optional dependent on order type - order price
	 * @param {string} options.price2 Optional dependent on order type - order secondary price
	 * @param {string} options.volume Order volume in lots
	 * @param {string} options.leverage amount of leverage desired (optional; default = none)
	 * @param {string} options.oflags Optional - comma delimited list of order flags. viqc = volume in quote currency (not currently available), fcib = prefer fee in base currency, fciq = prefer fee in quote currency, nompp = no market price protection, post = post only order (available when ordertype = limit)
	 * @param {string} options.starttm Optional - scheduled start time. 0 = now (default) +<n> = schedule start time <n> seconds from now <n> = unix timestamp of start time
	 * @param {string} options.expiretm Optional - expiration time. 0 = no expiration (default) +<n> = expire <n> seconds from now <n> = unix timestamp of expiration time
	 * @param {string} options.deadline Optional - RFC3339 timestamp (e.g. 2021-04-01T00:18:45Z) after which matching engine should reject new order request, in presence of latency or order queueing. min now() + 5 seconds, max now() + 90 seconds. Defaults to 90 seconds if not specified.
	 * @param {string} options.userref Optional - user reference ID (should be an integer in quotes)
	 * @param {string} options.validate Optional - validate inputs only; do not submit order
	 * @param {string} options.close[ordertype] Optional - close order type.
	 * @param {string} options.close[price] Optional - close order price.
	 * @param {string} options.close[price2] Optional - close order secondary price.
	 * @param {string} options.timeinforce Optional - time in force. Supported values include GTC (good-til-cancelled; default), IOC (immediate-or-cancel), GTD (good-til-date; expiretm must be specified).
	 * @param {number} reqid Optional - client originated requestID sent as acknowledgment in the message response
	 */
	addOrder = async (options, reqid) => {
		await this.stayFresh();
		const payload = {
			event: 'addOrder',
			token: this.#WS_TOKEN,
			reqid
		};
		Object.keys(options).forEach(option => payload[option] = options[option]);
		this.emitEvent(payload);
	};

	// TODO: Create function for stop-loss order
	// TODO: Create function for take-profit order
	// TODO: Create function for stop-loss-limit order
	// TODO: Create function for take-profit-limit order
	// TODO: Create function for settle possition order

	/**
	 * Cancels order or list of orders
	 * req/res details can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-cancelOrder
	 * 
	 * @param {string[]} txid Array of order IDs to be canceled. These can be user reference IDs.
	 * @param {number} reqid Optional - client originated requestID sent as acknowledgment in the message response
	 */
	cancelOrder = async (txid, reqid) => {
		await this.stayFresh();
		this.emitEvent({
			event: 'cancelOrder',
			token: this.#WS_TOKEN,
			txid,
			reqid
		});
	};

	/**
	 * Cancel all open orders. Includes partially-filled orders.
	 * req/res details can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-cancelAll
	 * 
	 * @param {number} reqid Optional - client originated requestID sent as acknowledgment in the message response
	 */
	cancelAllOrders = async (reqid) => {
		await this.stayFresh();
		this.emitEvent({
			event: 'cancelAll',
			token: this.#WS_TOKEN,
			reqid
		});
	};

	/**
	 *  Shut-off mechanism to protect the client from network malfunction, extreme latency or unexpected matching engine downtime.
	 *  Details can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-cancelAllOrdersAfter
	 * 
	 * @param {number} timeout Timeout specified in seconds. 0 to disable the timer.
	 */
	cancelAllOrdersAfter = async (timeout) => {
		await this.stayFresh();
		const payload = { event: 'cancelAllOrdersAfter', token: this.#WS_TOKEN, timeout };
		this.emitEvent(payload);
	};

	get isFresh() {
		return !!this.#WS_TOKEN && Date.now() < this.#TOKEN_EXPIRATION_TIME;
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onOpenOrdersEvent(fn) {
		if (typeof fn === 'function') this.channels['openOrders'] = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onOwnTradesEvent(fn) {
		if (typeof fn === 'function') this.channels['ownTrades'] = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * Used for debugging
	 * @param {string} token 
	 */ /* istanbul ignore next */
	set wsToken(token) {
		this.#WS_TOKEN = token;
	}
}

module.exports = KrakenPrivateChannel;
