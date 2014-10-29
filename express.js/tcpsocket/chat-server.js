/**
 * Created by Majid on 8/15/2014.
 */
var net = require('net');
var TokenModel = require('../models/token').TokenModel;
var EntityModel = require('../models/chat').EntityModel;
var RoomModel = require('../models/chat').RoomModel;
var ErrorCodes = require('../libs/error-codes').AuthResultCode;
var SuccessCodes = require('../libs/success-codes').SuccessCode;
var MessageType = require('../libs/msg-types').WebsocketMessageList;
var CommandList = require('../libs/cmd-list').WebsocketCommandList;
var UserModel = require('../models/user').UserModel;
var log = require('../log/log');

var server;
var tcpSocketPort = 5000;
var clients = [];

var initTCPSocket = function () {
    //console.log("initTCPSocket on " + tcpSocketPort);
    log.info("initTCPSocket on " + tcpSocketPort);
    server = net.createServer(function (socket) {
        socket.on('connection', function (socket) {
            //console.log('socket connection...');
            log.info('socket connection...');
            var index = clients.length;
            socket.authResult = ErrorCodes.UnAuthorized;
            socket.id = index;
            clients[index] = socket;
            addBackgroundWorker(clients[index]);
        });
        socket.on('data', function (message) {
            //console.log('socket message:' + message);
            log.info('socket message:' + message);
            object = JSON.parse(message);
            if (object.token != undefined) {
                /*
                 *   object json schema : {'token':'.........', 'requestCode':'....', }
                 */
                try {
                    //console.log("token is : " + object.token);
                    log.info("token is : " + object.token);
                    socket.token = object.token;
                    isAuthorized(socket,
                        function () {
                            clients[socket.id].attempts = 0;
                            clients[socket.id].authResult = socket.authResult;
                            clients[socket.id].user = socket.user;
                            clients[socket.id].socket = socket;
                            socket.write(createResultTextData(CommandList.Authorized.Message, CommandList.Authorized.code));
                            socket.end();
                            clients[socket.id].startWorker();
                        },
                        function () {
                            //console.log("not authorized");
                            log.info("not authorized");
                            sendAuthorizationRequest(socket);
                            if (clients[socket.id].attempts)
                                clients[socket.id].attempts += 1;
                            else
                                clients[socket.id].attempts = 1;
                            //console.log((new Date()) + 'attempt : ' + clients[socket.id].attempts + 'socket close because ' + socket.authResult.code + ':' + socket.authResult.Message);
                            log.info((new Date()) + 'attempt : ' + clients[socket.id].attempts + 'socket close because ' + socket.authResult.code + ':' + socket.authResult.Message);
                        })
                }
                catch (ex) {
                    //console.log("token exist : " + ex);
                    log.info("token exist : " + ex);
                    sendAuthorizationRequest(socket);
                }
            }
            else {
                if (clients[socket.id].authResult.code == SuccessCodes.AuthorizationIsOk.code) {
                    if (object.requestCode != undefined) {
                        if (object.requestCode == MessageType.SendTextMessageTo.code) {
                            if (object.messageContent) {
                                if (!object.roomId) {
                                    socket.write(createResultTextData(ErrorCodes.RoomIdIsEmpty.code, ErrorCodes.RoomIdIsEmpty.Message));
                                    socket.end();
                                    return;
                                }
                                var publishType = 'Now';
                                if (object.publishType) {
                                    if (object.publishType == 'Now' || object.publishType == 'Scheduled') {
                                        publishType = object.publishType;
                                    }
                                    else {
                                        socket.write(createResultTextData(ErrorCodes.InvalidEventPublishType.code, ErrorCodes.InvalidEventPublishType.Message));
                                        socket.end();
                                        return;
                                    }
                                }
                                if (publishType == 'Scheduled') {
                                    if (!object.publishDate) {
                                        socket.write(createResultTextData(ErrorCodes.InvalidEventPublishDate.code, ErrorCodes.InvalidEventPublishDate.Message));
                                        socket.end();
                                        return;
                                    }
                                }
                                //console.log("user that wants to send message is : " + clients[socket.id].user.id);
                                log.info("user that wants to send message is : " + clients[socket.id].user.id);
                                var event = new EntityModel({
                                    Type: 'Text',
                                    Content: object.messageContent,
                                    Creator: clients[socket.id].user.id,
                                    CreatorUserName: clients[socket.id].user.username,
                                    PublishType: publishType
                                });
                                if (object.publishDate)
                                    event.PublishDate = object.publishDate;
                                sendEventToRoom(clients[socket.id], event, object.roomId);
                            }
                            else {
                                socket.write(createResultTextData(ErrorCodes.InvalidEventContent.code, ErrorCodes.InvalidEventContent.Message));
                                socket.end();
                            }
                        }
                        else if (object.requestCode == MessageType.CreateIndividualRoom.code) {
                            if (object.otherParty) {
                                createIndividualRoom(clients[socket.id], object.otherParty);
                            }
                            else {
                                socket.write(createResultTextData(ErrorCodes.MissingOtherParty.code, ErrorCodes.MissingOtherParty.Message));
                                socket.end();
                            }
                        }
                        else {
                            socket.write(createResultTextData(ErrorCodes.InvalidRequestCode.code, ErrorCodes.InvalidRequestCode.Message));
                            socket.end();
                        }
                    }
                    else {
                        socket.write(createResultTextData(ErrorCodes.InvalidRequestCode.code, ErrorCodes.InvalidRequestCode.Message));
                        socket.end();
                    }
                }
                else {
                    sendAuthorizationRequest(socket);
                }
            }
        });
        socket.on('error', function (error) {
            //console.log('error on socket message:' + error);
            log.error('error on socket message:' + error);
        });
    }).listen(tcpSocketPort);
}

