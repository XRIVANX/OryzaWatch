const fs = require('fs');
const QRCode = require('../oryzawatch_mobile/node_modules/qrcode-terminal/vendor/QRCode');
const qr = new QRCode(-1, 1);
qr.addData('exp://192.168.1.54:8081');
qr.make();
fs.writeFileSync(__dirname + '/expo-qr.json', JSON.stringify(qr.modules));
