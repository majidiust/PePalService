var SuccessCode = {
    AuthorizationIsOk: { code: 0, Message: "Authenticated." },
    EventPostedSuccessfully: { code: 1, Message: "EventPostedSuccessfully" },
    CreateRoomSuccessfully:{code:2, Message:"CreateRoomSuccessfully"},
    RoomExist: {code: 3, Message:"Room Exist"},
    NoMoreMessage: {code: 4, Message:"There is no message"},
    IndividualContacts: {code: 5, Message:"IndividualContacts"},
    CurrentProfile: {code : 6, Message:"CurrentProfile"},
    UsernameViaUserId : {code : 7, Message:"UserName via userId"},
    FriendAddedSuccessfully : {code : 8 , Message: "FriendAddedSuccessfully"},
    ListOfFriends : {code : 9 , Message : "ListOfFriends"}
};

module.exports.SuccessCode = SuccessCode;