function createIndividualRoom(client, otherParty) {
    try {
        hasUserRelationToOther(client.user, otherParty, function (roomId) {
            //console.log("Room exist : " + roomId);
            log.info("Room exist : " + roomId);
            client.socket.write(createParametrizedResultTextData(SuccessCodes.RoomExist.Message, SuccessCodes.RoomExist.code, 'roomId', roomId));
            client.socket.end();
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
            client.user.individuals.push(newRoom.id);
            client.user.save(null);
            client.socket.write(createParametrizedResultTextData(SuccessCodes.CreateRoomSuccessfully.Message, SuccessCodes.CreateRoomSuccessfully.code, 'roomId', newRoom.id));
            client.socket.end();
            UserModel.findOne({ '_id': otherParty }, function(err, remote){
                if(err){
                    //console.log('Could not find remote party');
                    log.error('Could not find remote party');
                }
                else if(!remote){
                    //console.log('Could not find remote party');
                    log.error('Could not find remote party');
                }
                else{
                    //console.log("room added to remote party successfully");
                    log.info("room added to remote party successfully");
                    //console.log(remote);
                    log.info(remote);
                    remote.individuals.push(newRoom.id);
                    remote.save(null);
                }
            })
        });
    }
    catch (ex) {
        //console.log(ex);
        log.error(ex);
    }
}


