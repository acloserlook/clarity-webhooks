const lodash = require("lodash")
const merge = lodash.merge;

const AclData = require("@acl/data");
const aclData = new AclData();

const AclStorage = require("@acl/storage").AclStorage;
const aclStorage = new AclStorage();

const tppClarityUserId = process.env.TPP_Clarity_USERID || null;
const tppClarityStorageContainerRoot = process.env.TPP_Clarity_storageContainerRoot;

const axios = require('axios');

const prod_quiqApiRoot = process.env.prod_quiqApiRoot;
const prod_quiqApiUsername = process.env.prod_quiqApiUsername;
const prod_quiqApiPassword = process.env.prod_quiqApiPassword;

async function quiqFileDownload(context, req) {
  // Log context WITHOUT bindings or req
  const cleanContext = merge({}, context, { bindings: null, req: null });
  context.log(cleanContext);

  // Log req WITHOUT the rawBody
  const cleanReq = merge({}, req, { rawBody: null });
  context.log(cleanReq);

  // Call the dequeuing mechanism in the database
  let dbInput = {
    queueProcessorTypeId: 3
  };
  let dbContext = {
    procedureKey: '/quiq/All/DequeueAsynchronousWork',
    currentUserId: tppClarityUserId,
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
  if (!queueItem || !queueItem.rq || !queueItem.rq.requestQueueId) {
    context.log('No queue item to work on');
    context.res = { body: 'No queue item to work on' };
    return;
  }

  context.log(queueItem);

  // We got a queue item to work on - handle it
  let queueItemDataInput = queueItem.rq.queueItemDataInput;
  let asset = queueItemDataInput.asset;
  let tppSiteReportId = queueItemDataInput.tppSiteReportId;
  let clientId = queueItemDataInput.clientId;
  let locationId = queueItemDataInput.locationId;

  context.log(queueItemDataInput);

  const axiosOptions = {
    method: 'get',
    url: prod_quiqApiRoot + 'assets/' + asset.assetId,
    responseType: 'stream',
    auth: {
      username: prod_quiqApiUsername,
      password:  prod_quiqApiPassword,
    },
    maxRedirects: 5,
  };

  context.log(axiosOptions);

  const axiosResult = await axios(
    axiosOptions
  ).then(async (res) => {
    context.log(res.headers);

    let fileInfo = {
      originalFileName: res.headers['x-amz-meta-x-original-filename'],
      size: res.headers['content-length'],
      mimeType: res.headers['content-type'],
      date: res.headers['last-modified'],
      encryption: res.headers['x-amz-server-side-encryption'],
      currentUserId: tppClarityUserId,
      storagePath: clientId + '/' + locationId,
      storageContainer: tppClarityStorageContainerRoot,
    };
    context.log(fileInfo);

    await aclStorage.saveFile({
      fileInfo,
      fileStream: res.data
    }).then(async (savedFileInfos) => {
      context.log(savedFileInfos);

      // Link the FileInfo record to the MessageFile table
      dbInput = {
        tppSiteReportId,
        messageId: queueItemDataInput.messageId,
        assetId: asset.assetId,
        filePublicKey: savedFileInfos[0].publicKey,
      };
      dbContext = {
        procedureKey: '/tpp/All/LinkDownloadedFileInfo',
        currentUserId: tppClarityUserId,
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
        requestQueueId: queueItem.rq.requestQueueId
      };
      dbContext = {
        procedureKey: '/quiq/All/CompleteAsynchronousWork',
        currentUserId: tppClarityUserId,
        //token: req.aclAuthentication.token,
      };
      try {
        await aclData.exec(dbInput, dbContext);
      } catch (err) {
        context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
        throw err;
      }
    })
  }).catch((err) => {
    context.log(err);
  });

  // If we got here, there was an item we processed.  See if there's another one available before quitting.
  context.log('Looking for more work');
  quiqFileDownload(context, req);
}

module.exports = quiqFileDownload;