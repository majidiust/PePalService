/**
 * New node file
 */
var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');


//Define our user schema
var UserSchema   = new mongoose.Schema({
  userName: {type: String ,  unique: true},
  password: String,
  salt: String,
  verified: Boolean,
  accountState : Boolean,
  registerDate : Date,
  firstName : String,
  lastName : String,
  birthDate : String,
  gender : Boolean,
  email :  {type: String ,  unique: true},
  wallPapaerPhoto : String
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
  //  console.log("Salt is : " + this.salt);
  // var pwd = this.password;
  //  console.log("old Password is : " + pwd);
  //  console.log("New password is : " + password);
  //  bcrypt.hash(password, this.salt, null, function (err, hash) {
  //      console.log("verify password : " + hash + " : " + pwd);
  //      if (err) return cb(err);
  //      if (hash == pwd)
  //          cb(null, true);
  //      else
  //          cb(null, false);
  //  });
  //
      bcrypt.compare(password, this.password, function (err, isMatch) {
          console.log("verify password : " + password + " : " + isMatch);
          if (err) return cb(err);
          cb(null, isMatch);
      });
};

module.exports = mongoose.model('User', UserSchema);