function sendEventToRoom(client, event, roomId) {
    RoomModel.findOne({'_id': roomId})
        .populate('Members')
        .exec(function (err, room) {
            if (err) {
                //console.log('error in publish event to room members');
                log.error('error in publish event to room members');
                client.socket.write(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
                client.socket.end();
            }
            else if (!room) {
                //console.log('specific room not found');
                log.error('specific room not found');
                client.socket.write(createResultTextData(ErrorCodes.RoomDoesNotExist.Message, ErrorCodes.RoomDoesNotExist.code));
                client.socket.end();
            }
            else {
                /*
                 *    1.save event in event document
                 *    2.save event ref to room event collection
                 *    3.push event ref to room members queue
                 */
                event.save(function (err) {
                    if (err) {
                        //console.log('error in inserting event in document');
                        log.error('error in inserting event in document');
                        client.socket.write(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
                        client.socket.end();
                    }
                    else {
                        //console.log("Event save successfully");
                        log.error("Event save successfully");
                        room.Entities.push(event.id);
                        for (var i = 0; i < room.Members.length; i++) {
                            var user = room.Members[i];
                            console.log(user);
                            user.nonDeliveredEvents.push(event.id);
                            user.save(function (err) {
                                if (err) {
                                    console.log('error in inserting event to user event queue');
                                    client.socket.write(createResultTextData(ErrorCodes.PushEventToUSerError.Message, ErrorCodes.PushEventToUSerError.code));
                                    client.socket.end();
                                } else {
                                    console.log('event ublished successfully');
                                    client.socket.write(createResultTextData(SuccessCodes.EventPostedSuccessfully.Message, SuccessCodes.EventPostedSuccessfully.code));
                                    client.socket.end();
                                }
                            });
                        }
                    }
                });
            }
        });
}

function sendAuthorizationRequest(socket) {
    try {
        socket.write(createResultTextData(CommandList.TokenRequest.Message, CommandList.TokenRequest.code));
        socket.end();
    }
    catch (ex) {
        //console.log("sendAuthorizationRequest : " + ex);
        log.error("sendAuthorizationRequest : " + ex);
    }
}


function addBackgroundWorker(object) {
    object.startWorker = function () {
        object.backgrounWorker = setInterval(function () {
            sendEventsToUser(object.user, object.socket);
        }, 2000);
    };
    object.stopWorker = function () {
        if (object.backgrounWorker) {
            clearInterval(object.backgrounWorker);
        }
    };
}

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

function sendEventsToUser(user, socket) {
    try {
        UserModel.findOne({ '_id': user.id }).populate('nonDeliveredEvents').exec(function (err, newUser) {
            if (!err && newUser) {
                user = newUser;
                for (var i = 0; i < user.nonDeliveredEvents.length; i++) {

                    var event = user.nonDeliveredEvents[i];
                    var changed = false;
                    if (event.PublishType == 'Now') {
                        var msg = createEventMessage(event);
                        socket.write(msg);
                        socket.end();
                        changed = true;
                    }
                    if (changed) {
                        event.Delivered.push(user.id);
                        event.save(function (err) {
                            if (err) {
                                //console.log('Error in save delivered in events document');
                                log.error('Error in save delivered in events document');
                            }
                            else {
                                //console.log('delivered user saved to event document');
                                log.error('delivered user saved to event document');
                            }
                        });
                        user.nonDeliveredEvents.splice(i, 1);
                        user.save(function (err) {
                            if (err) {
                                //console.log('Error in save remove event from event list in user document');
                                log.error('Error in save remove event from event list in user document');
                            }
                            else {
                                //console.log('save remove event from event list in user document');
                                log.error('save remove event from event list in user document');
                            }
                        });
                        break;
                    }
                }
            }
        });
    }
    catch (ex) {
        //console.log(ex);
        log.error(ex);
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

function isAuthorized(request, successCallback, errorCallback) {
    if (request.token != undefined) {
        var decoded = jwt.decode(request.token, "729183456258456");
        //console.log("Token expired in : " + decoded.exp);
        log.info("Token expired in : " + decoded.exp);
        if (decoded.exp <= Date.now()) {
            request.authResult = ErrorCodes.TokenExpired;
            //console.log("Token has been expired!");
            log.error("Token has been expired!");
            if (errorCallback != null)
                errorCallback();
        }
        UserModel.findOne({ '_id': decoded.iss }).populate('nonDeliveredEvents').exec(function (err, user) {
            if (!err) {
                TokenModel.find({ token: request.token, state: true, userId: user.id }, function (err, tokens) {
                    if (tokens.length > 0) {
                        //console.log("find user token");
                        log.info("find user token");
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

function hasUserRelationToOther(me, other, exist, notExist){
    try{
        //console.log("check is two user make chat before ? ");
        log.info("check is two user make chat before ? ");
        UserModel.findOne({'_id':me.id}).populate('individuals').exec(function (err, user) {
            //console.log(user);
            log.info(user);
            var e = false;
            var roomid ;
            for(var i = 0 ; i < user.individuals.length ; i++){
                for(var j = 0 ;  j < user.individuals[i].Members.length ; j++){
                    if(user.individuals[i].Members[j] == other) {
                        //console.log('room id is : ' + user.individuals[i].id);
                        log.info('room id is : ' + user.individuals[i].id);
                        roomid = user.individuals[i].id;
                        e = true;
                        break;
                    }
                }
                if(e == true)
                    break;
            }
            if(e == true)
            {
                exist(roomid);
            }
            else{
                notExist();
            }

        });
    }
    catch(ex){
        //console.log(ex);
        log.error(ex);
    }
};

module.exports.initTCPSocket = initTCPSocket;