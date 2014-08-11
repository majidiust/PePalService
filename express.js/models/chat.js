var mongoose = require('mongoose');
var UserModel = require('./user');
var datejs = require('safe_datejs');

var EntitySchema = new mongoose.Schema({
    Type : {type: String, required: true}, // IM/audio/video/smily
    CreateDate : {type: Date, default: (new Date()).AsDateJs()},
    Value: {type:String, required:true},
    CreateBy :{type: mongoose.Schema.ObjectId, ref:'User'},
    PublishType: {type: String}, // Scheduled, now
    PublishDate: {type: Date, default: (new Date()).AsDateJs()},
    Deliverd:[{type: mongoose.Schema.ObjectId, ref:'User'}],
    NotDelivered:[{type: mongoose.Schema.ObjectId, ref:'User'}]
});

var RoomSchema = new mongoose.Schema({
    Name: {type:String, required:true},
    Entities :[{type: mongoose.Schema.ObjectId, ref:'Entity'}],
    Desc:{type:String},
    Members :[{type: mongoose.Schema.ObjectId, ref:'User'}],
    Logo :{type: String},
    Admins :[{type: mongoose.Schema.ObjectId, ref:'User'}],
    Creator : {type: mongoose.Schema.ObjectId, ref:'User'},
    Access:{type: String}, // public,Private
    Password : {type: String},
    Invited :[{type: mongoose.Schema.ObjectId, ref:'User'}],
    Requests:[{type: mongoose.Schema.ObjectId, ref:'User'}],
    CreateDate : {type: Date, default: (new Date()).AsDateJs()},
    StartType: {type:String},
    StartDate: {type: Date, default: (new Date()).AsDateJs()}
});

var RoomModel = mongoose.model('Room', RoomSchema);
var EntityModel =  mongoose.model('Entity', EntitySchema);

module.exports.RoomModel = RoomModel;
module.exports.EntityModel = EntityModel;

