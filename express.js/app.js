var express = require('express');
var path = require('path');
var passport = require('passport');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var webSocketServer = require('./websocket/chat-server.js');
var tcpSocketServer = require('./tcpsocket/chat-server.js');

var mongoose = require('mongoose');
mongoose.connect('mongodb://192.168.88.128:27017/PePalServiceExpress');

var users = require('./routes/users');
var chatRest = require('./routes/chat');
var files = require('./routes/files');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// Use the passport package in our application
app.use(passport.initialize());


/**
 * Set the secret for encoding/decoding JWT tokens
 */
app.set('jwtTokenSecret', '729183456258456')

// Make our db accessible to our router
app.use(function (req, res, next) {
    console.log("Middle layer");
    next();
});

app.use('/api', users);
app.use('/chat', chatRest);
app.use('/document', files);
/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


webSocketServer.initWebSocket();
tcpSocketServer.initTCPSocket();

module.exports = app;