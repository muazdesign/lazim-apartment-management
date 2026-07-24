async function testWebhook() {
  try {
    const res = await fetch("https://lazim-apartment-management.vercel.app/api/telegram/webhook", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "message": {
          "chat": { "id": 7449235626 },
          "text": "/start"
        }
      })
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    for (let [key, val] of res.headers.entries()) {
      console.log(`${key}: ${val}`);
    }
    console.log(`Response: ${text}`);
  } catch (e) {
    console.log("Error:", e);
  }
}
testWebhook();
