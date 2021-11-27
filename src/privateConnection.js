const KrakenPub = require('./publicConnection');
const { KRAKEN_WS_AUTH_ENDPOINT } = require('./constants');
const { nonFunctionError } = require('./utils/errorTypes');

class KrakenPrivateChannel extends KrakenPub {
	#WS_TOKEN;
	#TOKEN_EXPIRATION_TIME;

	constructor(wsKey, privateKey, config) {
		super(wsKey, privateKey, config);

		this.socketHost = KRAKEN_WS_AUTH_ENDPOINT;
	}

	/**
	 * Fetches and sets the WS token required to send private messages to Kraken
	 */
	async getWsToken() {
		let fetchResponse;

		try {
			fetchResponse = await this.api('GetWebSocketsToken');
		} catch (err) {
			throw err;
		}
		const { error, result: { token, expires } } = fetchResponse;

		if (error.length) throw new Error(error);

		this.#WS_TOKEN = token;
		this.#TOKEN_EXPIRATION_TIME = Date.now() + (expires * 1000);
	}

	/**
	 * Gets a new WS Token if the current one is invalid
	 */
	stayFresh() {
		if (this.isFresh) {
			return;
		} else {
			return this.getWsToken();
		}
	}

	/**
	 * Executes when a "OpenOrders" event is recieved from host
	 * Logs message be default. This can be configured by defining the "onOpenOrdersHandler" property.
	 * 
	 * Details on message format can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-openOrders
	 * @param {any} data 
	 */ /* istanbul ignore next: only logs by default */
	onOpenOrdersEvent(data) {
		this.logger(data);
	}

	/**
	 * Executes when a "ownTrades" event is recieved from host
	 * Logs message be default. This can be configured by defining the "onOwnTradesHandler" property.
	 * 
	 * Details on message format can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-ownTrades
	 * @param {any} data 
	 */ /* istanbul ignore next: only logs by default */
	onOwnTradesEvent(data) {
		this.logger(data);
	}

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
	privateSubscriptionService(subscribe, name, options = {}) {
		this.stayFresh();
		return this.subscriptionService(subscribe, name, null, { ...options, token: this.#WS_TOKEN });
	}

	/**
	 * Generic function to create order of any type
	 * req/res details can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-addOrder
	 * 
	 * @param {object} options 
	 * @param {string} options.ordertype Order type - market|limit|stop-loss|take-profit|stop-loss-limit|take-profit-limit|settle-position
	 * @param {string} options.type Side, buy or sell
	 * @param {string} options.pair Currency pair
	 * @param {float} options.price Optional dependent on order type - order price
	 * @param {float} options.price2 Optional dependent on order type - order secondary price
	 * @param {float} options.volume Order volume in lots
	 * @param {float} options.leverage amount of leverage desired (optional; default = none)
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
	addOrder(options, reqid) {
		this.stayFresh();
		const payload = {
			event: 'addOrder',
			token: this.#WS_TOKEN,
			reqid
		};
		Object.keys(options).forEach(option => payload[option] = options[option]);
		this.emitEvent(payload);
	}
	// TODO: Create function for market order
	// TODO: Create function for limit order
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
	cancelOrder(txid, reqid) {
		this.stayFresh();
		this.emitEvent({
			event: 'cancelOrder',
			token: this.#WS_TOKEN,
			txid,
			reqid
		});
	}

	/**
	 * Cancel all open orders. Includes partially-filled orders.
	 * req/res details can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-cancelAll
	 * 
	 * @param {number} reqid Optional - client originated requestID sent as acknowledgment in the message response
	 */
	cancelAllOrders(reqid) {
		this.stayFresh();
		this.emitEvent({
			event: 'cancelAll',
			token: this.#WS_TOKEN,
			reqid
		});
	}

	/**
	 *  Shut-off mechanism to protect the client from network malfunction, extreme latency or unexpected matching engine downtime.
	 *  Details can be found in the Kraken docs -> https://docs.kraken.com/websockets/#message-cancelAllOrdersAfter
	 * 
	 * @param {number} timeout Timeout specified in seconds. 0 to disable the timer.
	 */
	cancelAllOrdersAfter(timeout) {
		this.stayFresh();
		const payload = { event: 'cancelAllOrdersAfter', token: this.#WS_TOKEN, timeout };
		this.emitEvent(payload);
	}

	get isFresh() {
		return !!this.#WS_TOKEN && Date.now() < this.#TOKEN_EXPIRATION_TIME;
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onOpenOrdersHandler(fn) {
		if (typeof fn === 'function') this.onOpenOrdersEvent = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onOwnTradesHandler(fn) {
		if (typeof fn === 'function') this.onOwnTradesEvent = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {string} token 
	 */ /* istanbul ignore next */
	setWsToken(token) {
		this.#WS_TOKEN = token;
	}
}

module.exports = KrakenPrivateChannel;
