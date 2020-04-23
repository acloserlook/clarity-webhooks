const appInsights = require("applicationinsights");
appInsights.setup();
//const client = appInsights.defaultClient;

const AclData = require("@acl/data");
const aclData = new AclData();

module.exports = async function (context, req) {
  context.log(JSON.stringify({context}));
  context.log(JSON.stringify({req}));

  let dbInput = req;
  let dbContext = {
    procedureKey: '/api/Public/Webhook',
    currentUserId: 'EAlle021',
    //token: req.aclAuthentication.token,
  };

  let result = null;
  try {
      result = await aclData.exec(dbInput, dbContext);
  } catch (err) {
      console.log(`Error calling ${procedureKey} with input\n${JSON.stringify(input, null, 2)}\n`, err);
      let message = process.env.ENV === 'production' ? 'Error executing request' : err.message;
      result = { errored: true, message };
  }

  context.log(JSON.stringify(result));

  context.res = {
    body: result
  };
}
