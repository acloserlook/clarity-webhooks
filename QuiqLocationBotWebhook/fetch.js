const nodeFetch = require('node-fetch');
const siteRoot = 'https://acloserlook-stage.goquiq.com'; // ${process.env.site}
const appId = 'f8d8e5b4-72df-4328-bc4a-899363b82a78'; //'prod-clarity-functionapp'; // ${process.env.appId}
const appSecret = 'eyJhbGciOiJIUzI1NiIsImtpZCI6ImJhc2ljOjAifQ.eyJ0ZW5hbnQiOiJhY2xvc2VybG9vay1zdGFnZSIsInN1YiI6Ijk0ODcwIn0.IQ9Gob237MbNQnLsqXdQILnLlTw2STpZlA-i8t4Wc00'; // ${process.env.appSecret}

const fetch = async (path, options) => {
  const method = options.method || 'GET';
  const body = options.body;
  const responseType = 'none';

  try {
    const fetchOptions = {
      method,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-cache',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${appId}:${appSecret}`,
          'binary',
        ).toString('base64')}`,
      },
    };

    const res = await nodeFetch(`${siteRoot}/${path}`, fetchOptions);

    if (res.status >= 400) {
      throw new Error(res.message);
    }

    if (responseType === 'json') return await res.json();

    return;
  } catch (e) {
    console.log("Fetch Error: " + JSON.stringify(e));
    throw new Error(e.message);
  }
};

module.exports = fetch;
