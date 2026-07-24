const apiKey = 'H2GAMVZL6FMJY1XP90EEY2A33SYNXIL3L9GOVWJE';
const testPhone = '0911234567'; // Just a dummy to test API connection
const message = 'Test message';

async function testApi(url, payload, headers) {
  try {
    console.log(`Testing ${url}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${text}\n`);
  } catch (e) {
    console.log(`Error: ${e.message}\n`);
  }
}

async function run() {
  const commonEndpoints = [
    {
      url: 'https://api.sms-ethiopia.com/v1/send',
      payload: { to: testPhone, message, sender: 'Lazim Rent' },
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    },
    {
      url: 'https://app.sms-ethiopia.com/api/v3/sms/send',
      payload: { recipient: testPhone, sender_id: 'Lazim Rent', type: 'plain', message },
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    }
  ];

  for (const ep of commonEndpoints) {
    await testApi(ep.url, ep.payload, ep.headers);
  }
}

run();
