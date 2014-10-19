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
var router = express.Router();
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
function getIncomingMessage(req, res) {
    UserModel.findOne({'_id': req.user}).populate('nonDeliveredEvents').exec(function (err, user) {
        if (user.nonDeliveredEvents.length > 0) {
            var event = user.nonDeliveredEvents[0];
            var val = {
                type: 'Text',
                date: event.CreateDate,
                from: event.CreatorUserName,
                content: event.Content,
                roomId : event.RoomId
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
module.exports = router;
