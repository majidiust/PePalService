var express = require('express');
var userModel = require("../models/user").UserModel;
var tokenModel = require("../models/token").TokenModel;
var productModel = require("../models/providers").ProductMoedl;
var ownerModel = require("../models/providers").OwnerModel;
var featureModel = require("../models/providers").FeatureModel;
var jwt = require("jwt-simple");
var moment = require("moment");
var datejs = require("safe_datejs");
var userControl = require("./users");
var router = express.Router();



var addVendor = function(req, res){
    res.send('POST : ' + 'Add vendor : not implemented');
}

var editVendor = function(req, res){
    res.send('POST : ' + 'Edit vendor : not implemented');
}

var deleteVendor = function(req, res){
    res.send('POST : ' + 'delete vendor : not implemented');
}

router.get('/', function(req, res) {
  res.send('GET : ' + 'Welcome to test index routeing of vendors');
});

router.route('/addVendor').post(userControl.requireAuthentication, addVendor);
router.route('/editVendor').post(userControl.requireAuthentication, editVendor);
router.route('/deleteVendor').post(userControl.requireAuthentication, deleteVendor);

module.exports = router;