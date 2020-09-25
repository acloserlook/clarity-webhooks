const AclData = require("@acl/data");
const aclData = new AclData();

const pollyUserId = process.env.POLLY_USERID || null;

module.exports = async function (context, req) {
  // Log context WITHOUT bindings or req
  const cleanContext = {...context, ...{ bindings: null, req: null }};
  context.log(JSON.stringify(cleanContext));

  // Log req WITHOUT the rawBody
  const cleanReq = {...req, ...{ rawBody: null }};
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

  if(req && req.query && req.query.isAsync == 1) {
    // Call the enqueuing mechanism in the database
    dbContext.procedureKey = '/quiq/All/EnqueueAsynchronousWork';
    context.log(JSON.stringify(dbContext));
    try {
      let asyncResult = await aclData.exec(null, dbContext);
      context.log(JSON.stringify(asyncResult));
      context.res = { body: asyncResult || '' };
    } catch (err) {
      context.log(`Error calling ${dbContext.procedureKey}`, err);
      throw err;
    }
  }
  else {
    // Call the synchronous handler (async enqueuing happens in a timer-driven function)
    dbContext.procedureKey = '/quiq/All/ProcessSynchronousCall';
    context.log(JSON.stringify(dbContext));
    try {
      let syncResult = await aclData.exec(cleanReq, dbContext);
      context.log(JSON.stringify(syncResult));
      context.res = { body: syncResult };
    } catch (err) {
      context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(cleanReq, null, 2)}\n`, err);
      throw err;
    }
  }
}
