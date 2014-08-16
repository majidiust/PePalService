var SuccessCode = {
    AuthorizationIsOk: { code: 0, Message: "Authenticated." },
    EventPostedSuccessfully: { code: 1, Message: "EventPostedSuccessfully" },
    CreateRoomSuccessfully:{code:2, Message:"CreateRoomSuccessfully"},
    RoomExist: {code: "3", Message:"Room Exist"},
    NoMoreMessage: {code: "4", Message:"There is no message"}
};

module.exports.SuccessCode = SuccessCode;