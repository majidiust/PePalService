var webSocketsServerPort = 1337;
// websocket and http servers
var webSocketServer = require('websocket').server;
var TokenModel = require('../models/token').TokenModel;
var EntityModel = require('../models/chat').EntityModel;
var RoomModel = require('../models/chat').RoomModel;
var ErrorCodes = require('../libs/error-codes').AuthResultCode;
var SuccessCodes = require('../libs/success-codes').SuccessCode;
var MessageType = require('../libs/msg-types').WebsocketMessageList;
var CommandList = require('../libs/cmd-list').WebsocketCommandList;
var EventTypeList = require('../libs/event-type').EventTypeList;

var UserModel = require('../models/user').UserModel;
var http = require('http');
var jwt = require('jwt-simple');
var events = require('events');
var eventEmitter = new events.EventEmitter();

var clients = [];
var server;
var wsServer;


function announceFriendAdded(invited, inviter){
    console.log("## On announceFriendAdded");
   // try{
        for(var i = 0 ; i < clients.length ; i++){
            try {
                if (clients[i].user.id == invited) {
                    clients[i].connection.send(createParametrizedResultTextData(CommandList.MemberAdded.Message, CommandList.MemberAdded.code, 'invitedBy', inviter));
                    break;
                }
            }
                catch(ex){
                console.log(ex);}
            }

  ///  }
  //  catch(ex){
  //      console.log(ex);
//    }
}

