const AclData = require("@acl/data");
const aclData = new AclData();

const quiqUserId = process.env.QUIQ_USERID || null;

async function quiqAsyncOpsDequeueWorker(context, req) {
  context = context || {log: console.log};
  req = req || {};

  // This worker only kicks off calls that are purely handled within
  //   the database.  For more complex calls, create a separate worker.
  let dbContext = {
    procedureKey: '/quiq/All/PerformSimpleAsynchronousWork',
    currentUserId: quiqUserId,
  };
  let result = null;
  try {
    result = await aclData.exec(null, dbContext);
    context.log(result);
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey}\n`, err);
  }

  // If we didn't get a result back, then bail out
  if(!result || !result.success) {
    context.res = { body: 'Nothing done' };
    return;
  }

  // If we got here, there was an item we processed.  See if there's
  //   another one available before quitting.
  context.log('Looking for more work');
  quiqAsyncOpsDequeueWorker(context, req);
}

module.exports = quiqAsyncOpsDequeueWorker;
