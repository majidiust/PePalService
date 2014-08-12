var webSocketsServerPort = 1337;
// websocket and http servers
var webSocketServer = require('websocket').server;
var Sleep = require('sleep');
var TokenModel = require('../models/token');
var AuthResultCodes = require('../libs/error-codes').AuthResultCode;
var User = require('../models/user');
var http = require('http');
var jwt = require('jwt-simple');
var MessageType = require('../libs/msg-types').WebsocketMessageList;
var CommandList = require('../libs/cmd-list').WebsocketCommandList;
var clients = [];
var server;
var wsServer;

var initWebSocket = function () {
    server = http.createServer(function (request, response) {
        // Not important for us. We're writing WebSocket server, not HTTP server
    });

    server.listen(webSocketsServerPort, function () {
        console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
    });

    /**
    * WebSocket server
    */
    wsServer = new webSocketServer({
        // WebSocket server is tied to a HTTP server. WebSocket request is just
        // an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
        httpServer: server
    });

    wsServer.on('request', function (request) {
        console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
        var connection = request.accept(null, request.origin);
        // we need to know client index to remove them on 'close' event
        var index = clients.length;
        connection.authResult = AuthResultCodes.UnAuthorized;
        connection.id = index;
        clients[index] = connection;
        addBackgroundWorker(clients[index]);

        console.log((new Date()) + ' Connection accepted. connection id is : ' + index);
        // user sent some message
        connection.on('message', function (message) {
            console.log(message);
            try {
                var object;
                if (message.type == 'utf8') {
                    object = JSON.parse(message.utf8Data);
                }
                else {
                    object = JSON.parse(message.data);
                }
                console.log(object);

                if (object.token != undefined) {
                    try {
                        console.log("token is : " + object.token);
                        connection.token = object.token;
                        isAuthorized(connection,
                        function () {
                            clients[connection.id].attempts = 0;
                            clients[connection.id].authResult = connection.authResult;
                            clients[connection.id].user = connection.user;
                            connection.send(createResultTextData(CommandList.Authorized.message, CommandList.Authorized.code));
                            clients[connection.id].startWorker();
                        },
                        function () {
                            console.log("not authorized");
                            sendAuthorizationRequest(connection);
                            if (clients[connection.id].attempts)
                                clients[connection.id].attempts += 1;
                            else
                                clients[connection.id].attempts = 1;
                            console.log((new Date()) + 'attempt : ' + clients[connection.id].attempts + 'connection close because ' + connection.authResult.code + ':' + connection.authResult.Message);
                        })

                    }
                    catch (ex) {
                        console.log("token exist : " + ex);
                        sendAuthorizationRequest(connection);
                    }
                }
                else {
                    if (clients[connection.id].authResult.code == AuthResultCodes.AuthorizationIsOk.code) {
                        if (object.code != undefined) {
                            if (object.code == WebsocketMessageList.SendTextMessageTo.value) {
                                sendTextMessageToRoom(clients[connection.id].user, object.param);
                            }
                        }
                        else {

                        }
                        connection.send(createResultTextData(CommandList.InvalidMessage.code, CommandList.InvalidMessage.message));
                    } else {
                        sendAuthorizationRequest(connection);
                    }
                }
            }
            catch (ex) {
                console.log("onmessage : " + ex);
            }
        });

        connection.on('close', function (connection) {
            console.log("client disconnected.");
            clients[index].stopWorker();
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected. ' +
                    "Connection ID: " + index);
            // Make sure to remove closed connections from the global pool
            delete clients[index];
        });
    });
}

function createResultTextData(cmd, data) {
    return JSON.stringify({ cmd: cmd, data: data });
}

function sendTextMessageToRoom(from, roomId) {

}

function sendAuthorizationRequest(connection) {
    try {
        if (connection && connection.connected) {
            connection.send(createResultTextData(CommandList.TokenRequest.message, CommandList.TokenRequest.code));
        }
    }
    catch (ex) {
        console.log("sendAuthorizationRequest : " + ex);
    }
}

function notifyRoomMembers() {
    //TODO : notify room members for events
}

function addBackgroundWorker(object) {
    object.startWorker = function () {
        object.backgrounWorker = setInterval(function () {
            console.log("/");
        }, 2000);
    }
    object.stopWorker = function () {
        if (object.backgrounWorker) {
            clearInterval(object.backgrounWorker);
        }
    }
}

/*
*   check that is token valid and add user and authResult to request
*   return true if authorized and false other than
*/
function isAuthorized(request, successCallback, errorCallback) {
    if (request.token != undefined) {
        var decoded = jwt.decode(request.token, "729183456258456");
        console.log("Token expired in : " + decoded.exp);
        if (decoded.exp <= Date.now()) {
            request.authResult = AuthResultCodes.TokenExpired;
            console.log("Token has been expired!");
            if (errorCallback != null)
                errorCallback();
        }
        User.findOne({ '_id': decoded.iss }, function (err, user) {
            if (!err) {
                TokenModel.find({ token: request.token, state: true, userId: user.id }, function (err, tokens) {
                    if (tokens.length > 0) {
                        console.log("find user token");
                        request.user = user;
                        request.authResult = AuthResultCodes.AuthorizationIsOk;
                        if (successCallback != null)
                            successCallback();
                    }
                    else {
                        request.authResult = AuthResultCodes.TokenIsInvalid;
                        if (errorCallback != null)
                            errorCallback();
                    }
                });
            }
            else {
                request.authResult = AuthResultCodes.TokenIsInvalid;
                if (errorCallback != null)
                    errorCallback();
            }
        });
    }
    else {
        request.authResult = AuthResultCodes.TokenIsUndifined;
        return false;
    }
}

function sendEventsToUser(user) {

}


module.exports.initWebSocket = initWebSocket;