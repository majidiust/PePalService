/**
 * Created by Majid on 12/18/2014.
 */


var EventTypeList = {
    FriendStatusChanged: { code: "0", Message: "FriendStatusChanged" },
    FriendAdded: { code: "1", Message:"FriendAdded"},
    NewTextMessage: {code : "2", Message: "NewTextMessage"},
    AddedToRoom: {code: "3", Message: "AddedToRoom"}
};

module.exports.EventTypeList = EventTypeList;
