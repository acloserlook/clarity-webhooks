const lodash = require("lodash")
const merge = lodash.merge;

const https = require('follow-redirects/https');

const appInsights = require("applicationinsights");
appInsights.setup();

const AclData = require("@acl/data");
const aclData = new AclData();

const AclStorage = require("@acl/storage").AclStorage;
const aclStorage = new AclStorage();

module.exports = async function (context, req) {
  // Log context WITHOUT bindings or req
  const cleanContext = {context: merge({}, context, {bindings:null, req:null})};
  context.log(JSON.stringify(cleanContext));

  // Log req WITHOUT the rawBody
  const cleanReq = {req: merge({}, req, {rawBody:null})};
  context.log(JSON.stringify(cleanReq));

  // Call the generic logger
  let dbContext = {
    procedureKey: '/wh/All/LogWebhook',
    currentUserId: 'EAlle021',
    //token: req.aclAuthentication.token,
  };
  let dbInput = {
    requestContext : cleanContext,
    requestReq : cleanReq
  };
  try {
    await aclData.exec(dbInput, dbContext);
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
    throw err;
  }

  // Call the actual handler
  dbContext.procedureKey = '/wh/Polly/Handler';
  try {
    let result = await aclData.exec(cleanReq.req, dbContext);
    context.log(JSON.stringify(result));
    context.res = {body: result};
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(cleanReq.req, null, 2)}\n`, err);
    throw err;
  }

  if(req && req.body && req.body.conversation && req.body.conversation.messages) {
    let messages = req.body.conversation.messages;
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++)
    {
      let message = messages[messageIndex];
      if (!message.assets || !message.assets.length) continue;

      for (let assetIndex = 0; assetIndex < message.assets.length; assetIndex++){
        let asset = message.assets[assetIndex];

        const options = {
          protocol: 'https:',
          hostname: 'acloserlook-stage.goquiq.com',
          path: '/api/v1/assets/' + asset.assetId,
          method: 'GET',
          auth: '484fc4c3-bb13-433e-ae39-a35c951db08e:eyJhbGciOiJIUzI1NiIsImtpZCI6ImJhc2ljOjAifQ.eyJ0ZW5hbnQiOiJhY2xvc2VybG9vay1zdGFnZSIsInN1YiI6IjcxNjM3In0.8adQSdgkiMwD4W9aopllyOOHURuMfbTlhXSFytewRok',
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
            currentUserId: 'EAlle021',
            storageContainer: 'polly-files'
          };
          context.log(JSON.stringify(fileInfo));
          context.log(`STATUS: ${res.statusCode}`);
          context.log(`HEADERS: ${JSON.stringify(res.headers)}`);
          const savedFileInfos = aclStorage.saveFile({
            fileInfo,
            fileStream: res
          });
          context.log(JSON.stringify({savedFileInfos}));
          res.on('end', () => {
            context.log('No more data in response.');
          });
        });
      }
    }
  }
}
