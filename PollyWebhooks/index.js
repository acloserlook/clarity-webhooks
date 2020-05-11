const lodash = require("lodash")
const merge = lodash.merge;

const appInsights = require("applicationinsights");
appInsights.setup();
//const client = appInsights.defaultClient;

const AclData = require("@acl/data");
const aclData = new AclData();

const AclStorage = require("@acl/storage").AclStorage;
const aclStorage = new AclStorage();

module.exports = async function (context, req) {
  context.log(JSON.stringify({context: merge(context, {req:null})})); // Log the context WITHOUT req
  context.log(JSON.stringify({req}));                                 // Log just req

  // Call the generic logger
  let dbContext = {
    procedureKey: '/wh/All/LogWebhook',
    currentUserId: 'EAlle021',
    //token: req.aclAuthentication.token,
  };
  try {
      await aclData.exec({requestContext : merge(context, {req:null}), requestReq : req}, dbContext);
  } catch (err) {
      console.log(`Error calling ${procedureKey} with input\n${JSON.stringify(input, null, 2)}\n`, err);
      let message = process.env.ENV === 'production' ? 'Error executing request' : err.message;
      context.res = {body: {errored: true, message }};
      return;
    }

  // Call the actual handler
  let result = null;
  dbContext = {
    procedureKey: '/wh/Polly/Handler',
    currentUserId: 'EAlle021',
    //token: req.aclAuthentication.token,
  };
  try {
      result = await aclData.exec(req, dbContext);
  } catch (err) {
      console.log(`Error calling ${procedureKey} with input\n${JSON.stringify(input, null, 2)}\n`, err);
      let message = process.env.ENV === 'production' ? 'Error executing request' : err.message;
      result = { errored: true, message };
  }

  if(req && req.body && req.body.derivedData && req.body.derivedData.lastCustomerMessage) {
    let assets = req.body.derivedData.lastCustomerMessage.assets || [];
    for (let i=0; i < assets.length; i++) {
      let { assetId, contentType } = assets[i];

      const https = require('follow-redirects/https');
      const options = {
        protocol: 'https:',
        hostname: 'acloserlook-stage.goquiq.com',
        //port: 443,
        path: '/api/v1/assets/' + assetId,
        method: 'GET',
        auth: '484fc4c3-bb13-433e-ae39-a35c951db08e:eyJhbGciOiJIUzI1NiIsImtpZCI6ImJhc2ljOjAifQ.eyJ0ZW5hbnQiOiJhY2xvc2VybG9vay1zdGFnZSIsInN1YiI6IjcxNjM3In0.8adQSdgkiMwD4W9aopllyOOHURuMfbTlhXSFytewRok',
        followAllRedirects: true,
      };
      console.log(JSON.stringify(options));
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
        console.log(JSON.stringify(fileInfo));
        console.log(`STATUS: ${res.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        aclStorage.saveFile({
          fileInfo,
          fileStream: res
        });
        res.on('end', () => {
          console.log('No more data in response.');
        });
      });
      /*
      const http = require('http');
      const fs = require('fs');

      const file = fs.createWriteStream("file.jpg");
      const request = http.get("http://i3.ytimg.com/vi/J---aiyznGQ/mqdefault.jpg", function(response) {
        response.pipe(file);
      });

      curl
        -G https://acloserlook-stage.goquiq.com/api/v1/assets/1aaa88d66b18d8ddcbc7da49afba19a7deb4d3b2c77dd9d5cc903e7b5a143953
        --basic
        --user 484fc4c3-bb13-433e-ae39-a35c951db08e:eyJhbGciOiJIUzI1NiIsImtpZCI6ImJhc2ljOjAifQ.eyJ0ZW5hbnQiOiJhY2xvc2VybG9vay1zdGFnZSIsInN1YiI6IjcxNjM3In0.8adQSdgkiMwD4W9aopllyOOHURuMfbTlhXSFytewRok
        -v
      */
    }
  }

  context.log(JSON.stringify(result));

  context.res = { body: result };
}
