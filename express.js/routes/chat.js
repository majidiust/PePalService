/**
 * Created by Majid on 8/15/2014.
 */
var express = require('express');
var UserModel = require('../models/user').UserModel;
var userControl = require("./users");
var moment = require('moment')
var datejs = require('safe_datejs');
var EntityModel = require('../models/chat').EntityModel;
var RoomModel = require('../models/chat').RoomModel;
var ErrorCodes = require('../libs/error-codes').AuthResultCode;
var SuccessCodes = require('../libs/success-codes').SuccessCode;
var CommandList = require('../libs/cmd-list').WebsocketCommandList;
var rtCore = require("../websocket/chat-server");
var fs = require('fs');
var path = require('path');

var router = express.Router();


/*----------------------------------- Uploader module ------------------------*/
var options;
options = {
    tmpDir: __dirname + '/../public/uploaded/tmp/entities',
    uploadDir: __dirname + '/../public/uploaded/entities',
    uploadUrl: '/uploaded/entities/',
    maxPostSize: 11000000000, // 11 GB
    minFileSize: 1,
    maxFileSize: 10000000000, // 10 GB
    acceptFileTypes: /\.(gif|jpe?g|png)/i,
    // Files not matched by this regular expression force a download dialog,
    // to prevent executing any scripts in the context of the service domain:
    inlineFileTypes: /\.(gif|jpe?g|png)/i,
    imageTypes: /\.(gif|jpe?g|png)/i,
    imageVersions: {
        width: 80,
        height: 80
    },
    accessControl: {
        allowOrigin: '*',
        allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE',
        allowHeaders: 'Content-Type, Content-Range, Content-Disposition'
    }
};

// init the uploader
var uploader = require('blueimp-file-upload-expressjs')(options);

//------------------------------------Helpers
function createParametrizedResultTextData(message, code, paramName, paramValue) {
    var result = {
        message: message,
        code: code
    };
    result[paramName] = paramValue;
    return (result);
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
function createResultTextData(message, code) {
    return ({ message: message, code: code });
};
//------------------------------------Routes call backs
//OtherParty : id of other user
var createIndividualRoom = function (req, res) {
    try {
        if (!req.body.otherParty) {
            res.json(createResultTextData(ErrorCodes.MissingOtherParty.code, ErrorCodes.MissingOtherParty.Message));
        }
        else {
            hasUserRelationToOther(req.user, req.body.otherParty, function (roomId) {
                console.log("Room exist : " + roomId);
                res.json(createParametrizedResultTextData(SuccessCodes.RoomExist.Message, SuccessCodes.RoomExist.code, 'roomId', roomId));
            }, function () {
                //Create Room Instance
                var newRoom = new RoomModel(
                    {
                        Type: 'I',
                        StartType: 'Now',
                        Creator: req.user.id
                    }
                );
                newRoom.Admins.push(req.user.id);
                newRoom.Admins.push(req.body.otherParty);
                newRoom.Members.push(req.user.id);
                newRoom.Members.push(req.body.otherParty);
                newRoom.save(function(err){
                    if(err)
                    res.send(err, 401);
                    else{
                        req.user.individuals.push(newRoom.id);
                        req.user.save(null);
                        UserModel.findOne({ '_id': req.body.otherParty }, function (err, remote) {
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
                                rtCore.announceAddedToRoom(req.user.id, req.body.otherParty, newRoom.id);
                                res.json(createParametrizedResultTextData(SuccessCodes.CreateRoomSuccessfully.Message, SuccessCodes.CreateRoomSuccessfully.code, 'roomId', newRoom.id));
                            }
                        })
                    }
                });

            });
        }
    }
    catch (ex) {
        console.log(ex);
    }
};
function sendTextMessageTo(req, res) {

    if (!req.body.roomId) {
        res.json(createResultTextData(ErrorCodes.RoomIdIsEmpty.code, ErrorCodes.RoomIdIsEmpty.Message));
        return;
    }
    var publishType = 'Now';
    var roomId = req.body.roomId;

    if (req.body.publishType) {
        if (req.body.publishType == 'Now' || req.body.publishType == 'Scheduled') {
            publishType = req.body.publishType;
        }
        else {
            res.json(createResultTextData(ErrorCodes.InvalidEventPublishType.code, ErrorCodes.InvalidEventPublishType.Message));
            return;
        }
    }
    if (publishType == 'Scheduled') {
        if (!req.body.publishDate) {
            res.json(createResultTextData(ErrorCodes.InvalidEventPublishDate.code, ErrorCodes.InvalidEventPublishDate.Message));
            return;
        }
    }


    RoomModel.findOne({'_id': roomId})
        .populate('Members')
        .exec(function (err, room) {
            if (err) {
                console.log('error in publish event to room members : ' + err);
                res.json(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
            }
            else if (!room) {
                console.log('specific room not found');
                res.json(createResultTextData(ErrorCodes.RoomDoesNotExist.Message, ErrorCodes.RoomDoesNotExist.code));
            }
            else {
                /*
                 *    1.save event in event document
                 *    2.save event ref to room event collection
                 *    3.push event ref to room members queue
                 */
                var event = new EntityModel({
                    Type: 'Text',
                    Content: req.body.messageContent,
                    Creator: req.user.id,
                    CreatorUserName: req.user.username,
                    PublishType: publishType,
                    RoomId: roomId
                });
                event.save(function (err) {
                    if (err) {
                        console.log('error in inserting event in document ' + err);
                        res.json(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
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
                                    res.json(createResultTextData(ErrorCodes.PushEventToUSerError.Message, ErrorCodes.PushEventToUSerError.code));
                                } else {
                                    console.log('event ublished successfully');
                                    res.json(createResultTextData(SuccessCodes.EventPostedSuccessfully.Message, SuccessCodes.EventPostedSuccessfully.code));
                                }
                            });
                        }
                    }
                });
            }
        });
}

