/**
 * New node file
 */
var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var datejs = require('safe_datejs');
var EntityModel = require('./chat').EntityModel;
var RoomModel = require('./chat').RoomModel;
//Define our user schema
var UserSchema   = new mongoose.Schema({
  userName: {type: String ,  unique: true},
  password: String,
  salt: String,
  verified: Boolean,
  accountState : Boolean,
  registerDate : {type: Date, default: (new Date()).AsDateJs()},
  firstName : String,
  lastName : String,
  birthDate : String,
  gender : Boolean,
  email :  {type: String ,  unique: true},
  wallPapaerPhoto : String,
  groups : [{type: mongoose.Schema.ObjectId, ref:'Room'}],
  individuals : [{type: mongoose.Schema.ObjectId, ref:'Room'}],
  nonDeliveredEvents : [{type: mongoose.Schema.ObjectId, ref:'Entity'}]
});


UserSchema.pre('save', function (callback) {
    console.log('pre saved of user');
    var user = this;
    // Break out if the password hasn't changed
    if (!user.isModified('password')) return callback();

    // Password changed so we need to hash it
    bcrypt.genSalt(5, function (err, salt) {
        if (err) return callback(err);

        bcrypt.hash(user.password, salt, null, function (err, hash) {
            if (err) return callback(err);
            user.password = hash;
            user.salt = salt;
            callback();
        });
    });
});

UserSchema.methods.verifyPassword = function (password, cb) {
      bcrypt.compare(password, this.password, function (err, isMatch) {
          console.log("verify password : " + password + " : " + isMatch);
          if (err) return cb(err);
          cb(null, isMatch);
      });
};

module.exports = mongoose.model('User', UserSchema);