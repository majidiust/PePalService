var express = require('express');
var router = express.Router();
var userModel = require("../models/user").UserModel;
var userControl = require("./users");
var fileModel = require('../models/files').FileModel;
var moment = require('moment')
var datejs = require('safe_datejs');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
/*----------------------------------- Uploader module ------------------------*/
var options;
options = {
    tmpDir: __dirname + '/../public/uploaded/tmp',
    uploadDir: __dirname + '/../public/uploaded/files',
    uploadUrl: '/uploaded/files/',
    maxPostSize: 11000000000, // 11 GB
    minFileSize: 1,
    maxFileSize: 10000000000, // 10 GB
    acceptFileTypes: /.+/i,
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

function downloadFile(req, res) {
    try {
        var fileId = req.params.fileId;
        if (!fileId) {
            res.send('{parameters:"[fileId]"}', 400);
        }
        else {
            fileModel.findOne({'_id': fileId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("file not found", 404);
                }
                else {
                    var hasAccess = false;
                    if(fileInstance.owner == req.user.id)
                        hasAccess = true;
                    else {
                        for (var i = 0; i < fileInstance.acl.length; i++) {
                            if (fileInstance.acl[i].userId == req.user.id) {
                                if (fileInstance.acl[i].status == true) {
                                    hasAccess = true;
                                }
                                break;
                            }
                        }
                    }
                    if (!hasAccess) {
                        res.send("Not allowed", 403);
                    }
                    else {
                        fileInstance.readCount += 1;
                        fileInstance.save(null);
                        var file = 'public/' + fileInstance.physicalPath;
                        console.log(file);
                        var filename = path.basename(file);
                        console.log(filename);
                        var mimetype = mime.lookup(file);
                        res.setHeader('Content-disposition', 'attachment; filename=' + filename);
                        res.setHeader('Content-type', mimetype);
                       // var fstream = fs.createReadStream(file);

                        res.download(file, filename, function(err){
                            if(err){
                                console.log(err);
                            }
                            else{
                                console.log("download ok");
                            }
                        });
                    }
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function getChilds(req, res) {
    console.log("get childs");
    try {
        var entityId = req.params.entityId;
        console.log(entityId);
        if (!entityId) {
            fileModel.find({ parent: null}).exec(function (err, files) {
                try {
                    var result = [];
                    for (var i = 0; i < files.length; i++) {
                        if (files[i].owner == req.user.id)
                            result.push(files[i]);
                        else {
                            for (var j = 0; j < files[i].acl.length; j++) {
                                if (files[i].acl[j].userId == req.user.id)
                                    result.push(files[i]);
                            }
                        }
                    }
                    res.json(result);
                }
                catch (ex) {
                    console.log(ex);
                    res.send(ex, 500)
                }
            });
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    console.log(err);
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    if (fileInstance.contentType.indexOf("Folder") == -1) {
                        res.send("This is a file and no have any child", 404);
                    }
                    else {
                        var hasAccess = false;
                        if (fileInstance.owner != req.user.id) {
                            for (var i = 0; i < fileInstance.acl.length; i++) {
                                if (fileInstance.acl[i].userId == req.user.id) {
                                    if (fileInstance.acl[i].status == true) {
                                        hasAccess = true;
                                    }
                                    break;
                                }
                            }
                        }
                        else {
                            hasAccess = true;
                        }
                        if (!hasAccess) {
                            res.send("Not allowed", 403);
                        }
                        else {
                            fileModel.find({parent: entityId}).exec(function (err, fileInstances) {
                                if (err) {
                                    res.send(err, 500);
                                }
                                else {
                                    res.json(fileInstances);
                                }
                            });
                        }
                    }
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function getRootEntities(req, res) {
    console.log("get roots");
    try {
        fileModel.find({ parent: null}).exec(function (err, files) {
            try {
                var result = [];
                for (var i = 0; i < files.length; i++) {
                    if (files[i].owner == req.user.id)
                        result.push(files[i]);
                    else {
                        for (var j = 0; j < files[i].acl.length; j++) {
                            if (files[i].acl[j].userId == req.user.id)
                                result.push(files[i]);
                        }
                    }
                }
                res.json(result);
            }
            catch (ex) {
                console.log(ex);
                res.send(ex, 500)
            }
        });
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function getParentId(req, res) {
    try {
        var entityId = req.params.entityId;
        if (!entityId) {
            res.send('{parameters:"[entityId]"}', 400);
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    res.json({ parentId: fileInstance.parent});
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function getAccessType(req, res) {
    try {
        var entityId = req.params.entityId;
        if (!entityId) {
            res.send('{parameters:"[entityId]"}', 400);
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    res.json({access: fileInstance.access });
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function createDirectory(req, res) {
    try {
        var dirName = req.body.dirName;
        var access = req.body.access;
        var parentId = req.body.parentId;
        if (!dirName) {
            res.send('{parameters:"[dirName]"}', 400);
        }
        else if (!access) {
            res.send('{parameters:"[access]"}', 400);
        }
        else {
            var newEntity = new fileModel({
                contentType: "Folder",
                readCount: 0,
                entityName: dirName,
                owner: req.user.id,
                access: access,
                status: true
            });
            newEntity.actionLog.push({userId: req.user.id, action: 'Create'});
            if (!parentId) {
                newEntity.save(null);
                res.send("Added successfully", 201);
            }
            else {
                fileModel.findOne({'_id': parentId}).exec(function (err, folder) {
                    if (err) {
                        res.send(err, 500);
                    }
                    else if (!folder) {
                        res.send("Parent entity not found", 404);
                    }
                    else if (folder.contentType.indexOf("Folder") != -1) {
                        newEntity.parent = parentId;
                        newEntity.save(null);
                        res.send("Added successfully", 201);
                    }
                    else {
                        res.send("you cant add file to the file", 404);
                    }
                });
            }
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function moveEntity(req, res) {
    try {
        var entityId = req.body.entityId;
        var newParentId = req.body.newParentId;
        if (!entityId) {
            res.send('{parameters:"[entityId]"}', 400);
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    if (!newParentId) {
                        fileInstance.parent = newParentId;
                        fileInstance.actionLog.push({userId: req.user.id, action: 'Move'});
                        fileInstance.save(null);
                        res.send("entity moved", 200);
                    }
                    else {
                        fileModel.findOne({'_id': newParentId}).exec(function (_err, _fileInstance) {
                            if (_err) {
                                res.send(_err, 500);
                            }
                            else if (!_fileInstance) {
                                res.send("parent not found", 404);
                            }
                            else {
                                fileInstance.parent = newParentId;
                                fileInstance.actionLog.push({userId: req.user.id, action: 'Move'});
                                fileInstance.save(null);
                                res.send("entity moved", 200);
                            }
                        });
                    }
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function deleteEntity(req, res) {
    try {
        var entityId = req.body.entityId;
        if (!entityId) {
            res.send('{parameters:"[entityId]"}', 400);
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    fileInstance.status = false;
                    fileInstance.actionLog.push({userId: req.user.id, action: 'Delete'});
                    fileInstance.save(null);
                    res.json({message: "Entity removed"});
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function changeAccess(req, res) {
    try {
        var entityId = req.body.entityId;
        var access = req.body.access;
        if (!entityId) {
            res.send('{parameters:"[entityId]"}', 400);
        }
        else if (access != "Public" || access != "Private" || access != "Friends" || !access) {
            res.send('{parameters:"[access]"}', 400);
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    fileInstance.access = access;
                    fileInstance.actionLog.push({userId: req.user.id, action: 'Access'});
                    fileInstance.save(null);
                    res.json(fileInstance.accept);
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function addAccessRole(req, res) {
    try {
        var entityId = req.body.entityId;
        var accessToUser = req.body.accessToUser;
        if (!entityId) {
            res.send('{parameters:"[entityId]"}', 400);
        }
        else if (!accessToUser) {
            res.send('{parameters:"[accessToUser]"}', 400);
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    userModel.findOne({'_id': accessToUser}).exec(function (err, user) {
                        if (err)
                            res.send(err, 500);
                        else if (!user) {
                            res.send("user not found", 404);
                        }
                        else {
                            var isExist = false;
                            for (var i = 0; i < fileInstance.acl.length; i++) {
                                if (fileInstance.acl[i].userId == user.id) {
                                    isExist = true;
                                    if (fileInstance.acl[i].status != true) {
                                        fileInstance.acl[i].changeLog.push({to: true, changeBy: req.user.id});
                                    }
                                    fileInstance.acl[i].status = true;
                                    fileInstance.save(null);
                                    break;
                                }
                            }
                            if (!isExist) {
                                var accessRole = { userId: accessToUser, status: true};
                                accessRole.changeLog = [];
                                accessRole.changeLog.push({ to: true, changeBy: req.user.id});
                                fileInstance.acl.push(accessRole);
                                fileInstance.save(null);
                            }
                            changeAccessRole(req.user.id, accessToUser, true, entityId);
                            res.send("role added successfully", 201);
                        }
                    });
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

function removeAccessRole(req, res) {
    try {
        var entityId = req.body.entityId;
        var accessToUser = req.body.accessToUser;
        if (!entityId) {
            res.send('{parameters:"[entityId]"}', 400);
        }
        else if (!accessToUser) {
            res.send('{parameters:"[accessToUser]"}', 400);
        }
        else {
            fileModel.findOne({'_id': entityId}).exec(function (err, fileInstance) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!fileInstance) {
                    res.send("entity not found", 404);
                }
                else {
                    var isExist = false;
                    for (var i = 0; i < fileInstance.acl.length; i++) {
                        if (fileInstance.acl[i].userId == user.id) {
                            isExist = true;
                            if (fileInstance.acl[i].status != false) {
                                fileInstance.acl[i].changeLog.push({to: false, changeBy: req.user.id});
                            }
                            fileInstance.acl[i].status = false;
                            fileInstance.save(null);
                            break;
                        }
                    }
                    changeAccessRole(req.user.id, accessToUser, false, entityId);
                    res.send("role removed successfully", 201);
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500)
    }
}

function uploadFile(req, res) {
    try {
        var parentId = req.params.parentId;
        var access = req.params.access;
        console.log(parentId + " : " + access);
        if (!access) {
            res.send('{parameters:"[access]"}', 400);
        }
        else if (!parentId) {
            res.send('{parameters:"[parentId]"}', 400);
        }
        else {
            fileModel.findOne({'_id': parentId}).exec(function (err, entity) {
                if (err) {
                    res.send(err, 500);
                }
                else if (!entity) {
                    res.send("file not found", 404);
                }
                else if(entity.contentType.indexOf("File") != -1){
                    res.send("cannot upload a file as the child of another file", 403);
                }
                else {
                    uploader.post(req, res, function (obj) {
                        var fileName = obj.files[0].name;
                        var fileSize = obj.files[0].size;
                        var mimeType = obj.files[0].type;
                        var newEntity = new fileModel({
                            parent: parentId,
                            readCount: 0,
                            access: access,
                            owner: req.user.id,
                            ContentType: 'File',
                            entityName: fileName,
                            MIMEType: mimeType,
                            entitySize: fileSize,
                            physicalPath: 'uploaded/files/' + fileName
                        });
                        newEntity.actionLog.push({userId: req.user.id, action: 'Create'});
                        newEntity.save(null);
                        res.send("Entity saved successfully", 201);
                    });
                }
            });
        }
    }
    catch (ex) {
        console.log(ex);
        res.send(ex, 500);
    }
}

/* ------------------------------------------- Utility functions ------------------------------------------*/
function exhaustiveDelete(currentUser, userId, status, currentEntityId) {
    try {
        fileModel.findOne({'_id': currentEntityId}).exec(function (err, currentInstance) {
                if (!err) {
                    if (currentInstance) {
                        currentInstance.status = false;
                        currentInstance.save(null);
                        if(currentInstance.contentType.indexOf("Folder") != -1) {
                            fileModel.find({parent: currentEntityId}).exec(function (err, entities) {
                                if (!err) {
                                    for (var i = 0; i < entities.length; i++) {
                                        fileModel.findOne({'_id': entities[i].id}).exec(function (err, entity) {
                                            exhaustiveDelete(currentUser, userId, status, entity.id);
                                        });
                                    }
                                }
                                else {
                                    console.log(err);
                                    return null;
                                }
                            });
                        }
                    }
                    else {
                        console.log("Instance is invalid with id : " + currentEntityId);
                        return null;
                    }
                }
            }
        );
    }
    catch
        (ex) {
        console.log(ex);
        return null;
    }
}

function changeAccessRole(currentUser, userId, status, currentEntityId) {
    try {
        fileModel.find({parent: currentEntityId}).exec(function (err, entities) {
            if (!err) {
                for (var i = 0; i < entities.length; i++) {
                    fileModel.findOne({'_id': entities[i].id}).exec(function (err, entity) {
                        if (entity) {
                            var isFind = false;
                            for (var j = 0; j < entity.acl.length; j++) {
                                if (entity.acl[j].userId == userId) {
                                    isFind = true;
                                    entity.acl[j].status = status;
                                    entity.acl[j].changeLog.push({ to: status, changeBy: currentUser});
                                    entity.save(null);
                                    break;
                                }
                            }
                            if (!isFind) {
                                var accessRole = { userId: userId, status: status};
                                accessRole.changeLog = [];
                                accessRole.changeLog.push({ to: status, changeBy: currentUser});
                                entity.acl.push(accessRole);
                                entity.save(null);
                            }
                        }
                    });
                    changeAccessRole(currentUser, userId, status, entities[i].id);
                }
            }
        });
    }
    catch (ex) {
        console.log(ex);
        return null;
    }
}

/*------------------------------------------ Routes -------------------------------------*/

router.route('/download/:fileId').get(userControl.requireAuthentication, downloadFile);
router.route('/download').get(userControl.requireAuthentication, downloadFile);

router.route('/getListOfEntity/:entityId').get(userControl.requireAuthentication, getChilds);
router.route('/getListOfEntity').get(userControl.requireAuthentication, getRootEntities);

router.route('/getParentId/:entityId').get(userControl.requireAuthentication, getParentId);
router.route('/getParentId').get(userControl.requireAuthentication, getParentId);

router.route('/getAccessType/:entityId').get(userControl.requireAuthentication, getAccessType);
router.route('/getAccessType').get(userControl.requireAuthentication, getAccessType);

router.route('/uploadFile/:parentId/:access').post(userControl.requireAuthentication, uploadFile);

router.route('/createDirectory').post(userControl.requireAuthentication, createDirectory);

router.route('/addAccessRole').post(userControl.requireAuthentication, addAccessRole);

router.route('/removeAccessRole').post(userControl.requireAuthentication, removeAccessRole);

router.route('/changeAccessType').post(userControl.requireAuthentication, changeAccess);

router.route('/deleteEntity').post(userControl.requireAuthentication, deleteEntity);

router.route('/moveEntity').post(userControl.requireAuthentication, moveEntity);

/*------------------------------------------ Register Module ----------------------------*/
module.exports = router;