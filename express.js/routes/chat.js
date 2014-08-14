/**
 * Created by Majid on 8/15/2014.
 */
var express = require('express');

var User = require('../models/user').UserModel;
var userControl = require("./users");
var moment = require('moment')
var datejs = require('safe_datejs');
var EntityModel = require('../models/chat').EntityModel;
var RoomModel = require('../models/chat').RoomModel;
var ErrorCodes = require('../libs/error-codes').AuthResultCode;
var SuccessCodes = require('../libs/success-codes').SuccessCode;

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

function hasUserRelationToOther(me, other, exist, notExist){
    try{
        console.log("check is two user make chat before ? ");
        User.findOne({'_id':me.id}).populate('individuals').exec(function (err, user) {
            console.log(user);
            var e = false;
            var roomid ;
            for(var i = 0 ; i < user.individuals.length ; i++){
                for(var j = 0 ;  j < user.individuals[i].Members.length ; j++){
                    if(user.individuals[i].Members[j] == other) {
                        console.log('room id is : ' + user.individuals[i].id);
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
        if(!req.body.otherParty){
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
                newRoom.save(null);
                req.user.individuals.push(newRoom.id);
                req.user.save(null);
                res.json(createParametrizedResultTextData(SuccessCodes.CreateRoomSuccessfully.Message, SuccessCodes.CreateRoomSuccessfully.code, 'roomId', newRoom.id));
                User.findOne({ '_id': req.user.id }, function (err, remote) {
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
    }
    catch (ex) {
        console.log(ex);
    }
};

//-------------------------------------Routes
router.route('/createIndividualRoom').post(userControl.requireAuthentication, createIndividualRoom);

module.exports = router;
