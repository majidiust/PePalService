var winston= require('winston');
require('winston-mongodb').MongoDB;


winston.add(winston.transports.File, {filename: './log/logger.log', exitOnError: false});
//winston.handleExceptions(new winston.transports.File({ filename: './log/exceptions.log' }))

winston.add(winston.transports.MongoDB, {

	dbUri: 'mongodb://127.0.0.1:27017/pepalLogger'
});





//Log logger !
winston.info('Ya just logger worke like a charm');

module.exports = winston;

