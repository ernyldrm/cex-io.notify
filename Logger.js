/**
 * Created by coskudemirhan on 17/06/2017.
 */


var router = require("./App/Route.js");

var client = require('./App/Client.js');
setInterval(function (){
    client.api.ticker(couple = 'ETH/USD',function(param){
        db.query("INSERT INTO prices SET ?", {ask:param.ask, bid: param.bid, timestamp: param.timestamp});

    });


}, 5000);







