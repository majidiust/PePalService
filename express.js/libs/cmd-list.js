var WebsocketCommandList = {
    TokenRequest: { code: 0, Message: "Token" },
    Authorized: { code: 1, Message: "Authorized" },
    InvalidMessage: {code: 2, Message:"message is invalid"},
    NewMessage: {code: 3, Message: "NewMessage"}
};

module.exports.WebsocketCommandList = WebsocketCommandList;