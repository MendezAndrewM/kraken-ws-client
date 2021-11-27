const Ws = require('ws');
const Kraken = require('kraken-api');

const krakenRouter = require('./utils/onMessageHandler');
const { KRAKEN_WS_ENDPOINT } = require('./constants');
const { nonFunctionError } = require('./utils/errorTypes');

class KrakenPublicChannel extends Kraken {
	#onMessage = krakenRouter.bind(this);
	#client;

	constructor(
		wsKey,
		privateKey,
		config
	) {
		super(wsKey, privateKey);

		this.logger = config.logger;
		this.apiType = config.apiType;
		this.socketHost = KRAKEN_WS_ENDPOINT;
		this.subscriptions = {};
		this.systemStatus = { status: 'uninitiated' };
		this.publicMessageEvent = this.logger;
	}

	/**
	 * Optional wrapper for customizable error handling. Thows the error
	 * if a callback function is not provided.
	 * 
	 * @param {Error} error Connection error from Kraken API 
	 * @param {Function} callback Customizable
	 */
	onConnectionError(error) {
		if (this.connectionErrorHandler) return this.connectionErrorHandler(error);
		else throw error;
	}

	// TODO: Settup controller
	onOpen() {
		this.logger('Connected!');
	}

	/**
	 * Executes when a pong event is recieved.
	 * Does nothing by default. This can be configured by defining the "onPongHandler"
	 * property
	 * 
	 * @param {any} data Optional - never sent from Kraken API
	 */
	onPong(data) {
		if (this.onPongHandler) return this.onPongHandler(data);
		else return;
	}

	/**
	 * Parses event message before passing it to the "publicMessageEvent" function
	 * 
	 * @param {any[]} data message data from socket host
	 */
	onPublicMessage(data) {
		const [ channel_id, event_data, event_type, pair ] = data;
		const parsedData = { channel_id, event_data, event_type, pair };
		return this.publicMessageEvent(parsedData);
	}

	/**
	 * Formats and logs changes to the connection status
	 * 
	 * @param {Object} data new status event from host
	 */
	onSystemStatusChange({ connectionID, status, version }) {
		const timestamp = Date.now();
		this.systemStatus = {
			connectionID,
			status,
			version,
			timestamp,
		};
		const log = { 'System Status Event': this.systemStatus };

		this.logger(log);
	}

	/**
	 * Formats and logs changes to a subscription status
	 * 
	 * @param {Object} data new status event from host
	 */
	onSubscriptionStatusEvent(data) {
		const { channelName, pair, status } = data;

		if (!this.subscriptions[channelName]) {
			this.subscriptions[channelName] = {};
		}
		this.subscriptions[channelName][pair] = {
			status,
			lastUpdated: Date.now(),
			...data.subscription
		};

		this.logger(data);
	}

	/**
	 * Executes when a heartBeat event is sent from the socket host.
	 * Does nothing by default. This can be configured by defining the "heartBeatEvent"
	 * property
	 * 
	 * @param {Object} event { event: 'heartbeat' }
	 */
	onHeartBeat(event) {
		if (this.heartBeatEvent) return this.heartBeatEvent(event);
		else return;
	}

	/**
	 * Executes when the socket connection is closed.
	 * Does nothing by default. This can be configured by defining the "onCloseEventHandler"
	 * property
	 * 
	 * @param {any} data Optional - never sent from Kraken API
	 */
	onClose(data) {
		if (this.onCloseEventHandler) return this.onCloseEventHandler(data);
		return;
	}

	/* istanbul ignore next */
	onUnexpectedResponse(data) {
		throw new Error(data);
	}

	/**
	 * Connects to web socket host and sets the event listeners.
	 */
	connectSocket() {
		const client = new Ws(this.socketHost);

		client.on('open', this.onOpen);
		client.on('message', this.#onMessage);
		client.on('pong', this.onPong);
		client.on('unexpected-response', this.onUnexpectedResponse);
		client.on('error', this.onConnectionError);
		client.on('close', this.onClose);

		this.#client = client;
	}

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
	async subscriptionService(subscribe, name, pairs, options = {}) {
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
	}

	pingServer(reqid) {
		this.emitEvent({ event: 'ping', reqid });
	}

	/**
	 * send data to the kraken api. See Krakens documentaion for formatting 
	 * @param {object} data see kraken docs for formatting
	 * @emits websocket.send() sends the formated payload to the Kraken websocket service
	 */
	emitEvent(data) {
		this.#client.send(JSON.stringify(data));
	}

	/* istanbul ignore next */
	disconnectSocket() {
		this.#client.close();
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onOpenEvent(fn) {
		if (typeof fn === 'function') this.onOpen = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onHeartBeatEvent(fn) {
		if (typeof fn === 'function')  this.heartBeatEvent = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set connectionErrorHandler(fn) {
		if (typeof fn === 'function')  this.connectionErrorHandler = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onPongEvent(fn) {
		if (typeof fn === 'function')  this.onPongHandler = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onPublicEvent(fn) {
		if (typeof fn === 'function')  this.publicMessageEvent = fn;
		else throw nonFunctionError(fn);
	}

	/**
	 * @param {() => any} fn 
	 */ /* istanbul ignore next */
	set onCloseEvent(fn) {
		if (typeof fn === 'function') this.onCloseEventHandler = fn;
		else throw nonFunctionError(fn);
	}
}

module.exports = KrakenPublicChannel;
