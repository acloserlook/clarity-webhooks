const apiCalls = require('./apiCalls');
const actionHandlers = require('./actionHandlers');
const actionRouters = require('./actionRouters');

const generateResponse = async (logger, conversation, botState) => {
  let nextAction = 'queryBusinessName';

  if (botState['lastAction'] && actionRouters[botState['lastAction']]) {
    nextAction = await actionRouters[botState['lastAction']](logger, conversation, botState);
  }

  if (nextAction) {
    await actionHandlers[nextAction](logger, conversation, botState);
  }

  botState['lastAction'] = nextAction;
};

const reactToConversationUpdate = async (logger, conversation, conversationHints, botState) => {
  const hints = conversationHints.map(h => h.hint);

  if (hints.includes('invitation-timer-active')) {
    botState.referringBot = conversation.contactPointId;
    return await apiCalls.accept(conversation.id);
  }
  else if (hints.includes('response-timer-active') || hints.includes('no-message-since-assignment')) {
    return await generateResponse(logger, conversation, botState);
  }
};

const handleConversationUpdate = async (logger, update) => {
  const {state, ackId, clientState} = update;
  const botState = clientState || {};

  logger.log(`Bot State Before Update ${JSON.stringify(botState)}`);
  botState.lastCustomerMessageText = update.derivedData.lastCustomerMessage.text;
  try {
    await reactToConversationUpdate(logger, state, update.hints, botState);
  } catch (e) {
    logger.log(`Error while handling conversation update!`, e);
  }
  logger.log(`Bot State After Update ${JSON.stringify(botState)}`);

  await apiCalls.acknowledge(state.id, {ackId, clientState: botState});
};

const handleConversationEvents = async (logger, updates) => {
  for (update of updates){
    await handleConversationUpdate(logger, update);
  }
}

module.exports = handleConversationEvents;
