var express = require('express');
var router = express.Router();
var userModel = require("../models/user").UserModel;
var tokenModel = require("../models/token").TokenModel;
var authController = require('../controllers/auth');
var rtcConnection = require('../websocket/chat-server');
var jwt = require('jwt-simple');
var moment = require('moment');
var datejs = require('safe_datejs');
var fs = require('fs');
var path = require('path');
var ErrorCodes = require('../libs/error-codes').AuthResultCode;
var SuccessCodes = require('../libs/success-codes').SuccessCode;
var CommandList = require('../libs/cmd-list').WebsocketCommandList;
var rtCore = require("../websocket/chat-server");

/*----------------------------------- Uploader module ------------------------*/
var options;
options = {
    tmpDir: __dirname + '/../public/uploaded/tmp/profiles',
    uploadDir: __dirname + '/../public/uploaded/profiles',
    uploadUrl: '/uploaded/profiles/',
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
/*------------------------------------------ Functions ----------------------------------*/
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


var requireAuthentication = function (req, res, next) {
    try {
        if (req.headers.token != undefined) {
            var decoded = jwt.decode(req.headers.token, "729183456258456");
            if (decoded.exp <= Date.now) {
                res.send("Access token has expired", 406);
            }
            userModel.findOne({ '_id': decoded.iss }, function (err, user) {
                if (user) {
                    tokenModel.find({ token: req.headers.token, state: true, userId: user.id }, function (err, tokens) {
                        if (tokens.length > 0) {
                            req.user = user;
                            return next();
                        }
                        else {
                            res.send("Not authorized", 401);
                        }
                    })
                }
                else {
                    res.send("Not authorized", 401);
                }
            });
        }
        else {
            res.send("Not authorized", 401);
        }
    }
    catch(ex){
        console.log(ex);
        res.send(ex, 500);
    }
}

function disableOtherAccounts(userId){
    var today = new Date();
    var conditions = { userId: userId }
        , update = { stete: true, deleted: today.AsDateJs() }
        , options = { multi: true };
    tokenModel.update(conditions, update, options, function (err, numAffected) {
        if (err)
            console.log(err);
        else {
            console.log("Number of updated is : " + numAffected);
        }
    });
}

function updateUserActivity(activity, user)
{
    user.activities.push({ activityname: activity, activitydate : (new Date()).AsDateJs() });
    user.save(null);
}

function signout(req, res){
    try {
        tokenModel.findOne({ token: req.headers.token, userId: req.user.userId }, function (err, token) {
            if (err) {
                res.send(err, 500);
            }
            else if(!token){
                res.send("", 404);
            }
            else {
                token.state = false;
                token.save(function (err) {
                    if (err)
                        res.send(err, 500);
                    else {
                        res.send("", 202);
                    }
                    console.log("token updated successfully");
                });
            }
        });
    }
    catch(ex){
        console.log(ex);
        res.send(ex, 500);
    }
}

function signin(req, res){
    var userName = req.body.username;
    var password = req.body.password;
    var error = false;
    if(!userName){
        error = true;
        res.send('{parameters:"[userName]"}', 400);
    }
    if(!password){
        error = true;
        res.send('{parameters:"[password]"}', 400);
    }

    if(error == false) {
        userModel.findOne({ username: userName }, function (err, user) {
            if (err) {
                console.log(err);
                res.send("Authentication error: error in fetching data", 500);
            }
            else {
                if (!user) {
                    console.log("user " + userName + " not found");
                    res.send("{ message : 'Authentic ation error : user not found'}", 404);
                }
                else {
                    user.verifyPassword(password, function (err, isMatch) {
                        if (err) {
                            console.log(err);
                            res.send("Authentication error: error in verify password", 500);
                        }
                        else {
                            if (!isMatch) {
                                console.log("Authentication error : password is wrong");
                                res.send("Authentication error : password is wrong", 406);
                            }
                            else {
                                console.log("disabling other tokens for user  : " + userName);
                                updateUserActivity("signin", user);
                                disableOtherAccounts(user.id);
                                console.log("alocationg new token for user  : " + userName);
                                var expires = moment().add('days', 7).valueOf();
                                var token = jwt.encode({
                                        iss: user.id,
                                        exp: expires
                                    },
                                    "729183456258456"
                                );
                                var newTokenIns = new tokenModel({
                                    userId: user.id,
                                    token: token,
                                    exp: expires
                                });
                                newTokenIns.save(function (err) {
                                    if (err) {
                                        console.log("Error in saveing token in database : " + err);
                                    }
                                    else {
                                        console.log("Token saved successfully");
                                    }
                                });
                                res.send({ token: token }, 202);
                            }
                        }
                    });
                }
            }
        });
    }
}

function signup(req, res){
    console.log("Signup new user");
    var error =false;
    if(!req.body.phonenumber || !req.body.password || !req.body.email)
    {
        error = true;
        console.log("Bad params");
        res.send("", 400);
    }
    else {
        var user = new userModel({
            username: req.body.phonenumber,
            hashedpassword: req.body.password,
            email: req.body.email,
            salt: "1",
            isaproved: false,
            islockedout: false
        });
        console.log(user);
        user.roles.push({ rolename: 'user' });
        user.activities.push({ activityname: 'signup', activitydate: (new Date()).AsDateJs() });
        user.save(function (err) {
            if (err)
                res.send(err, 409);
            else
                res.send({username: user.username}, 201);
        });
    }
}

function updateProfie(req, res){
    console.log("update profile");
    var conditions = { username: req.user.username }
        ,   options = { multi: true };
    var update = Object.create(null);
    for(var field in req.body){
        if (field.toString() != 'username' && field.toString() != 'password') {
            console.log(field + ":" + req.body[field]);
            update[field.toString()] = req.body[field];
        }
    }
    console.log(update);
    userModel.update(conditions, update, options, function (err, numAffected) {
        if (err) {
            console.log(err);
            res.send(err, 401);
        }
        else {
            console.log("Number of updated is : " + numAffected);
            res.send('Profile updated successfully', 201);
        }
    });
}

function getUserList(req, res){
    //save activities
    updateUserActivity("getUserList", req.user);
    userModel.find(function (err, users) {
        if (err)
            res.send(err, 401);
        else {
            var results = [];
            for (var i = 0; i < users.length; i++)
                if(users[i].id != req.user.id)
                    results.push(users[i].getBrief());
            }
            res.json(results);
    });
}

function getUser(req, res){
    updateUserActivity("getUser", req.user);
    console.log("Get user by email : " + req.params.email);
    if(req.params.email){
        userModel.findOne({ email: req.params.email }, function (err, user) {
            res.json(user.getBrief());
        });
    }
}

function getCurrentProfile(req, res){
    res.send(req.user.getBrief(), 302);
}

function getIndividualContacts(req, res){
    userModel.findOne({'_id':req.user.id}).populate("individuals").exec(function(err, users){
       var result = [];
       for(var i = 0 ; i < users.individuals.length ; i++){
            result[i] = users.individuals[i];
       }
       res.json(result);
    });
}

function getGroupContacts(req, res){
    userModel.findOne({'_id':req.user.id}).populate("groups").exec(function(err, users){
        var result = [];
        for(var i = 0 ; i < users.groups.length ; i++){
            result[i] = users.groups[i];
        }
        res.json(result);
    });
}

function getUsernameViaUserId(req, res){
    userModel.findOne({'_id':req.params.userId}, function(err, user){
        res.json(user);
    });
}

function getExtension(filename) {
    var i = filename.lastIndexOf('.');
    return (i < 0) ? '' : filename.substr(i);
}


function uploadProfilePic(req, res){
    var tmpUser = req.user;
    uploader.post(req, res, function (obj) {
        if(obj.files) {
            var fileName = obj.files[0].name;
            var extension = getExtension(fileName);
            console.log("@@@@ " + fileName);
            try {
                fs.renameSync(options.uploadDir + '/' + fileName, options.uploadDir + '/' + tmpUser.id + extension);
            } catch (err) {
                res.send(err, 400);
            }
        }
        else{
            console.log("no more files");
        }
    });
    res.send('File pic uploaded', 200);
}

function getUserProfile(req, res){
    //Pic url profile, username, email, firstName, lastName
    var result = {};
    var ext,
        picFileName = '';
    var fileName = fs.readdirSync(options.uploadDir);
    fileName.forEach(function(value){
        ext = getExtension(value);
        console.log(value, req.user.id + ext)
       if(fileName == req.user.id + ext){
          picFileName = value;
       } else {
           picFileName = '';
       }
    });
    if(picFileName != ''){
        result = {userName: req.user.username, firstName: req.user.firstname, lastName: req.user.lastname,
            email: req.user.email, picUrl: '/uploaded/profiles/' + picFileName};
    } else {
        result = {userName: req.user.username, firstName: req.user.firstname,
            lastName: req.user.lastname, email: req.user.email, picUrl: null};
    }

    res.send(result, 200);


}

function getSpecificUserProfile(req, res){
    if(!req.params.userId)
        res.send('{parameters:"[userId]"}', 400);
    else {
        userModel.findOne({'_id': req.params.userId}).exec(function(err, user){
            if(err)
                res.send(err, 500);
            else if(!user){
                res.send("User not found", 403);
            }
            else {
                var result = {};
                var ext,
                    picFileName = '';
                var fileName = fs.readdirSync(options.uploadDir);
                fileName.forEach(function(value){
                    ext = getExtension(value);
                    console.log(value, user.id + ext)
                    if(fileName == user.id + ext){
                        picFileName = value;
                    } else {
                        picFileName = '';
                    }
                });
                if(picFileName != ''){
                    result = {id: req.params.userId, userName: user.username, firstName: user.firstname, lastName: user.lastname,
                        email: user.email, picUrl: '/uploaded/profiles/' + picFileName};
                } else {
                    result = {id: req.params.userId, userName: user.username, firstName: user.firstname,
                        lastName: user.lastname, email: user.email, picUrl: null};
                }
                res.send(result, 200);
            }
        });
    }
}

function saveProfile(req, res){
    // lastName and firstName save user model schema
    var firstName,
        lastName,
        email;
    firstName = req.body.firstName;
    lastName = req.body.lastName;
    email = req.body.email;
    if(!firstName && !lastName){
        res.send('We need [firstName, lastName] parameters', 400);
    }

    req.user.firstname = firstName;
    req.user.lastname = lastName;
    if(email)
        req.user.email = email;

    req.user.save(null);

    res.send('send profile successfully', 200);

}

function changeProfilePic(req, res){
    var ext;
    var fileName = fs.readdirSync(options.uploadDir);

    fileName.forEach(function(value){
        ext = getExtension(value);
        if(req.user.id + ext == value){
            console.log(value);
            fs.unlinkSync(path.join(options.uploadDir, req.user.id + ext), function(err){
                if(err) throw err;
            });
            uploadProfilePic(req, res);
        }
    });
    res.send('We do not have a picture of you', 300);
}

function changeTheStatus(req, res){
    try{
        req.user.status = req.params.status;
        req.user.save(null);
        rtcConnection.announceUserStateChanged(req.user);
        res.json(req.user.getSummery());
    }
    catch(ex){
        console.log(ex);
        res.send(ex, 500);
    }
}

function addFriendToTheList(req, res) {
    try {
        var username = req.params.username;
        console.log(username);
        userModel.findOne({'username': username}, function (err, user) {
            if (user) {
                var find = false;
                for (var i = 0; i < req.user.friends.length; i++) {
                    if (req.user.friends[i].friendId == user.id) {
                        res.send(createParametrizedResultTextData(SuccessCodes.FriendAddedSuccessfully.Message, SuccessCodes.FriendAddedSuccessfully.code, 'friend', req.user.friends[i]));
                        find = true;
                        break;
                    }
                }
                if (!find) {
                    var link = { friendId: user.id, beginner: req.user.id, status: false, friendUsername: user.username};
                    req.user.friends.push(link);
                    var link2 = { friendId: req.user.id, beginner: req.user.id, status: false, friendUsername: req.user.username};
                    user.friends.push(link2);
                    req.user.save(null);
                    user.save(null);
                    rtCore.announceFriendAdded(user.id, req.user.id);
                    res.send(createParametrizedResultTextData(SuccessCodes.FriendAddedSuccessfully.Message, SuccessCodes.FriendAddedSuccessfully.code, 'friend', link));
                }
            }
            else {
                res.send(createResultTextData(ErrorCodes.FriendUsernameDoesnotExist.Message,ErrorCodes.FriendUsernameDoesnotExist.code));
            }
        });
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500)
    }
}

