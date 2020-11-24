const AclData = require("@acl/data");
const aclData = new AclData();

const apiCalls = require('./apiCalls');

const last = (array) => {
  if (!array || !array.length) return null;
  return array[array.length - 1];
};

const queryBusinessName = async (logger, conversation, botState) => {
  let reply = { text: null };
  let result = botState.lastResult;

  if (!botState.introduced) {
    reply.text = `Let's find where you're headed. For starters, please send me the first few letters of the business name you plan to visit.`;
    botState.introduced = true;
  }
  else if (!result || result.length < 1) {
    reply.text = `I couldn't find any businesses with that name. Please try again with the first few letters of the business name you're visiting.`;
  }
  else if (result.length > 5) {
    reply.text = `I found too many business names that matched your search. Please be a little more specific.`;
  }
  else {
    reply = {
      text: `Please pick one of these matching business names:`,
      quiqReply: {
        replies: result
      }
    };
  }

  await apiCalls.sendMessage(conversation.id, reply);
};

const queryCityName = async (logger, conversation, botState) => {
  await apiCalls.sendMessage(conversation.id, {
    text: "Great! It looks like you're visiting " + botState.clientName + ". Now please send the first few letters of the city name."
  });
};

const endPoint = async (logger, conversation, botState) => {
  await apiCalls.sendMessage(conversation.id, {
    text: "Congratulations - we got that far. Let's take a break."
  });
  await apiCalls.updateFields(conversation.id, {
    fields: [{field: 'schema.conversation.custom.locationId', value: "1"}],
  });
  await apiCalls.sendToQueue(conversation.id, {targetQueue: botState.referringBot});
};

module.exports = {
  queryBusinessName,
  queryCityName,
  endPoint
};
