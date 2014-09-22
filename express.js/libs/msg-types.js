var WebsocketMessageList = {
    Token: { code: "0", Message: "Token" },
    SendTextMessageTo: { code: "1", Message:"SendTextMessage"},
    CreateIndividualRoom: {code : "2", Message: "CreateIndividualRoom"},
    GetIndividualRooms: {code: "3", Message: "GetIndividualRooms"},
    GetCurrentProfile: {code: "4", Message: "GetCurrentProfile"},
    GetUsernameViaUserId: {code : "5", Message: "GetUsernameViaUserId"},
    AddUserToFriend: {code: "6", Message: "AddUserToFriend"},
    GetFriendList: {code: "7", Message: "GetFriendList"}
};

module.exports.WebsocketMessageList = WebsocketMessageList;