function getFriendList(req, res){
    try{
        res.send(createParametrizedResultTextData(SuccessCodes.ListOfFriends.Message, SuccessCodes.ListOfFriends.code, 'friends', req.user.friends));
    }
    catch(ex){
        console.log(ex);
        res.send(ex, 500);
    }
}

function announceTyping(req, res) {
    try {
        rtcConnection.announceUserTyping(req.user, req.params.roomId);
        res.json(req.user.getSummery());
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function getUserSummery(req, res){
    try{
        var founded = false;
        for(var i = 0 ; i < req.user.friends.length; i++){
            if(req.params.friendId == req.user.friends[i].friendId){
                founded = true;
                userModel.findOne({'_id': req.params.friendId}).exec(function(err, friend){
                    res.json(friend.getSummery());
                });
                break;
            }
        }
        if(!founded)
            res.send("Not found", 403);
    }
    catch(ex){
        console.log(ex);
        res.send(ex, 500);
    }
}

// ----------------------------------------------- Routes
router.route('/signout').post(requireAuthentication, signout);
router.route('/signin').post(signin);
router.route('/signup').post(signup);
router.route('/updateProfile').post(requireAuthentication, updateProfie);
router.route('/getUserByMail/:email').get(requireAuthentication, getUser);
router.route('/userList').get(requireAuthentication, getUserList);
router.route('/getCurrentProfile').get(requireAuthentication, getCurrentProfile);
router.route('/getIndividualContacts').get(requireAuthentication, getIndividualContacts);
router.route('/getGroupContacts').get(requireAuthentication, getGroupContacts);
router.route('/getUsernameViaUserId/:userId').get(requireAuthentication, getUsernameViaUserId);
router.route('/addFriendToTheList/:username').get(requireAuthentication, addFriendToTheList);
router.route('/getFriendList').get(requireAuthentication, getFriendList);
router.route('/changeTheStatus/:status').get(requireAuthentication, changeTheStatus);
router.route('/getFriendSummery/:friendId').get(requireAuthentication, getUserSummery);
router.route('/announceTyping/:roomId').get(requireAuthentication, announceTyping);
//Upload Profile Pic and Save Profile
router.route('/uploadProfilePic').post(requireAuthentication, uploadProfilePic);
router.route('/changeProfilePic').post(requireAuthentication, changeProfilePic);
router.route('/getUserProfile').get(requireAuthentication, getUserProfile);
router.route('/getUserProfile/:userId').get(requireAuthentication, getSpecificUserProfile);
router.route('/saveProfile').post(requireAuthentication, saveProfile);
module.exports = router;
module.exports.requireAuthentication = requireAuthentication;
























