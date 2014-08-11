var express = require('express');
var router = express.Router();
var User = require('../models/user');
var TokenModel = require('../models/token');
var authController = require('../controllers/auth');
var jwt = require('jwt-simple');
var moment = require('moment')
var datejs = require('safe_datejs');

var requireAuth = function(req, res, next) {
    if(req.headers.token != undefined)
    {
        var decoded = jwt.decode(req.headers.token, "729183456258456");
        console.log("Token expired in : " + decoded.exp);
        if (decoded.exp <= Date.now()) {
	        res.send('Access token has expired', 400)				
        }
	    User.findOne({ '_id': decoded.iss }, function(err, user){
		    if (!err) {
                TokenModel.find({token : req.headers.token, state: true, userId: user.id}, function(err, tokens){
                    if(tokens.length > 0)
                        {
                            console.log("find user token");
                             req.user = user;									
			                 return next();
                     }
                     else{
                           res.end('Not authorized', 401)
                     }
                });					
			   
		    }
            else{
                res.end('Not authorized', 401)
            }
	    });
    }
    else{
           res.end('Not authorized', 401)
    }
}

router.route('/userlist').get(requireAuth, getUserList);
router.route('/logout').post(requireAuth, logoutUser);



function DisableOtherAccounts(userId)
{
    var today = new Date();
    var conditions = { userId : userId }
    , update = { state : false, deleted : today.AsDateJs()}
    , options = { multi: true };
    
    TokenModel.update(conditions, update, options, function (err, numAffected) {
        console.log(err);
        console.log("Number of updates record is : " + numAffected);
    });
}

function getUserList(req, res) {
    console.log("getUserList");
       User.find(function(err, users) {
        if (err)
          res.send(err);
        res.json(users);
      });
  }

/*
*   Logout from server
*/
function logoutUser(req, res){
    console.log("try to logout"); 
    console.log("username : " + req.user.userName);
    console.log("token is : " + req.headers.token);
    console.log("user id : " + req.user.id);
    TokenModel.findOne({token: req.headers.token, userId : req.user.id}, function(err, token){
      if (err) {console.log(err); return next(err); }
      token.state = false;
      //token.deleted = Date.now;
      token.save(function(err) {
        if (err) {console.log(err); return next(err); }
        else {
            res.json({state : true});
        }
        console.log("token updated successfully");
      });
    });

};

router.get('/users/:email', function (req, res) {
    if (req.params.email) {
        User.find({ email: req.params.email }, function (err, docs) {
            res.json(docs);
        });
    }
});




/*
*   Login to server
*/
router.post('/login', function (req, res){
    console.log("try to login");
    console.log("user name : " + req.body.userName);
    console.log("password : " + req.body.password);
    var username = req.body.userName;
	var password = req.body.password;
	User.findOne(
        { 
            userName: username 
        }, 
        function (err, user) {
            if (err) 
            { 
                console.log(err); 
                res.send('Authentication error : error in fetchig data', 401);
                return;
            }

            // No user found with that username
            if (!user) 
            { 
                console.log('user not found'); 
                res.send('Authentication error : user not found', 401);
                return;
            }
            // Make sure the password is correct
            user.verifyPassword(password, function (err, isMatch) {
                    if (err) 
                    {
                        console.log(err); 
                        res.send('Authentication error', 401);
                        return; 
                    }
                    // Password did not match
                    if (!isMatch) 
                    { 
                        res.send('Authentication error, password is incorrect', 401);
                        return;
                    }
                    // Success
                    console.log("Disable other accounts");
                    DisableOtherAccounts(user.id);
                    console.log("Token is : " + "729183456258456");
                    var expires = moment().add('days', 7).valueOf();
                    console.log("Expires is : " + expires);
                    console.log("User id : " + user.id);				
				    var token = jwt.encode(
							    {
								    iss: user.id,
								    exp: expires
							    }, 
							    "729183456258456"
						    );	
                    var newToken = new TokenModel({
                        userId : user.id,
                        token : token,
                        exp : expires
                    });		
                    newToken.save(function(err) {
                        if(err)
                        {
                            console.log("Error in saving token : " + err);
                        }
                        else{
                            console.log("Token saved successfully");
                        }
                        }
                    );			
		            res.json({token : token});
                    return;
            });
    });
});

/*
 * POST to adduser.
 */
router.post('/adduser', function(req, res) {
    console.log(req.body);
     console.log(req.params);
   var user = new User({
    userName: req.body.userName,
    password: req.body.password,
    salt: req.body.salt,
    vrified: req.body.vrified,
    accountState : req.body.accountState,
    registerDate : new Date(),
    firstName : req.body.firstName,
    lastName : req.body.lastName,
    birthDate : req.body.birthDate,
    gender : req.body.gender,
    email : req.body.email,
    wallPapaerPhoto : "wallPapaerPhoto"
  });
  console.log(user);
  user.save(function(err) {
    if (err)
      res.send(err);
    res.json({ message: 'New user added to data bases successfully!' });
  });
});

/*
 * DELETE to deleteuser.
 */
router.delete('/deleteuser/:id',requireAuth, function(req, res) {
    var db = req.db;
    var userToDelete = req.params.id;
    db.collection('userlist').removeById(userToDelete, function(err, result) {
        res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
    });
});


module.exports = router;