function announceAddedToRoom(inviter, invited, roomId){
    console.log("## On announceAddedToRoom");
    try{
        for(var i = 0 ; i < clients.length ; i++){
            try {
                if (clients[i].user.id == invited) {
                    clients[i].connection.send(createParametrizedResultTextData2(CommandList.AddedToRoom.Message, CommandList.AddedToRoom.code, 'invitedBy', inviter, 'roomId', roomId));
                    break;
                }
            }
            catch(ex){
                console.log(ex);
            }
        }
    }
    catch(ex){
        console.log(ex);
    }
}

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
                                        CreatorUserName: clients[connection.id].user.username,
                                        PublishType: publishType,
                                        RoomId: object.roomId
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
                            else if (object.requestCode == MessageType.GetIndividualRooms.code) {
                                console.log("Get individual rooms");
                                UserModel.findOne({'_id': clients[connection.id].user.id}).populate("individuals").exec(function (err, users) {
                                    var result = [];
                                    for (var i = 0; i < users.individuals.length; i++) {
                                        result[i] = users.individuals[i];
                                    }
                                    clients[connection.id].connection.send(createParametrizedResultTextData(SuccessCodes.IndividualContacts.Message, SuccessCodes.IndividualContacts.code, 'rooms', result));
                                });
                            }
                            else if (object.requestCode == MessageType.GetGroupContacts.code){
                                console.log("get group contacts");
                                getGroupRooms(clients[connection.id])
                            }
                            else if (object.requestCode == MessageType.GetCurrentProfile.code) {
                                var result = clients[connection.id].user.getBrief();
                                clients[connection.id].connection.send(createParametrizedResultTextData(SuccessCodes.CurrentProfile.Message, SuccessCodes.CurrentProfile.code, 'profile', result));
                            }
                            else if (object.requestCode == MessageType.GetUsernameViaUserId.code) {
                                if (object.userId) {
                                    UserModel.findOne({'_id': object.userId}, function (err, user) {
                                        clients[connection.id].connection.send(createParametrizedResultTextData(SuccessCodes.UsernameViaUserId.Message, SuccessCodes.UsernameViaUserId.code, 'username', user));
                                    });
                                }
                                else {
                                    connection.send(createResultTextData(ErrorCodes.MissingUserId.code, ErrorCodes.MissingUserId.Message));
                                }
                            }
                            else if (object.requestCode == MessageType.GetFriendList.code) {
                                clients[connection.id].connection.send(createParametrizedResultTextData(SuccessCodes.ListOfFriends.Message, SuccessCodes.ListOfFriends.code, 'friends', clients[connection.id].user.friends));
                            }
                            else if (object.requestCode == MessageType.CreateGroupRoom.code){
                                if(object.roomName){
                                    createGroupRoom(clients[connection.id], object.roomName);
                                }
                                else{
                                    connection.send(createResultTextData(ErrorCodes.MissingRoomName.code, ErrorCodes.MissingRoomName.Message));
                                }
                            }
                            else if (object.requestCode == MessageType.AddMemberToGroup.code){
                                if(!object.roomId){
                                    connection.send(createResultTextData(ErrorCodes.MissingRoomId.code, ErrorCodes.MissingRoomId.Message));
                                }
                                else if(!object.memberId){
                                    connection.send(createResultTextData(ErrorCodes.MissingUserId.code, ErrorCodes.MissingUserId.Message));
                                }
                                else{
                                    addMemberToRoom(clients[connection.id], object.roomId, object.memberId);
                                }
                            }
                            else if (object.requestCode == MessageType.GetGroupMembers.code){
                                if(!object.roomId){
                                    connection.send(createResultTextData(ErrorCodes.MissingRoomId.code, ErrorCodes.MissingRoomId.Message));
                                }
                                else{
                                    getRoomMembers(clients[connection.id], object.roomId);
                                }
                            }
                            else if (object.requestCode == MessageType.AddUserToFriend.code) {
                                if (object.username) {
                                    UserModel.findOne({'username': object.username}, function (err, user) {
                                        if (user) {
                                            var find = false;
                                            for (var i = 0; i < clients[connection.id].user.friends.length; i++) {
                                                if (clients[connection.id].user.friends[i].friendId == user.id) {
                                                    clients[connection.id].connection.send(createParametrizedResultTextData(SuccessCodes.FriendAddedSuccessfully.Message, SuccessCodes.FriendAddedSuccessfully.code, 'friend', clients[connection.id].user.friends[i]));
                                                    find = true;
                                                    break;
                                                }
                                            }
                                            if(!find) {
                                                var link = { friendId: user.id, beginner: clients[connection.id].user.id, status: false, friendUsername: user.username};
                                                clients[connection.id].user.friends.push(link);
                                                var link2 = { friendId: clients[connection.id].user.id, beginner: clients[connection.id].user.id, status: false, friendUsername: clients[connection.id].user.username};
                                                user.friends.push(link2);
                                                clients[connection.id].user.save(null);
                                                user.save(null);
                                                clients[connection.id].connection.send(createParametrizedResultTextData(SuccessCodes.FriendAddedSuccessfully.Message, SuccessCodes.FriendAddedSuccessfully.code, 'friend', link));
                                                announceFriendAdded(clients[connection.id].user.id, user.id);
                                            }
                                        }
                                        else {
                                            connection.send(createResultTextData(ErrorCodes.FriendUsernameDoesnotExist.code, ErrorCodes.FriendUsernameDoesnotExist.Message));
                                        }
                                    });
                                }
                                else {
                                    connection.send(createResultTextData(ErrorCodes.MissingUserId.code, ErrorCodes.MissingUserId.Message));
                                }
                            }
                            else if (object.requestCode == MessageType.AckOfTextMessage.code){
                                if(!object.eventId){
                                    connection.send(createResultTextData(ErrorCodes.MissingEventId.code, ErrorCodes.MissingEventId.Message));
                                }
                                else{
                                    getEventAck(clients[connection.id].user, object.eventId);
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

function getEventAck(user, eventId){
    try
    {
        UserModel.findOne({ '_id': user.id }).populate('nonDeliveredEvents').exec(function (err, newUser) {
            if (!err && newUser) {
                user = newUser;
                for (var i = 0; i < user.nonDeliveredEvents.length; i++) {
                    console.log(user.nonDeliveredEvents[i].id + " : " + eventId);
                    if(user.nonDeliveredEvents[i].id == eventId){
                        console.log("################### Get Delivered : " + eventId);
                        user.nonDeliveredEvents.splice(i, 1);
                        user.save();
                    }
                }
            }
        });
    }
    catch(ex){
        console.log(ex);
    }
}

function createParametrizedResultTextData2(message, code, paramName, paramValue, paramName2, paramValue2) {
    var result = {
        message: message,
        code: code
    };
    result[paramName] = paramValue;
    result[paramName2] = paramValue2;
    return JSON.stringify(result);
}

//OtherParty : id of other user
function createIndividualRoom(client, otherParty) {
    try {
        hasUserRelationToOther(client.user, otherParty, function (roomId) {
            console.log("Room exist : " + roomId);
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
            client.user.individuals.push(newRoom.id);
            client.user.save(null);
            client.connection.send(createParametrizedResultTextData(SuccessCodes.CreateRoomSuccessfully.Message, SuccessCodes.CreateRoomSuccessfully.code, 'roomId', newRoom.id));
            announceAddedToRoom(client.user.id, otherParty, newRoom.id);
            UserModel.findOne({ '_id': otherParty }, function (err, remote) {
                if (err) {
                    console.log('Could not find remote party');
                }
                else if (!remote) {
                    console.log('Could not find remote party');
                }
                else {
                    console.log("room added to remote party successfully");
                    console.log(remote);
                    remote.individuals.push(newRoom.id);
                    remote.save(null);
                }
            })
        });
    }
    catch (ex) {
        console.log(ex);
    }
}

function createGroupRoom(client, roomName){
    var newRoom = new RoomModel(
        {
            Type: 'G',
            StartType: 'Now',
            Creator: client.user.id
        }
    );
    newRoom.Admins.push(client.user.id);
    newRoom.Members.push(client.user.id);
    newRoom.save(null);
    newRoom.name = roomName;
    client.user.groups.push(newRoom.id);
    client.user.save(null);
    client.connection.send(createParametrizedResultTextData(SuccessCodes.CreateRoomSuccessfully.Message, SuccessCodes.CreateRoomSuccessfully.code, 'roomId', newRoom.id));
}

function getRoomMembers(client, roomId){
    RoomModel.findOne({'_id': roomId}).populate('Members').exec(function(err, room){
        if(err){
            console.log('error in publish event to room members');
            client.connection.send(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
        }
        if(!room){
            console.log('specific room not found');
            client.connection.send(createResultTextData(ErrorCodes.RoomDoesNotExist.Message, ErrorCodes.RoomDoesNotExist.code));
        }
        else{
            var result = [];
            for(var i = 0 ; i < room.Members.length ; i++){
                var ins = { memberId : room.Members[i].id,
                            memberUsername : room.Members[i].username};
                result.push(ins);
            }
            client.connection.send(createParametrizedResultTextData2(SuccessCodes.ListOfMembers.Message, SuccessCodes.ListOfMembers.code, 'members', newRoom.id, 'roomId', room.id));
        }
    });
}

function addMemberToRoom(client, roomId, memberId){
    RoomModel.findOne({'_id': roomId}).exec(function(err, room){
        if(err){
            console.log('error in publish event to room members');
            client.connection.send(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
        }
        if(!room){
            console.log('specific room not found');
            client.connection.send(createResultTextData(ErrorCodes.RoomDoesNotExist.Message, ErrorCodes.RoomDoesNotExist.code));
        }
        else{
            UserModel.findOne({'_id': memberId}).exec(function(err, member){
                if(err){
                    console.log(err);
                }
               if(!user){
                   console.log("not found");
               }
               else{
                   var isExist = false;
                   for(var i = 0 ; i < room.Members.length ; i++){
                       if(room.Members[i].id == member.id){
                           isExist = true;
                           break;
                       }
                   }
                   if(!isExist){
                       room.Members.push(member.id);
                       member.groups.push(room.id);
                       room.save(null);
                       member.save(null);
                       //Todo : announce to online user
                   }
               }
            });
        }
    });
}

function getGroupRooms(client){
    UserModel.findOne({'_id': clients[connection.id].user.id}).populate("groups").exec(function (err, users) {
        var result = [];
        for (var i = 0; i < users.groups.length; i++) {
            result[i] = users.groups[i];
        }
        client.connection.send(createParametrizedResultTextData(SuccessCodes.GroupContacts.Message, SuccessCodes.GroupContacts.code, 'rooms', result));
    });
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
        UserModel.findOne({ '_id': decoded.iss }).populate('nonDeliveredEvents').exec(function (err, user) {
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
        UserModel.findOne({ '_id': user.id }).populate('nonDeliveredEvents').exec(function (err, newUser) {
            if (!err && newUser) {
                user = newUser;
                for (var i = 0; i < user.nonDeliveredEvents.length; i++) {

                    var event = user.nonDeliveredEvents[i];
                    if (event.PublishType == 'Now') {
                        var msg = createEventMessage(event);
                        connection.send(msg);
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
        content: event.Content,
        roomId: event.RoomId,
        id: event.id
    };
    var result = {
        message: CommandList.NewMessage.Message,
        code: CommandList.NewMessage.code,
        value: val
    };
    return JSON.stringify(result);
}

function hasUserRelationToOther(me, other, exist, notExist) {
    try {
        console.log("check is two user make chat before ? ");
        UserModel.findOne({'_id': me.id}).populate('individuals').exec(function (err, user) {
            console.log(user);
            var e = false;
            var roomid;
            for (var i = 0; i < user.individuals.length; i++) {
                for (var j = 0; j < user.individuals[i].Members.length; j++) {
                    if (user.individuals[i].Members[j] == other) {
                        console.log('room id is : ' + user.individuals[i].id);
                        roomid = user.individuals[i].id;
                        e = true;
                        break;
                    }
                }
                if (e == true)
                    break;
            }
            if (e == true) {
                exist(roomid);
            }
            else {
                notExist();
            }

        });
    }
    catch (ex) {
        console.log(ex);
    }
};


module.exports.announceFriendAdded = announceFriendAdded;
module.exports.announceAddedToRoom = announceAddedToRoom;
module.exports.initWebSocket = initWebSocket;