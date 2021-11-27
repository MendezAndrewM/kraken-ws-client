/**
 * Parses JSON data sent from Kraken web socket api and routes it by type
 * 
 * @param {string} message JSON data sent from kraken api
 */
function krakenMessageRouter(message) {
	const data = JSON.parse(message);

	if (data.event) {
		switch (data.event) {
		case 'systemStatus':
			this.onSystemStatusChange(data);
			break;
		case 'pong':
			this.onPong(data);
			break;
		case 'heartbeat':
			this.onHeartBeat(data);
			break;
		case 'subscriptionStatus':
			this.onSubscriptionStatusEvent(data);
			break;
		case 'error':
			throw new Error(message);
		default:
			this.loggingAgent(`
					WARNING: Recieved event type: ${data.event}
					No handler exists for this event type. data:\n
					${data}
					`);
			break;
		}
	} else {
		const channelName = data[data.length - 2];

		switch (channelName) {
		case 'ticker':
			if (this.onTickerEvent) this.onTickerEvent(data);
			else this.onPublicMessage(data);
			break;

		case 'ohlc':
			if (this.onOhlcEvent) this.onOhlcEvent(data);
			else this.onPublicMessage(data);
			break;

		case 'trade':
			if (this.onTradeEvent) this.onTradeEvent(data);
			else this.onPublicEvent(data);
			break;

		case 'spread':
			if (this.onSpreadEvent) this.onSpreadEvent(data);
			else this.onPublicMessage(data);
			break;

		case 'book':
			if (this.onBookEvent) this.onBookEvent(data);
			else this.onPublicMessage(data);
			break;

		case 'openOrders':
			if (this.onOpenOrdersEvent) this.onOpenOrdersEvent(data);
			else throw new Error('Forbidden');
			break;

		case 'ownTrades':
			if (this.onOwnTradesEvent) this.onOwnTradesEvent(data);
			else throw new Error('Forbidden');
			break;

		default:
			this.loggingAgent(data);
			throw new Error('Channel Name or event type not recognized. Check output above for details');
		}
	}
}

module.exports = krakenMessageRouter;