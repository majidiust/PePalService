var express = require('express');
var userModel = require("../models/user").UserModel;
var tokenModel = require("../models/token").TokenModel;
var jwt = require("jwt-simple");
var moment = require("moment");
var datejs = require("safe_datejs");

var router = express.Router();


var requireAuthentication = function (req, res, next) {
    if (req.headers.token != undefined) {
        var decoded = jwt.decode(req.headers.token, "729183456258456");
        if (decoded.exp <= Date.now) {
            res.send("Access token has expired", 400);
        }
        userModel.findOne({ '_id': decoded.iss }, function (err, user) {
            if (!err) {
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
    tokenModel.findOne({ token: req.headers.token, userId: req.user.userId }, function (err, token) {
        if (err) {
            return next(err);
        }
        else {
            token.state = false;
            token.save(function (err) {
                if (err)
                    return next(err);
                else {
                    res.json({ state: true });
                }
                console.log("token updated successfully");
            });
        }
    });    
}

function signin(req, res){
    var userName = req.body.username;
    var password = req.body.password;
    userModel.findOne({ username: userName }, function (err, user) {
        if (err) {
            console.log(err);
            res.send("Authentication error: error in fetching data", 401);
            return;
        }
        else {
            if (!user) {
                console.log("user " + userName + " not found");
                res.send("Authentic ation error : user not found", 401);
                return;
            }
            else {
                user.verifyPassword(password, function (err, isMatch) {
                    if (err) {
                        console.log(err);
                        res.send("Authentication error: error in verify password", 401);
                        return;
                    }
                    else {
                        if (!isMatch) {
                            console.log("Authentication error : password is wrong");
                            res.send("Authentication error : password is wrong", 401);
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
                                res.json({ token: token });
                                return;
                            });
                        }
                    }
                });
            }
        }
    });
}

function signup(req, res){
    console.log("Signup new user");
    var user = new userModel({
        username            :   req.body.username,
        hashedpassword      :   req.body.password,
        firstname           :   req.body.firstName,
        lastname            :   req.body.lastName,
        gender              :   req.body.gender,
        email               :   req.body.email,
        salt                :   "1",
        isaproved           :   false,
        islockedout         :   false
    });
    console.log(user);
    user.roles.push({ rolename: 'user' });
    user.activities.push({ activityname: 'signup', activitydate : (new Date()).AsDateJs() });
    user.save(function (err) {
        if (err)
            res.send(err, 401);
        else
            res.json({message: 'user added to database successfully'});
    });
}

function getUserList(req, res){
    
    //save activities
    updateUserActivity("getUserList", req.user);
    userModel.find(function (err, users) {
        if (err)
            res.send(err, 401);
        else {
           
            res.json(users);
        }
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
/*
*   Register user apis
*/


router.route('/signout').post(requireAuthentication, signout);
router.route('/signin').post(signin);
router.route('/signup').post(signup);
router.route('/userList').get(requireAuthentication, getUserList);
router.route('/getUserByMail/:email').get(requireAuthentication, getUser);


module.exports = router;
module.exports.requireAuthentication = requireAuthentication;
module.exports.updateUserActivity = updateUserActivity;