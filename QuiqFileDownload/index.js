const lodash = require("lodash")
const merge = lodash.merge;

const AclData = require("@acl/data");
const aclData = new AclData();

const AclStorage = require("@acl/storage").AclStorage;
const aclStorage = new AclStorage();

const pollyUserId = process.env.POLLY_USERID || null;

const https = require('follow-redirects/https');

const polly_attachment_hostname = process.env.POLLY_Attachment_Hostname;
const polly_attachment_userId = process.env.POLLY_Attachment_UserId;
const polly_attachment_password = process.env.POLLY_Attachment_Password;
const polly_storage_container = process.env.POLLY_Storage_Container;

module.exports = async function (context, req) {
  // Log context WITHOUT bindings or req
  const cleanContext = { context: merge({}, context, { bindings: null, req: null }) };
  context.log(JSON.stringify(cleanContext));

  // Log req WITHOUT the rawBody
  const cleanReq = { req: merge({}, req, { rawBody: null }) };
  context.log(JSON.stringify(cleanReq));

  // Call the dequeuing mechanism in the database
  let dbInput = {
    queueProcessorTypeId: 3
  };
  let dbContext = {
    procedureKey: '/quiq/All/DequeueAsynchronousWork',
    currentUserId: pollyUserId,
    //token: req.aclAuthentication.token,
  };
  let queueItem = null;
  try {
    queueItem = await aclData.exec(dbInput, dbContext);
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
    throw err;
  }

  // If we didn't get a queue item back, bail out
  if(!queueItem || !queueItem.rq || !queueItem.rq.requestQueueId) {
    context.res = { body: 'No queue item to work on' };
    return;
  }

  // We got a queue item to work on - handle it
  let queueItemDataInput = queueItem.queueItemDataInput;
  let asset = queueItemDataInput.asset;
  let tppSiteReportId = queueItemDataInput.tppSiteReportId;

  const options = {
    protocol: 'https:',
    hostname: polly_attachment_hostname,
    path: '/api/v1/assets/' + asset.assetId,
    method: 'GET',
    auth: polly_attachment_userId + ':' + polly_attachment_password,
    followAllRedirects: true,
  };
  context.log(JSON.stringify(options));

  https.get(options, (res) => {
    let fileInfo = {
      originalFileName: res.headers['filename'],
      size: res.headers['length'],
      mimeType: res.headers['content-type'],
      date: res.headers['last-modified'],
      encryption: res.headers['x-amz-server-side-encryption'],
      currentUserId: pollyUserId,
      storageContainer: polly_storage_container
    };
    context.log(JSON.stringify(fileInfo));
    context.log(`STATUS: ${res.statusCode}`);
    context.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    const savedFileInfos = aclStorage.saveFile({
      fileInfo,
      fileStream: res
    });
    context.log(JSON.stringify({ savedFileInfos }));
    res.on('end', () => {
      context.log('No more data in response.');

      // Link the FileInfo record to the MessageFile table
      dbInput = {
        savedFileInfos,
        tppSiteReportId,
        messageId: queueItemDataInput.messageId,
        assetId: asset.assetId
      };
      dbContext = {
        procedureKey: '/quiq/All/LinkDownloadedFileInfo',
        currentUserId: pollyUserId,
        //token: req.aclAuthentication.token,
      };
      try {
        await aclData.exec(dbInput, dbContext);
      } catch (err) {
        context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
        throw err;
      }    

      // Mark the queue item completed
      dbInput = {
        requestQueueId: queueItem.requestQueueId
      };
      dbContext = {
        procedureKey: '/quiq/All/CompleteAsynchronousWork',
        currentUserId: pollyUserId,
        //token: req.aclAuthentication.token,
      };
      try {
        await aclData.exec(dbInput, dbContext);
      } catch (err) {
        context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
        throw err;
      }    
    });
  });
}
