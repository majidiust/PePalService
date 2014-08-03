var mongoose = require("mongoose");

var TokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    token: { type: String, required: true },
    exp: { type: String, required: true },
    state: {type: Boolean, default: true},
    created: {type: Date, default: Date.now},
    deleted: {type: Date, default: Date.now}
});

var TokenModel = mongoose.model('Token', TokenSchema);
module.exports.TokenModel = TokenModel; 