const AclData = require("@acl/data");
const aclData = new AclData();

const pollyUserId = process.env.POLLY_USERID || null;

const {pong} = require('./apiCalls');
const handleConversationEvent = require('./conversationEvents');

module.exports = async function (context, req) {
  // If we don't have a valid request with body and headers, bail out
  if (!req || !req.body || !req.headers) {
    context.log('Missing request, body, or headers - bailing out')
    context.res = { status:400 };
    return;
  }

  // Handle ping requests without any further processing or logging
  if (req.body.ping) {
    await pong(context);
    context.res = { status: 204 };
    return;
  }

  // Log context WITHOUT bindings or req
  const cleanContext = {...context, ...{ bindings: null, req: null }};
  context.log(cleanContext);

  // Log req WITHOUT the rawBody
  const cleanReq = {...req, ...{ rawBody: null }};
  context.log(cleanReq);

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

//  if (req.headers['x-centricient-hook-token'] !== process.env.hookSecret) {
//    context.res.statusMessage = 'Invalid verification token provided';
//    return context.res = { status: 400 };
//  }

  const conversationUpdates = req.body.conversationUpdates;
  if(conversationUpdates && conversationUpdates.length) {
    try {
      context.log('Conversation Update: ' + JSON.stringify(conversationUpdates));
      await handleConversationEvent(context, conversationUpdates);
      context.res = { status: 204 };
    } catch (err) {
      context.log(`Error updating conversation`);
      throw err;
    }
  }
}
