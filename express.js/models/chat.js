var mongoose = require('mongoose');
var UserModel = require('./user').UserModel;
var datejs = require('safe_datejs');

var EntitySchema = new mongoose.Schema({
    Type : {type: String, required: true, enum: ['Text', 'Audio', 'Video', 'SMS', 'Smily']}, // IM/audio/video/smily
    CreateDate : {type: Date, default: (new Date()).AsDateJs()},
    Content: {type:String, required:true},
    Creator :{type: mongoose.Schema.ObjectId, ref:'User'},
    CreatorUserName: {type: String},
    PublishType: {type: String, enum: ['Scheduled', 'Now']}, // Scheduled, now
    PublishDate: {type: Date, default: (new Date()).AsDateJs()},
    Delivered:[{type: mongoose.Schema.ObjectId, ref:'User'}]
});

var RoomSchema = new mongoose.Schema({
    Name: {type:String},
    Entities :[{type: mongoose.Schema.ObjectId, ref:'Entity'}],
    Desc:{type:String},
    Members :[{type: mongoose.Schema.ObjectId, ref:'User'}],
    Logo :{type: String},
    Admins :[{type: mongoose.Schema.ObjectId, ref:'User'}],
    Creator : {type: mongoose.Schema.ObjectId, ref:'User'},
    Access:{type: String, enum :['Public','Private']}, // public,Private
    Type:{type: String, enum :['G', 'I']},
    Password : {type: String},
    Invited :[{type: mongoose.Schema.ObjectId, ref:'User'}],
    Requests:[{type: mongoose.Schema.ObjectId, ref:'User'}],
    CreateDate : {type: Date, default: (new Date()).AsDateJs()},
    StartType: {type:String,enum: ['Scheduled', 'Now']},
    StartDate: {type: Date, default: (new Date()).AsDateJs()}
});

var RoomModel = mongoose.model('Room', RoomSchema);
var EntityModel =  mongoose.model('Entity', EntitySchema);

module.exports.RoomModel = RoomModel;
module.exports.EntityModel = EntityModel;

