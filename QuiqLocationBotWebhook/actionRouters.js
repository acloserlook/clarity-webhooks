const AclData = require("@acl/data");
const aclData = new AclData();

const quiqUserId = process.env.QUIQ_USERID || null;

const apiCalls = require('./apiCalls');

const queryBusinessName = async (logger, conversation, botState) => {
  botState.messageType = 'queryBusinessName';

  let result = await processSynchronousDbCall(logger, botState);
  botState.lastResult = result;

  if (result.length === 1) {
    const clientName = result[0].text;
    botState.clientName = clientName;
    return 'queryCityName';
  }
  else {
    return 'queryBusinessName';
  }
};

const queryCityName = async (logger, conversation, botState) => {
  botState.messageType = 'queryCityName';

  let result = await processSynchronousDbCall(logger, botState);
  botState.lastResult = result;

  if (result.length === 1) {
    const cityName = result[0].text;
    botState.cityName = cityName;
    return 'endPoint';
  }
  else {
    return 'queryCityName';
  }
};

const processSynchronousDbCall = async (logger, botState) => {
  let dbContext = {
    procedureKey: '/quiq/Location/ProcessSynchronousCall',
    currentUserId: quiqUserId,
    //token: req.aclAuthentication.token,
  };
  try {
    let syncResult = await aclData.exec(botState, dbContext);
    logger.log(syncResult);
    return syncResult;
  } catch (err) {
    logger.log(`Error calling ${dbContext.procedureKey} with input\n${JSON.stringify(cleanReq, null, 2)}\n`, err);
    throw err;
  }
};

module.exports = {
  queryBusinessName,
  queryCityName,
};
