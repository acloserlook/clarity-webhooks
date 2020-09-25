const AclData = require("@acl/data");
const aclData = new AclData();

const pollyUserId = process.env.POLLY_USERID || null;

module.exports = async function (context, req) {
  // Log context WITHOUT bindings or req
  const cleanContext = {...context, ...{ bindings: null, req: null }};
  context.log(cleanContext);

  // Log req WITHOUT the rawBody
  const cleanReq = {...req, ...{ rawBody: null }};
  context.log(cleanReq);

  // Call the enqueuing mechanism in the database
  let dbContext = {
    procedureKey: '/quiq/All/EnqueueAsynchronousWork',
    currentUserId: pollyUserId,
    //token: req.aclAuthentication.token,
  };
  try {
    let asyncResult = await aclData.exec(null, dbContext);
    context.log(asyncResult);
  } catch (err) {
    context.log(`Error calling ${dbContext.procedureKey}`, err);
    throw err;
  }
}
