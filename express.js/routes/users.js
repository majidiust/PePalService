var express = require('express');
var router = express.Router();
var userModel = require("../models/user").UserModel;
var tokenModel = require("../models/token").TokenModel;
var authController = require('../controllers/auth');
var jwt = require('jwt-simple');
var moment = require('moment')
var datejs = require('safe_datejs');

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
        username            :   req.body.phonenumber,
        hashedpassword      :   req.body.password,
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
    res.json(req.user.getBrief());
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


module.exports = router;
module.exports.requireAuthentication = requireAuthentication;