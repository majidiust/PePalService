var webSocketsServerPort = 1337;
// websocket and http servers
var webSocketServer = require('websocket').server;
var TokenModel = require('../models/token');
var EntityModel = require('../models/chat').EntityModel;
var RoomModel = require('../models/chat').RoomModel;
var ErrorCodes = require('../libs/error-codes').AuthResultCode;
var SuccessCodes = require('../libs/success-codes').SuccessCode;
var MessageType = require('../libs/msg-types').WebsocketMessageList;
var CommandList = require('../libs/cmd-list').WebsocketCommandList;
var User = require('../models/user');
var http = require('http');
var jwt = require('jwt-simple');

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
        connection.authResult = ErrorCodes.UnAuthorized;
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
                    /*
                     *   object json schema : {'token':'.........', 'requestCode':'....', }
                     */
                    try {
                        console.log("token is : " + object.token);
                        connection.token = object.token;
                        isAuthorized(connection,
                            function () {
                                clients[connection.id].attempts = 0;
                                clients[connection.id].authResult = connection.authResult;
                                clients[connection.id].user = connection.user;
                                clients[connection.id].connection = connection;
                                connection.send(createResultTextData(CommandList.Authorized.Message, CommandList.Authorized.code));
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
                    if (clients[connection.id].authResult.code == SuccessCodes.AuthorizationIsOk.code) {
                        if (object.requestCode != undefined) {
                            if (object.requestCode == MessageType.SendTextMessageTo.code) {
                                if (object.messageContent) {
                                    if (!object.roomId) {
                                        connection.send(createResultTextData(ErrorCodes.RoomIdIsEmpty.code, ErrorCodes.RoomIdIsEmpty.Message));
                                        return;
                                    }
                                    var publishType = 'Now';
                                    if (object.publishType) {
                                        if (object.publishType == 'Now' || object.publishType == 'Scheduled') {
                                            publishType = object.publishType;
                                        }
                                        else {
                                            connection.send(createResultTextData(ErrorCodes.InvalidEventPublishType.code, ErrorCodes.InvalidEventPublishType.Message));
                                            return;
                                        }
                                    }
                                    if (publishType == 'Scheduled') {
                                        if (!object.publishDate) {
                                            connection.send(createResultTextData(ErrorCodes.InvalidEventPublishDate.code, ErrorCodes.InvalidEventPublishDate.Message));
                                            return;
                                        }
                                    }
                                    console.log("user that wants to send message is : " + clients[connection.id].user.id);
                                    var event = new EntityModel({
                                        Type: 'Text',
                                        Content: object.messageContent,
                                        Creator: clients[connection.id].user.id,
                                        CreatorUserName: clients[connection.id].user.userName,
                                        PublishType: publishType
                                    });
                                    if (object.publishDate)
                                        event.PublishDate = object.publishDate;
                                    sendEventToRoom(clients[connection.id], event, object.roomId);
                                }
                                else {
                                    connection.send(createResultTextData(ErrorCodes.InvalidEventContent.code, ErrorCodes.InvalidEventContent.Message));
                                }
                            }
                            else if (object.requestCode == MessageType.CreateIndividualRoom.code) {
                                if (object.otherParty) {
                                    createIndividualRoom(clients[connection.id], object.otherParty);
                                }
                                else {
                                    connection.send(createResultTextData(ErrorCodes.MissingOtherParty.code, ErrorCodes.MissingOtherParty.Message));
                                }
                            }
                            else {
                                connection.send(createResultTextData(ErrorCodes.InvalidRequestCode.code, ErrorCodes.InvalidRequestCode.Message));
                            }
                        }
                        else {
                            connection.send(createResultTextData(ErrorCodes.InvalidRequestCode.code, ErrorCodes.InvalidRequestCode.Message));
                        }
                    }
                    else {
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
};

function createResultTextData(message, code) {
    return JSON.stringify({ message: message, code: code });
}

function createParametrizedResultTextData(message, code, paramName, paramValue) {
    var result = {
        message: message,
        code: code
    };
    result[paramName] = paramValue;
    return JSON.stringify(result);
}


//OtherParty : id of other user
function createIndividualRoom(client, otherParty) {
    try {
        client.user.hasRelationTo(otherParty, function (roomId) {
            client.connection.send(createParametrizedResultTextData(SuccessCodes.RoomExist.Message, SuccessCodes.RoomExist.code, 'roomId', roomId));
        }, function () {
            //Create Room Instance
            var newRoom = new RoomModel(
                {
                    Type: 'I',
                    StartType: 'Now',
                    Creator: client.user.id
                }
            );
            newRoom.Admins.push(client.user.id);
            newRoom.Admins.push(otherParty);
            newRoom.Members.push(client.user.id);
            newRoom.Members.push(otherParty);
            newRoom.save(null);
            client.connection.send(createParametrizedResultTextData(SuccessCodes.CreateRoomSuccessfully.Message, SuccessCodes.CreateRoomSuccessfully.code, 'roomId', newRoom.id));
        });
    }
    catch (ex) {
        console.log(ex);
    }
}

function sendEventToRoom(client, event, roomId) {
    RoomModel.findOne({'_id': roomId})
        .populate('Members')
        .exec(function (err, room) {
            if (err) {
                console.log('error in publish event to room members');
                client.connection.send(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
            }
            else if (!room) {
                console.log('specific room not found');
                client.connection.send(createResultTextData(ErrorCodes.RoomDoesNotExist.Message, ErrorCodes.RoomDoesNotExist.code));
            }
            else {
                /*
                 *    1.save event in event document
                 *    2.save event ref to room event collection
                 *    3.push event ref to room members queue
                 */
                event.save(function (err) {
                    if (err) {
                        console.log('error in inserting event in document');
                        client.connection.send(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
                    }
                    else {
                        console.log("Event save successfully");
                        room.Entities.push(event.id);
                        for (var i = 0; i < room.Members.length; i++) {
                            var user = room.Members[i];
                            console.log(user);
                            user.nonDeliveredEvents.push(event.id);
                            user.save(function (err) {
                                if (err) {
                                    console.log('error in inserting event to user event queue');
                                    client.connection.send(createResultTextData(ErrorCodes.PushEventToUSerError.Message, ErrorCodes.PushEventToUSerError.code));
                                } else {
                                    console.log('event ublished successfully');
                                    client.connection.send(createResultTextData(SuccessCodes.EventPostedSuccessfully.Message, SuccessCodes.EventPostedSuccessfully.code));
                                }
                            });
                        }
                    }
                });
            }
        });
}

function sendAuthorizationRequest(connection) {
    try {
        if (connection && connection.connected) {
            connection.send(createResultTextData(CommandList.TokenRequest.Message, CommandList.TokenRequest.code));
        }
    }
    catch (ex) {
        console.log("sendAuthorizationRequest : " + ex);
    }
}

function addBackgroundWorker(object) {
    object.startWorker = function () {
        object.backgrounWorker = setInterval(function () {
            sendEventsToUser(object.user, object.connection);
        }, 2000);
    };
    object.stopWorker = function () {
        if (object.backgrounWorker) {
            clearInterval(object.backgrounWorker);
        }
    };
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
            request.authResult = ErrorCodes.TokenExpired;
            console.log("Token has been expired!");
            if (errorCallback != null)
                errorCallback();
        }
        User.findOne({ '_id': decoded.iss }).populate('nonDeliveredEvents').exec(function (err, user) {
            if (!err) {
                TokenModel.find({ token: request.token, state: true, userId: user.id }, function (err, tokens) {
                    if (tokens.length > 0) {
                        console.log("find user token");
                        request.user = user;
                        request.authResult = SuccessCodes.AuthorizationIsOk;
                        if (successCallback != null)
                            successCallback();
                    }
                    else {
                        request.authResult = ErrorCodes.TokenIsInvalid;
                        if (errorCallback != null)
                            errorCallback();
                    }
                });
            }
            else {
                request.authResult = ErrorCodes.TokenIsInvalid;
                if (errorCallback != null)
                    errorCallback();
            }
        });
    }
    else {
        request.authResult = ErrorCodes.TokenIsUndifined;
        return false;
    }
}

function sendEventsToUser(user, connection) {
    try {
        User.findOne({ '_id': user.id }).populate('nonDeliveredEvents').exec(function (err, newUser) {
            if (!err && newUser) {
                user = newUser;
                for (var i = 0; i < user.nonDeliveredEvents.length; i++) {

                    var event = user.nonDeliveredEvents[i];
                    var changed = false;
                    if (event.PublishType == 'Now') {
                        var msg = createEventMessage(event);
                        connection.send(msg);
                        changed = true;
                    }
                    if (changed) {
                        event.Delivered.push(user.id);
                        event.save(function (err) {
                            if (err) {
                                console.log('Error in save delivered in events document');
                            }
                            else {
                                console.log('delivered user saved to event document');
                            }
                        });
                        user.nonDeliveredEvents.splice(i, 1);
                        user.save(function (err) {
                            if (err) {
                                console.log('Error in save remove event from event list in user document');
                            }
                            else {
                                console.log('save remove event from event list in user document');
                            }
                        });
                        break;
                    }
                }
            }
        });
    }
    catch (ex) {
        console.log(ex);
    }
}

function createEventMessage(event) {
    if (event.Type == 'Text') {
        return createTextEventMessage(event);
    }
}

function createTextEventMessage(event) {
    var val = {
        type: 'Text',
        date: event.CreateDate,
        from: event.CreatorUserName,
        content: event.Content
    };
    var result = {
        message: CommandList.NewMessage.Message,
        code: CommandList.NewMessage.code,
        value: val
    };
    return JSON.stringify(result);
}


module.exports.initWebSocket = initWebSocket;