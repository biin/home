const request = require('request');
const parser = require('xml2js');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const cron = require('node-cron');

let botToken;
try {
    const telegramInfo = fs.readFileSync('.telegram', 'utf8');
    botToken = JSON.parse(telegramInfo).token;

} catch (e) {
    console.error(e);
    process.exit()
}

const STORE = {
    '373': '광명',
    '522': '고양'
};

const PRODUCT = {
    'S09021098': '2칸 서랍장',
    '70272714': '모듈식2단서랍장',
    '90272713': '모듈식3단서랍장'
}


const bot = new TelegramBot(botToken, { polling: true });

let task = null;
let chatId = '';

bot.on('message', (msg) => {
    chatId = msg.chat.id;
    let command = msg.text.toUpperCase();
    if ('/S' === command) {
        start();
    } else if ('/T' === command) {
        stop();
    }
});

function start() {

    task = cron.schedule('* */1 * * *', function () {
        
        Object.keys(PRODUCT).forEach(function (key) {
            request.get({
                url: 'http://www.ikea.com/kr/ko/iows/catalog/availability/' + key,
                method: 'GET'
            }, function (err, res, body) {
                if (!err && res.statusCode == 200) {
                    var parseString = require('xml2js').parseString;
                    parseString(body, function (err, result) {
                        checkInventory(result['ir:ikea-rest']['availability'][0].localStore);
                    });
                }
            });
        });
    }, false);
    
    task.start();
    bot.sendMessage(chatId, '서비스를 시작합니다.');
}

function stop() {
    task.destroy();
    bot.sendMessage(chatId, '서비스를 종료합니다.');
}

function checkInventory(invStores) {
    let msg = '';
    invStores.forEach(function (store, index, arr) {
        let storeCode = store.$.buCode;
        let partName = store.stock[0].partNumber;
        let availableStock = store.stock[0].availableStock;
        msg += (PRODUCT[partName] + ' : ' + STORE[storeCode] + ' - ' + availableStock + ' \n');
    });
    bot.sendMessage(chatId, msg);
}
