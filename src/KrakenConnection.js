const Ws = require('ws');
const KrakenClient = require('kraken-api');

const { KRAKEN_WS_ENDPOINT } = require('./constants');
const { nonFunctionError } = require('./utils/errorTypes');

class KrakenSocket extends KrakenClient {
	#REFRESH_INTERVAL;
	#client;

	constructor(
		wsKey,
		privateKey,
		config
	) {
		super(wsKey, privateKey);

		this.logger = config.logger;
		this.socketHost = KRAKEN_WS_ENDPOINT;
		this.systemStatus = { status: 'uninitiated' };
		this.channels = {};
		this.onEvent = {
			'systemStatus': this.onSystemStatusChange,
			'pong': this.onPong,
			'heartbeat': this.onHeartBeat,
			'error': this.onUnexpectedResponse,
		};
	}

	/* istanbul ignore next: applies to private connections only */
	#initConnection = async () => {
		if (this.stayFresh) await this.stayFresh();
		this.onOpen();
	};

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

	/**
	 * Runs on successful conenction to websocket host
	 * By default, simply logs that the connection has been established.
	 */
	onOpen() {
		this.logger(`New socket connection established for host: ${this.socketHost}`);
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
	 * Formats and logs changes to the connection status
	 * 
	 * @param {Object} data new status event from host
	 */
	onSystemStatusChange = ({ connectionID, status, version }) => {
		const timestamp = Date.now();
		this.systemStatus = {
			connectionID,
			status,
			version,
			timestamp,
		};
		const log = { 'System Status Event': this.systemStatus };

		this.logger(log);
	};

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

	onMessage = (message) => {
		const data = JSON.parse(message);

		if (data.event) {
			return this.onEvent[data.event](data);
		} else {
			const channelName = data[data.length - 2];

			return this.channels[channelName]
				? this.channels[channelName](data)
				: this.logger(data);
		}
	};

	/* istanbul ignore next: dependant on other factors */
	#onClose = (data) => {
		if (this.#REFRESH_INTERVAL) clearInterval(this.#REFRESH_INTERVAL);
		if (this.onCloseEventHandler) return this.onCloseEventHandler(data);
		return;
	};

	/* istanbul ignore next: does not need unit test */
	onUnexpectedResponse(data) {
		throw new Error(data);
	}

	/**
	 * Connects to web socket host and sets the event listeners.
	 */
	connectSocket() {
		const client = new Ws(this.socketHost);

		client.on('open', this.#initConnection);
		client.on('message', this.onMessage);
		client.on('pong', this.onPong);
		client.on('unexpected-response', this.onUnexpectedResponse);
		client.on('error', this.onConnectionError);
		client.on('close', this.#onClose);

		this.#client = client;
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
	set onCloseEvent(fn) {
		if (typeof fn === 'function') this.onCloseEventHandler = fn;
		else throw nonFunctionError(fn);
	}
}

module.exports = KrakenSocket;
