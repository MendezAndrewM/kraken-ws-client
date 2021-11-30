const KrakenSocket = require('./KrakenConnection');
const { KRAKEN_WS_ENDPOINT } = require('./constants');
const { nonFunctionError } = require('./utils/errorTypes');

class KrakenPublicChannel extends KrakenSocket {
	constructor(
		wsKey,
		privateKey,
		config
	) {
		super(wsKey, privateKey, config);

		this.socketHost = KRAKEN_WS_ENDPOINT;
		this.subscriptions = {};
		this.systemStatus = { status: 'uninitiated' };
		this.publicMessageEvent = this.logger;
		this.channels = {
			'ticker': this.onSubscribedMessage,
			'ohlc': this.onSubscribedMessage,
			'trade': this.onSubscribedMessage,
			'spread': this.onSubscribedMessage,
			'book': this.onSubscribedMessage
		};
	}

	/**
	 * Parses event message before passing it to the "publicMessageEvent" function
	 * 
	 * @param {any[]} data message data from socket host
	 */
	onSubscribedMessage = (data) => {
		const [ channel_id, event_data, event_type, pair ] = data;
		const parsedData = { channel_id, event_data, event_type, pair };
		return this.publicMessageEvent(parsedData);
	};

	/**
	 * Formats and logs changes to a subscription status
	 * 
	 * @param {Object} data new status event from host
	 */
	onSubscriptionStatusEvent = (data) => {
		const { channelName, pair, status } = data;
		if (status === 'error') throw new Error(data.errorMessage);

		if (!this.subscriptions[channelName]) {
			this.subscriptions[channelName] = {};
		}
		this.subscriptions[channelName][pair] = {
			status,
			lastUpdated: Date.now(),
			...data.subscription
		};

		this.logger(data);
		return data;
	};

	/**
 * Handles subscribing or unsubscribing to channels.
 * 
 * Details for the subscribe/unsubscribe can be found on the Kraken docs-> https://docs.kraken.com/websockets/#message-subscribe
 * 
 * @param {string} subscribe subscribe || unsubscribe
 * @param {string} name name of subscription service. One of: book|ohlc|spread|ticker|trade
 * @param {string[]} pairs Optional - Array of currency pairs. Format of each pair is "A/B", where A and B are ISO 4217-A3 for standardized assets and popular unique symbol if not standardized.
 * @param {object} options subscription object as defined on Kraken's API
 * @param {number} options.depth Optional - depth associated with book subscription in number of levels each side, default 10. Valid Options are: 10, 25, 100, 500, 1000
 * @param {number} options.interval Optional - Time interval associated with ohlc subscription in minutes. Default 1. Valid Interval values: 1|5|15|30|60|240|1440|10080|21600
 */
	subscriptionService = (subscribe, name, pairs, options = {}) => {
		const payload = {
			event: subscribe,
			subscription: {
				name
			}
		};
		if (pairs) {
			payload.pair = pairs;
		}
		Object.keys(options).forEach(option => payload.subscription[option] = options[option]);

		return this.emitEvent(payload);
	};

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onTickerEvent(fn) {
		if (typeof fn === 'function')  this.channels['ticker'] = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onSpreadEvent(fn) {
		if (typeof fn === 'function')  this.channels['ticker'] = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onOhlcEvent(fn) {
		if (typeof fn === 'function')  this.channels['ticker'] = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onTradeEvent(fn) {
		if (typeof fn === 'function')  this.channels['ticker'] = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onBookEvent(fn) {
		if (typeof fn === 'function')  this.channels['ticker'] = fn;
		else throw nonFunctionError(fn);
	}
}

module.exports = KrakenPublicChannel;
