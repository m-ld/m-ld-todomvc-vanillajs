import {shortId} from 'https://edge.js.m-ld.org/ext/index.mjs';
import {base64ToBytes} from "./helpers.js";

export class Device {
	static async here() {
		const keystore = await window.keystore.default.init({type: 'rsa'});
		return new Device(keystore, await keystore.publicWriteKey());
	}

	constructor(keystore, publicKey) {
		this.ks = keystore;
		this.key = {keyid: shortId(publicKey), public: publicKey}
	}

	asMeldApp(pid) {
		const principal = {
			'@id': pid,
			sign: async data => new Uint8Array([
				...new TextEncoder().encode(`${this.key.keyid}:`),
				...base64ToBytes(await this.ks.sign(data))
			])
		};
		// noinspection JSUnusedGlobalSymbols
		const transportSecurity = {
			// We don't transform data on the wire
			wire: data => data,
			// Apply a signature using our key
			sign: async data => ({pid, sig: await principal.sign(data)})
			// Note we don't verify signatures; but the Gateway does
		};
		return {principal, transportSecurity};
	}
}
