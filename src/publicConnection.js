const ws = require('ws');
const Kraken = require('kraken-api');

const krakenRouter = require("./utils/onMessageHandler");
const { KRAKEN_WS_ENDPOINT } = require('../constants');

const doNothing = () => null;
class KrakenPublicChannel extends Kraken {
	#onMessage = krakenRouter;
  #client;

  constructor(
			wsKey,
			privateKey,
			config = {
				afterOpen=null,
				apiType=null,
				loggingAgent=nullLogger,
			}
	) {
    super(wsKey, privateKey);

    this.loggingAgent = config.loggingAgent;
    this.afterOpen = config.afterOpen;
		this.apiType = config.apiType

    this.subscriptions = { private: {} }
		this.systemStatus = { status: "uninitiated" }
		
    this.onHeartBeatEventCallBack = false;
		this.connectionErrorCallback = null;
		this.onPongCallback = null;
		this.publicEventCallbacks = []; // ??? - Probably the wrong way to do this
		this.onClose = doNothing;
  }

	/**
	 * Optional wrapper for customizable error handling. Thows the error
	 * if a callback function is not provided.
	 * 
	 * @param {Error} error Connection error from Kraken API 
	 * @param {Function} callback Customizable
	 */
  #onConnectionError(error) {
    if (this.connectionErrorCallback) return callback(error);
    else throw error;
  }

  onOpen() { // Customize or Configure
    if (afterOpen = "websocket") {}
  }

  #onPongEvent(data) {
    if (this.onPongCallback) return callback(data);
    else return;
  }

  onSystemStatusChange({ connectionID, status, version }) {
    const timestamp = Date.now();
    this.systemStatus = {
      connectionID,
      status,
      version,
      timestamp,
    }
    const log = { 'System Status Changed': this.systemStatus }

    this.loggingAgent(log);
  }

  onSubscriptionStatusEvent(data) {
    this.showLogs && console.log(data);
    const { channelName, pair, status } = data;

    if (!this.subscriptions.hasOwnProperty(channelName)) {
      this.subscriptions[channelName] = {};
    }
    this.subscriptions[channelName][pair] = {
      status,
      lastUpdated: Date.now(),
      ...data.subscription
    }
    
    this.loggingAgent(data);
  }

  onHeartBeatEvent(event) {
    if (this.showHeartbeat) return onHeartBeatEventCallBack(event);
    else return;
  }

  onPublicEvent(data) {
		//TODO: Figure out how to broadcast these by type
    const [ channel_id, event_data, event_type, pair ] = data;
    const parsedData = { channel_id, event_data, event_type, pair };
    this.publicEventCallbacks.forEach(callback => callback(parsedData));
  }

  onClose(data) {
    if (this.onCloseEvent) this.onCloseEvent(data);
  }

  connectSocket() {
    const client = new ws(KRAKEN_WS_ENDPOINT);

    client.on('open', () => this.onOpen());
    client.on('message', (message) => this.#onMessage(message));
    client.on('pong', (data) => this.#onPongEvent(data.toString()));
    client.on('unexpected-response', (data) => { throw new Error(data) });
    client.on('error', (err) => this.#onConnectionError(err));
    client.on('close', (data) => this.onClose(data));

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
 * 
 * @emits websocket.send() sends the formated payload to the Kraken websocket service
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

    return this.#client.send(JSON.stringify(payload));
  }

  pingServer(reqid) {
    const ping = JSON.stringify({ event: 'ping', reqid });
    this.#client.send(ping);
  }

	/**
	 * send data straight to the kraken api. See Krakens documentaion for formatting
	 * 
	 * @param {object} data see kraken docs for formatting
	 */
  emitEvent(data) {
    this.#client.send(JSON.stringify(data));
  }

	set onHeartBeatEvent(fn) {
		this.onHeartBeatEventCallBack = fn;
	}

	set onConnectionErrorEvent(fn) {
		this.connectionErrorCallback = fn;
	}

	set onPongEvent(fn) {
		this.onPongCallback = fn;
	}

	set onPublicEvent(arr) {
		this.publicEventCallbacks = arr;
	}

	set onCloseEvent(fn) {
		this.onClose = fn;
	}
}

module.exports = KrakenPublicChannel;