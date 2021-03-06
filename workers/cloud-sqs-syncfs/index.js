/*
  Summary:
    s3 -> sqs -> worker: sync to file system
 */
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var Promise = require('bluebird');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var helper = require('../helper.js');
var ftpDel = require('../ftp-del.js');

var config = {
  destPath: '\\\\172.25.46.154\\CloudFiles\\tmp\\'
}
var logMessages = [];
var today = new Date();
var destFile = '';
var myPath = '';

var log = function() {
  // do some custom log recording
  // log.call(this, 'My Console!!!');
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, args);
  _.each(arguments, function(v) {
    logMessages.push(v);
  });
};

function download(bucketFrom) {
  return new Promise(function(resolve, reject) {
  	log(destFile);
    var destFile2 = destFile.replace('\\tmp\\', '\\data\\');
    if (helper.exists(destFile)) {
      fs.unlinkSync(destFile);
    }
    if (helper.exists(destFile2)) {
      fs.unlinkSync(destFile2);
    }

    // make dest folder
    var destDir = path.dirname(destFile);
    mkdirp.sync(destDir);

    // make data folder
    mkdirp.sync(path.dirname(destFile2));


    // set a temp file name
    var file = fs.createWriteStream(destFile);
    file.on('close', function() {
      fs.rename(destFile, destFile2, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      })
    });
    s3.getObject(bucketFrom) // Unzip stream
      .createReadStream()
      .pipe(file)

      // Callback with error
      .on('error', reject);
  });
}

function logResult(err) {
  if (err) {
    log('error', err);
  }
  log('try to remove file');

  // ftpDel.handler(myPath, config.context.done);
  
  // comment out the line below if using ftpDel
  setTimeout(config.context.done, 1000);
}

// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
  handler: function(event, context) {
    log('processing', JSON.stringify(event, null, 2));
    config.context = context;
    config.event = event;

    var eventRecord = event.Records && event.Records[0];
    var record = eventRecord.s3 || eventRecord.custom;
    var srcBucket = record.bucket.name;
    var srcKey = decodeURIComponent(
      record.object.key.replace(/\+/g, ' ')
    );
    var fileParts = srcKey.split('/').slice(3);
    var newKey = fileParts.join('\\');
    myPath = fileParts.join('/');
    var fileName = path.basename(newKey);

    console.log(srcKey);
    destFile = config.destPath + fileName;

    var bucketFrom = {
      Bucket: srcBucket,
      Key: srcKey
    };

    download(bucketFrom)
      .then(logResult, logResult);
  }
};