function sendPictureMessageTo(req, res) {
    if (!req.params.roomId) {
        res.json(createResultTextData(ErrorCodes.RoomIdIsEmpty.code, ErrorCodes.RoomIdIsEmpty.Message));
        return;
    }
    var publishType = 'Now';
    var roomId = req.params.roomId;

    if (req.params.publishType) {
        if (req.params.publishType == 'Now' || req.params.publishType == 'Scheduled') {
            publishType = req.params.publishType;
        }
        else {
            res.json(createResultTextData(ErrorCodes.InvalidEventPublishType.code, ErrorCodes.InvalidEventPublishType.Message));
            return;
        }
    }
    if (publishType == 'Scheduled') {
        if (!req.params.publishDate) {
            res.json(createResultTextData(ErrorCodes.InvalidEventPublishDate.code, ErrorCodes.InvalidEventPublishDate.Message));
            return;
        }
    }

    uploader.post(req, res, function (obj) {
        try {
            console.log(obj);
            if(obj.files.length > 0) {
                var fileName = obj.files[0].name;
                var extension = getExtension(fileName);


    console.log("###################################");
    RoomModel.findOne({'_id': roomId})
        .populate('Members')
        .exec(function (err, room) {
            if (err) {
                console.log('error in publish event to room members : ' + err);
                res.json(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
            }
            else if (!room) {
                console.log('specific room not found');
                res.json(createResultTextData(ErrorCodes.RoomDoesNotExist.Message, ErrorCodes.RoomDoesNotExist.code));
            }
            else {
                /*
                 *    1.save event in event document
                 *    2.save event ref to room event collection
                 *    3.push event ref to room members queue
                 */
                var event = new EntityModel({
                    Type: 'Picture',
                    Content: "...",
                    Creator: req.user.id,
                    CreatorUserName: req.user.username,
                    PublishType: publishType,
                    RoomId: roomId
                });
                console.log(event);
                event.save(function (err) {
                    if (err) {
                        console.log('error in inserting event in document ' + err);
                        res.json(createResultTextData(ErrorCodes.PushEventToRoomError.Message, ErrorCodes.PushEventToRoomError.code));
                    }
                    else {
                        console.log("Event save successfully");
                        room.Entities.push(event.id);
                        for (var i = 0; i < room.Members.length; i++) {
                            var user = room.Members[i];
                            user.nonDeliveredEvents.push(event.id);
                            user.save(function (err) {
                                if (err) {
                                    console.log('error in inserting event to user event queue');
                                    res.json(createResultTextData(ErrorCodes.PushEventToUSerError.Message, ErrorCodes.PushEventToUSerError.code));
                                } else {
                                    console.log('event published successfully');
                                    try {
                                        event.Content =  event.id + extension;
                                        event.save();
                                        fs.renameSync(options.uploadDir + '/' + fileName, options.uploadDir + '/' + event.id + extension);
                                    }
                                    catch(ex){
                                        console.log("!!!!!!!!!!!!!!! " + ex);
                                    }
                                    res.json(createResultTextData(SuccessCodes.EventPostedSuccessfully.Message, SuccessCodes.EventPostedSuccessfully.code));
                                }
                            });
                        }
                    }
                });
            }
        });
            }
        } catch (err) {
            console.log("@@@ : " + err);
        }
    });
}

function getExtension(filename) {
    var i = filename.lastIndexOf('.');
    return (i < 0) ? '' : filename.substr(i);
}


function getIncomingMessage(req, res) {
    UserModel.findOne({'_id': req.user}).populate('nonDeliveredEvents').exec(function (err, user) {
        if (user.nonDeliveredEvents.length > 0) {
            var event = user.nonDeliveredEvents[0];
            var val = {
                type: event.Type,
                date: event.CreateDate,
                fromId: event.Creator,
                from: event.CreatorUserName,
                content: event.Content,
                roomId : event.RoomId,
                id: event.id
            };
            var result = {
                message: CommandList.NewMessage.Message,
                code: CommandList.NewMessage.code,
                value: val
            };
            user.nonDeliveredEvents.splice(0, 1);
            user.save();
            res.send(result);
        }
        else{
            res.send(createResultTextData(SuccessCodes.NoMoreMessage.Message, SuccessCodes.NoMoreMessage.code), 401);
        }
    });
}
//-------------------------------------Routes
router.route('/createIndividualRoom').post(userControl.requireAuthentication, createIndividualRoom);
router.route('/sendTextMessageTo').post(userControl.requireAuthentication, sendTextMessageTo);
router.route('/getIncomingMessage').get(userControl.requireAuthentication, getIncomingMessage);
router.route('/sendPictureMessageTo/:roomId/:publishType/:publishDate').post(userControl.requireAuthentication, sendPictureMessageTo);

module.exports = router;
