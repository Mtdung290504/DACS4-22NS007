import os from "os";



/**
 * Hàm tiện ích trả về IP Wifi của máy
 * @returns {string | 'Not found'}
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

    return 'Not found';
}