const axios = require('axios');
const QS = require('querystring');

async function getAccessToken() {
    const data = {
        grant_type: 'client_credentials',
        client_id: process.env.POWER_BI_CLIENT_ID,
        client_secret: process.env.POWER_BI_CLIENT_SECRET,
        resource: 'https://analysis.windows.net/powerbi/api'
    };

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const result = await axios({
        url: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/token`,
        data: QS.stringify(data),
        headers,
        method: 'post'
    });

    return result.data;
}

async function refreshDataset({ accessToken, groupId, datasetId }) {

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };

    const result = await axios({
        url: `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/datasets/${datasetId}/refreshes`,
        headers,
        method: 'post'
    });

    return result.data;
}

const runRefresh = groupId => async datasetId => {
  const accessToken = await getAccessToken();
  try {
      const result = await refreshDataset({ accessToken: accessToken.access_token, groupId, datasetId });
      console.log('Result: ' + result);
  } catch (e) {
      console.log('Error: ' + e);
  }
}

module.exports = async function (context, req) {
  runRefresh('4906b348-a437-49dd-b7c8-a96cdb0ab599')('62acc428-76b4-48f1-be79-448c5d1fca38');
  runRefresh('4906b348-a437-49dd-b7c8-a96cdb0ab599')('1a4542df-a89b-4fb4-9de4-686bc1c2afd9');
}            