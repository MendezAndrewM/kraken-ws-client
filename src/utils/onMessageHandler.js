/**
 * Parses JSON data sent from Kraken web socket api and routes it by type
 * 
 * @param {string} message JSON data sent from kraken api
 */
export default function onMessage(message) {
	const data = JSON.parse(message);
	if (data.event) {
		switch (data.event) {
			case 'systemStatus':
				this.onSystemStatusChange(data);
				break;
			case 'pong':
				this.onPongEvent(data);
				break;
			case 'heartbeat':
				this.onHeartBeatEvent(data);
				break;
			case 'subscriptionStatus':
				this.onSubscriptionStatusEvent(data);
				break;
			case 'error':
				throw new Error(message);
			default:
				console.log(`
					WARNING: Recieved event type: ${data.event}
					No handler exists for this event type. data:\n
					${data}
					`);
				break;
		}
	} else {
		const channelName = data[data.length - 2];

		if (['ticker', 'ohlc', 'trade', 'spread', 'book'].includes(channelName)) {
			return this.onPublicEvent(data);
		}

		switch (channelName) {
			case 'openOrders':
				this.onOpenOrdersEvent(data);
				break;
			case 'ownTrades':
				this.onOwnTradesEvent(data);
				break;
			default:
				console.log(data);
				throw new Error("Channel Name or event type not recognized. Check output above for details");
		}
	}
}