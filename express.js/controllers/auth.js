// Load required packages
var passport = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;
var User = require('../models/user');
var log = require('../log/log');
passport.use(new BasicStrategy(
  function (username, password, callback) {
      //console.log("Try to find : " + username);
      log.info('Try to find :' + username);
      User.findOne({ userName: username }, function (err, user) {
          if (err) { //console.log(err); 
            log.error(err);
            return callback(err); }

          // No user found with that username
          if (!user) { 
            //console.log('user not found');
            log.info('user not found');
            return callback(null, false); 
          }

          // Make sure the password is correct
          user.verifyPassword(password, function (err, isMatch) {
              if (err) {//console.log(err); 
                log.error(err);
                return callback(err); }

              // Password did not match
              if (!isMatch) { return callback(null, false); }

              // Success
              return callback(null, user);
          });
      });
  }
));



exports.isAuthenticated = passport.authenticate('basic', { session : false });
exports.passport = passport;