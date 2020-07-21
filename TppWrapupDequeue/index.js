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

  // Call the dequeuing mechanism in the database
  let dbInput = {
    queueProcessorTypeId: 1
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

  // We got a queue item to work on - send it to the handler
  dbInput = {
    requestQueueId: queueItem.rq.requestQueueId
  }
  dbContext = {
    procedureKey: '/tpp/All/ProcessWrapup',
    currentUserId: pollyUserId,
    //token: req.aclAuthentication.token,
  }
  try {
    await aclData.exec(dbInput, dbContext);
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(dbInput, null, 2)}\n`, err);
    throw err;
  }

  // TODO: Enqueue the image downloaders
}
