var WebsocketCommandList = {
    TokenRequest: { code: 100, Message: "Token" },
    Authorized: { code: 101, Message: "Authorized" },
    InvalidMessage: {code: 102, Message:"message is invalid"},
    NewMessage: {code: 103, Message: "NewMessage"},
    MemberAdded: {code: 104, Message: "NewMember"},
    AddedToGroup : {code : 105, Message: "AddedToGroup"},
    AddedToRoom : {code : 106, Message: "AddedToRoom"},
    UserStatusChanged: {code: 107, Message: "UserStatusChanged"},
    UserIsTyping: {code: 108, Message: "UserIsTyping"}
};

module.exports.WebsocketCommandList = WebsocketCommandList;