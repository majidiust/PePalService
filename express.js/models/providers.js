var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Contact = new Schema({
    contactName             :   {type : String,  unique: true, required : true},
    contactValue            :   String
});

var Tag = new Schema({
    tagName :   {type : String,  unique: true, required : true}
});

var Image = new Schema({
    imageName           :   {type:  String }   ,
    imageCreateDate     :   Date
});

var Feature = new Schema({
    featureName:    {type: String, require: true},
    featureDesc:    {type: String, require: true},
    featureCreateDate:  {type: Date, default: Date.now},
    featureState: {type: Boolean, default: true},
    featureApproved: {type: Boolean, default: true},
    featureProducts: [mongoose.Schema.Types.ObjectId]
});

var Product = new Schema({
    productName             :   {type : String, required : true},
    productCreateDate       :   {type: Date, default: Date.now},
    productImages           :   [Image],
    productDesc             :   String,
    productTags             :   [Tag],
    productOwners           :   [mongoose.Schema.Types.ObjectId],
    productFeatures         :   [Feature]
});

var Owner    =   new Schema({
    firstName   :   String,
    lastName    :   String,
    contacts    :   [Contact],
    companyName :   String,
    companyId   :   String,
    nationalityCode : String,
    economicCode : String,
    title   :   String,
    personalityType    :   String, // Haghighi/Hoghoghi
    companyRegisterDate     :   String,
    companyImages   : [Image],
    personalImage   :  [Image],
    products    :   [mongoose.Schema.Types.ObjectId],
    type    :   String //producer/reseller/ 
});

var OwnerModel = mongoose.model('Producer', Owner);
var ProductMoedl = mongoose.model('Product', Product);
var FeatureModel = mongoose.model('Feature', Feature);

module.exports.OwnerModel = OwnerModel;
module.exports.ProductMoedl = ProductMoedl;
module.exports.FeatureModel = FeatureModel;