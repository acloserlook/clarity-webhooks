const lodash = require("lodash")
const merge = lodash.merge;

const AclData = require("@acl/data");
const aclData = new AclData();

const pollyUserId = process.env.POLLY_USERID || null;

module.exports = async function (context, req) {
  // Log context WITHOUT bindings or req
  const cleanContext = { context: merge({}, context, { bindings: null, req: null }) };
  context.log(JSON.stringify(cleanContext));

  // Log req WITHOUT the rawBody
  const cleanReq = { req: merge({}, req, { rawBody: null }) };
  context.log(JSON.stringify(cleanReq));

  // Call the generic logger
  let dbContext = {
    procedureKey: '/quiq/All/ReceiveWebhook',
    currentUserId: pollyUserId,
    //token: req.aclAuthentication.token,
  };
  let dbInput = {
    requestContext: cleanContext,
    requestReq: cleanReq
  };
  try {
    await aclData.exec(dbInput, dbContext);
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
    throw err;
  }

  if(req && req.query && req.query.isAsync === 1) {
    context.log('Asynchronous request has been logged for later queueing');
  }
  else {
    // Call the synchronous handler (async enqueuing happens in a timer-driven function)
    dbContext.procedureKey = '/quiq/All/ProcessSynchronousCall';
    try {
      let syncResult = await aclData.exec(cleanReq.req, dbContext);
      context.log(JSON.stringify(syncResult));
      context.res = { body: syncResult };
    } catch (err) {
      context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(cleanReq.req, null, 2)}\n`, err);
      throw err;
    }
  }
}
