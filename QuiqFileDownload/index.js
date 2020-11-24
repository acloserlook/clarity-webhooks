const AclData = require("@acl/data");
const aclData = new AclData();

const AclStorage = require("@acl/storage").AclStorage;
const aclStorage = new AclStorage();

const quiqUserId = process.env.QUIQ_USERID || null;
const tppStorageContainerRoot = process.env.STORAGECONTAINERROOT_TPP;
const capStorageContainerRoot = process.env.STORAGECONTAINERROOT_CAP;

const axios = require('axios');

const quiqApiRoot = process.env.QUIQ_PROD_API_ROOT;
const quiqApiUsername = process.env.QUIQ_PROD_API_USERNAME;
const quiqApiPassword = process.env.QUIQ_PROD_API_PASSWORD;

async function quiqFileDownload(context, req) {
  context = context || {log: console.log};
  req = req || {};

  // Log context WITHOUT bindings or req
  const cleanContext = {...context, ...{ bindings: null, req: null }};
  context.log(cleanContext);

  // Log req WITHOUT the rawBody
  const cleanReq = {...req, ...{ rawBody: null }};
  context.log(cleanReq);

  // Call the dequeuing mechanism in the database
  let dbInput = {
    queueProcessorTypeId: 3
  };
  let dbContext = {
    procedureKey: '/quiq/All/DequeueAsynchronousWork',
    currentUserId: quiqUserId,
    //token: req.aclAuthentication.token,
  };
  let queueItem = null;
  try {
    queueItem = await aclData.exec(dbInput, dbContext);
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
    return;
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
  let siteReportId = queueItemDataInput.siteReportId;
  let clientId = queueItemDataInput.clientId;
  let locationId = queueItemDataInput.locationId;
  let productTypeId = queueItemDataInput.productTypeId;

  context.log(queueItemDataInput);

  const axiosOptions = {
    method: 'get',
    url: quiqApiRoot + 'assets/' + asset.assetId,
    responseType: 'stream',
    auth: {
      username: quiqApiUsername,
      password:  quiqApiPassword,
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
      currentUserId: quiqUserId,
      storagePath: clientId + '/' + locationId,
      storageContainer: (productTypeId === 3)
        ? capStorageContainerRoot
        : tppStorageContainerRoot,
    };
    context.log(fileInfo);

    await aclStorage.saveFile({
      fileInfo,
      fileStream: res.data
    }).then(async (savedFileInfos) => {
      context.log(savedFileInfos);

      // Link the FileInfo record to the MessageFile table
      dbInput = {
        siteReportId,
        messageId: queueItemDataInput.messageId,
        assetId: asset.assetId,
        filePublicKey: savedFileInfos[0].publicKey,
      };
      dbContext = {
        procedureKey: (productTypeId === 3)
          ? '/cap/All/LinkDownloadedFileInfo'
          : '/tpp/All/LinkDownloadedFileInfo',
        currentUserId: quiqUserId,
        //token: req.aclAuthentication.token,
      };
      try {
        await aclData.exec(dbInput, dbContext);
      } catch (err) {
        context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
        return;
      }

      // Mark the queue item completed
      dbInput = {
        requestQueueId: queueItem.rq.requestQueueId
      };
      dbContext = {
        procedureKey: '/quiq/All/CompleteAsynchronousWork',
        currentUserId: quiqUserId,
        //token: req.aclAuthentication.token,
      };
      try {
        await aclData.exec(dbInput, dbContext);
      } catch (err) {
        context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
        return;
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