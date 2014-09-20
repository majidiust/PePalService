var AuthResultCode = {
    TokenExpired: { code: -1, Message: "Token has been expired." },
    TokenIsInvalid: { code: -2, Message: "Token is invalid." },
    UserDoesNotExist: { code: -3, Message: "User doesn't exist." },
    PasswordIsInvalid: { code: -4, Message: "Password is invalid." },
    TokenIsUndifined: { code: -5, Message: "Token is undifined." },
    UnAuthorized:{code: -6, Message:"Not authorized."},
    RoomDoesNotExist:{code: -7, Message: "RoomDoesNotExist"},
    CreateEventError:{code: -8, Message:"CreateEventError"},
    PushEventToRoomError:{code: -9, Message: "PushEventToRoomError"},
    PushEventToUSerError:{code: -10, Message: "PushEventToUSerError"},
    InvalidRequestCode:{code: -11, Message: "InvalidRequestCode"},
    RoomIdIsEmpty:{code: -12, Message:"RoomIdIsEmpty"},
    InvalidEventContent:{code: -13, Message:"InvalidEventContent"},
    InvalidEventPublishType: {code: -14, Message:"InvalidEventPublishType"},
    InvalidEventPublishDate: {code: -15, Message:"InvalidEventPublishDate"},

    CreateRoomFailed: {code: -16, Message:"CreatedRoomFailed"},
    MissingOtherParty: {code: -17, Message:"MissingOtherParty"},
    MissingUserId: {code : -18, Message: "MissingUserId"}
};

module.exports.AuthResultCode = AuthResultCode;