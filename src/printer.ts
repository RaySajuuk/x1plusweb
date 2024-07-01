import WebSocketAsPromised from 'websocket-as-promised';

class PrinterConnection extends EventTarget {
    _event(name, params) {
        const event = new Event(name);
        Object.assign(event, params);
        this.dispatchEvent(event);
    }

    async connect(ip, password) {
        if (this.connected) {
            await this.disconnect();
        }
        /* ws://${location.host}/ws */
        const wsPath = `ws://${ip}/ws`;
        console.log(`PrinterConnection: WebSocket path ${wsPath}`);
        this.wsp = new WebSocketAsPromised(wsPath, {
            packMessage: data => JSON.stringify(data),
            unpackMessage: data => JSON.parse(data),
            attachRequestId: (data, requestId) => Object.assign({id: requestId}, data),
            extractRequestId: data => data && data.id,
        });

        console.log("PrinterConnection: connecting to WebSocket");
        this._event('connectingProgress', { 'progress': 'Connecting to WebSocket' });
        this.wsp.onError.addListener(event => { this.disconnect() });
        this.wsp.onClose.addListener(event => { this.disconnect() });
        try {
            await this.wsp.open();
        } catch (e) {
            console.log(`PrinterConnection: ${e}`);
            throw e; 
        }
        console.log("PrinterConnection: waiting for hello");
        await this.wsp.waitUnpackedMessage(data => data.method == 'hello' );
        
        console.log("PrinterConnection: authenticating");
        this._event('connectingProgress', { 'progress': 'Authenticating' });
        const authResp = await this.wsp.sendRequest({"method": "auth", "params": {"password": password}});
        if (authResp.error) {
            console.log(`PrinterConnection: authentication failed: ${authResp.error}`);
            this._event('connectionFailed', { 'error': authResp.error });
            await this.wsp.close();
            this.wsp = null;
            return;
        }
        this.connected = true;
        this.host = ip;
        console.log('PrinterConnection: connected');
        this._event('connected', {});
    }
    
    async disconnect() {
        if (!this.connected) {
            return;
        }
        if (this.wsp) {
            await this.wsp.close();
            this.wsp.removeAllListeners();
            this.wsp = null;
        }
        this.connected = false;
        this.dispatchEvent(new Event('disconnected'));
    }
}

const printerConnection = new PrinterConnection();

export default printerConnection;