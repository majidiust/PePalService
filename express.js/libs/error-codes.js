var AuthResultCode = {
    TokenExpired: { code: -1, Message: "Token has been expired." },
    TokenIsInvalid: { code: -2, Message: "Token is invalid." },
    UserDoesNotExist: { code: -3, Message: "User doesn't exist." },
    PasswordIsInvalid: { code: -4, Message: "Password is invalid." },
    TokenIsUndifined: { code: -5, Message: "Token is undifined." },
    AuthorizationIsOk: { code: 0, Message: "Authenticated." },
    UnAuthorized:{code: -6, Message:"Not authorized."}
};

module.exports.AuthResultCode = AuthResultCode;