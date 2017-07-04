/**
 * Created by coskudemirhan on 04/07/2017.
 */
var db = require('./Db.js');
var timeseries = require("timeseries-analysis");
var fs = require('fs');


var forcastCount = 70;
var buyProfitMargin = 0.1;
var sellProfitMargin = 0.1;

var debug = true;
var bot = {};

var forcast = function (resource) {
    db.query('SELECT * FROM prices ORDER BY id DESC LIMIT 300', function (err, rows) {


        if (rows.length > 299) {
            var lastAskPrices = [], lastBidPrices = [];

            for (i in rows) {
                lastAskPrices.push([new Date(rows[i][3] * 1000), parseFloat(rows[i][1])]);
                lastBidPrices.push([new Date(rows[i][3] * 1000), parseFloat(rows[i][2])]);
            }


            var tAsk = new timeseries.main(lastAskPrices.reverse()).smoother({period: 10});

            var tBid = new timeseries.main(lastBidPrices.reverse()).smoother({period: 10});


            var Askcoeffs = tAsk.ARMaxEntropy({
                data: tAsk.data.slice(tAsk.data.length - forcastCount)
            });

            var Bidcoeffs = tBid.ARMaxEntropy({
                data: tBid.data.slice(tBid.data.length - forcastCount)
            });


            var askForecast = 0;
            for (var i = 0; i < Askcoeffs.length; i++) {
                askForecast -= tAsk.data[forcastCount - i][1] * Askcoeffs[i];
            }

            var bidForecast = 0;
            for (var i = 0; i < Bidcoeffs.length; i++) {
                bidForecast -= tBid.data[forcastCount - i][1] * Bidcoeffs[i];
            }

            if(debug){
                console.log('Alış Fiyatı: ' + lastAskPrices[lastAskPrices.length - 1][1]);
                console.log('Tahmini Alış Fiyatı: ' + askForecast);
                console.log('Ortalama Alış Fiyatı: ' + tAsk.mean());
            }

            var suitableForAsk = false;
            if (resource.ask === null) {
                /*
                 if(parseFloat(lastAskPrices[lastAskPrices.length-1][1])  < tAsk.mean()){
                 if(parseFloat(askForecast) > parseFloat(lastAskPrices[lastAskPrices.length-1][1])){

                 if((parseFloat(resource.bid) + parseFloat(buyProfitMargin)) < (parseFloat(lastAskPrices[lastAskPrices.length-1][1]))){

                 suitableForAsk = true;
                 buyKnow(resource,lastAskPrices[lastAskPrices.length-1][1]);
                 }

                 }

                 }
                 */
                if ((parseFloat(resource.bid) + parseFloat(buyProfitMargin)) < (parseFloat(lastAskPrices[lastAskPrices.length - 1][1]))) {

                    suitableForAsk = true;
                    buyKnow(resource, lastAskPrices[lastAskPrices.length - 1][1]);
                }
                if(debug)
                    console.log('Alış İstediğimiz Değer: ' + (parseFloat(resource.bid) - parseFloat(buyProfitMargin)));
            }

            if(debug){
                console.log('Alış İçin Uygun mu: ' + suitableForAsk + '\n');


                console.log('Satış Fiyatı: ' + lastBidPrices[lastBidPrices.length - 1][1]);
                console.log('Tahmini Satış Fiyatı: ' + bidForecast);
                console.log('Ortalama Satış Fiyatı: ' + tBid.mean());
            }

            var suitableForBid = false;
            if (resource.bid === null) {
                /*
                 if(lastBidPrices[lastBidPrices.length-1][1] > tBid.mean()){

                 if(bidForecast < lastBidPrices[lastBidPrices.length-1][1]){


                 if((parseFloat(resource.ask) + parseFloat(sellProfitMargin) ) <  parseFloat(lastBidPrices[lastBidPrices.length-1][1])){

                 suitableForBid = true;
                 sellKnow(resource, lastBidPrices[lastBidPrices.length-1][1]);
                 }
                 }

                 }
                 */
                if ((parseFloat(resource.ask) + parseFloat(sellProfitMargin) ) < parseFloat(lastBidPrices[lastBidPrices.length - 1][1])) {

                    suitableForBid = true;
                    sellKnow(resource, lastBidPrices[lastBidPrices.length - 1][1]);
                }
                if(debug)
                    console.log('Satış İstediğimiz Değer: ' + ( parseFloat(resource.ask) + parseFloat(sellProfitMargin) ));
            }

            if(debug) {

                console.log('Satış İçin Uygun mu: ' + suitableForBid + '\n');


                console.log('\n');
            }

        }

    });
}


var init = function (client,chatBot) {
    bot = chatBot;
    setInterval(function () {
        fs.readFile('resources.json', 'utf8', function readFileCallback(err, data) {
            if (err) {
                console.log(err);
            } else {
                var resource = JSON.parse(data);
                forcast(resource);
            }
        });
    }, 5000);


    db.query('SELECT * FROM market_logs', function (err, rows) {
        var total = 0;

        for (i in rows) {

            if (rows[i][1] === 'buy') {
                total -= rows[i][2] * rows[i][3];
            } else {
                total += rows[i][2] * rows[i][3];
            }

        }

        console.log('Total İşlem Karı: ' + total + '$');
    });


}

var buyKnow = function (resource, ask) {
    bot.sendMessage(22353916, ask +'$ değerinde ' + resource.amount + ' ETH Satın Aldım');
    resource.ask = ask;
    resource.bid = null;
    fs.writeFile('resources.json', JSON.stringify(resource), 'utf8', function () {
        db.query("INSERT INTO market_logs VALUES(null,@type,'@value','@amount',@date)", {
            type: 'buy',
            value: ask,
            amount: resource.amount,
            date: +new Date()
        });
    });


}

var sellKnow = function (resource, bid) {
    bot.sendMessage(22353916, bid +'$ değerinde ' + resource.amount + ' ETH Sattım');

    resource.ask = null;
    resource.bid = bid;
    fs.writeFile('resources.json', JSON.stringify(resource), 'utf8', function () {
        db.query("INSERT INTO market_logs VALUES(null,@type ,'@value','@amount',@date)", {
            type: 'sell',
            value: bid,
            amount: resource.amount,
            date: +new Date()
        });
    });


}

module.exports = {
    init: init
}