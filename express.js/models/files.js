/**
 * New node file
 */
var mongoose = require('mongoose');

var ChangeAccessSchema = new mongoose.Schema({
    changeBy: {type: mongoose.Schema.ObjectId, ref:'User'},
    to:  {type:String,enum: ['Grant', 'Deny']},
    date: {type: Date, default: (new Date()).AsDateJs()}
});

var AccessSchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.ObjectId, ref:'User'},
    status: { type: Boolean, default: true },
    changeLog: [ChangeAccessSchema]
});

var ActionSchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.ObjectId, ref:'User'},
    action:  {type:String,enum: ['Create', 'Delete', 'Edit', 'Move', 'Access']},
    date: {type: Date, default: (new Date()).AsDateJs()}
});

var FileSchema = new mongoose.Schema({
    contentType : {type:String,enum: ['File', 'Folder']},
    MIMEType: {type: String},
    readCount: {type: Number},
    entityName: {type: String},
    entitySize: {type: Number},
    parent: {type: mongoose.Schema.ObjectId, ref:'Files'},
    owner: {type: mongoose.Schema.ObjectId, ref:'User'},
    access: {type: String, enum: ['Public', 'Private', 'Friends']},
    acl: [AccessSchema],
    status: { type: Boolean, default: true },
    actionLog: [ActionSchema],
    physicalPath: {type:String},
    encryptionKey: {type:String}
});

var FileModel = mongoose.model('Files', FileSchema);
module.exports.FileModel = FileModel;
