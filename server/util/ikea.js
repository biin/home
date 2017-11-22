const request = require('request');
const parser = require('xml2js');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const cron = require('node-cron');
const axios = require('axios');
const parseString = require('xml2js').parseString;
const co = require('co');

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
    } else if('/S' === command){
        alive();
    }
});

function start() {
    task && task.destroy();

    task = cron.schedule('00 09-21 * * *', function () {

        let requests = Object.keys(PRODUCT).map((key) => {
            return axios.get('http://www.ikea.com/kr/ko/iows/catalog/availability/' + key);
        });

        axios.all(requests)
            .then(axios.spread(function (inv1, inv2, inv3) {
                co(function *(){
                    let invRes1 = parseXml(inv1.data);
                    let invRes2 = parseXml(inv2.data);
                    let invRes3 = parseXml(inv3.data);

                    let results = yield [invRes1, invRes2, invRes3];
                    checkInventories(results);
                }).catch((err) => {
                    console.log(err);
                });
            }));
    }, false);

    task.start();
    bot.sendMessage(chatId, '서비스를 시작합니다.');
}

function stop() {
    task && task.destroy();
    bot.sendMessage(chatId, '서비스를 종료합니다.');
}

function alive(){
    bot.sendMessage(chatId, '살아 있어요~');
}
function parseXml(data){
    return new Promise( (resolve, rejct) => {
        parseString(data, function (err, result) {
            if(err){
                reject(err);
            }else{
                resolve(result);
            }
        });
    })
}

function checkInventories(results) {
    let msg = "==========================\n";
    results.forEach((result, index, arr) => {
        msg += checkInventory(result['ir:ikea-rest']['availability'][0].localStore);
    });
    msg += "==========================";
    bot.sendMessage(chatId, msg);
}

function checkInventory(invStores) {
    let msg = '';
    invStores.forEach(function (store, index, arr) {
        let storeCode = store.$.buCode;
        let partName = store.stock[0].partNumber;
        let availableStock = store.stock[0].availableStock;
        msg += (PRODUCT[partName] + ' : ' + STORE[storeCode] + ' - ' + availableStock + ' \n');
    });
    return msg;
}
