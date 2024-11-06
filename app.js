import os from "os";

/**
 * @typedef { 'demo' | 'demo2' | 'demo-base' } Actions
 */
/**
 * @todo Run `npm test -- <action>` to test or `npm start` to start
 * @example `npm test -- demo` // Run demo app
 * @example `npm start` // Run app
 */
const app = {
    /**
     * Starting app
     */
    start: async () => {
        const args = process.argv.slice(2);

        if (args.length) {

            /**@type {Actions} */
            const action = args[0];
        
            switch (action) {
                case 'demo':
                    const WebRTCServer1 = (await import('./servers/DemoWebRTCServer.js')).default;
                    new WebRTCServer1(3000, getServerWiFiIP()).start();
                    break;
                case 'demo2':
                    const WebRTCServer2 = (await import('./servers/DemoWebRTCServer2.js')).default;
                    new WebRTCServer2().start();
                    break;
                case 'demo-base':
                    const WebRTCServer = (await import('./servers/WebRTCServer.js')).default;
                    new WebRTCServer(3000, getServerWiFiIP()).start();
                    break;
                default:
                    console.log('Unidentifiable action');
                    return;
            }
        } else {

        }
    }
}

app.start();

/**
 * Hàm tiện ích trả về IP Wifi của máy
 * @returns {string | undefined}
 */
function getServerWiFiIP() {
    const interfaces = os.networkInterfaces();
    const wifiInterface = interfaces['Wi-Fi'];

    if (wifiInterface) {
        for (const details of wifiInterface) {
            if (details.family === 'IPv4' && !details.internal) {
                return details.address;
            }
        }
    }

    return undefined;
}