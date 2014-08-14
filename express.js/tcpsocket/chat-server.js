/**
 * Created by Majid on 8/15/2014.
 */
var net = require('net');
var server;
var tcpSocketPort = 5000;

var initTCPSocket = function () {
    console.log("initTCPSocket on " + tcpSocketPort);
    server = net.createServer(function (socket) {
        socket.on('connection', function (socket) {
            console.log('socket connection...');
        });
        socket.on('data', function (message) {
            console.log('socket message:' + message);
            socket.write('You wrote:' + message);
            socket.end(); // <-- :)
        });
        socket.on('error', function (error) {
            console.log('error on socket message:' + error);
        });
    }).listen(tcpSocketPort);
}

module.exports.initTCPSocket = initTCPSocket;