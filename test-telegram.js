const token = "8991985048:AAGQIzgVWk3Qg5Pm4JZk1go91pKnxfVoyG4";

async function run() {
  const TELEGRAM_API = `https://api.telegram.org/bot${token}`;
  
  // Delete webhook
  await fetch(`${TELEGRAM_API}/deleteWebhook`);
  
  // get updates to find the user's chat_id
  const res = await fetch(`${TELEGRAM_API}/getUpdates`);
  const data = await res.json();
  console.log("Updates:", JSON.stringify(data, null, 2));
  
  // Set webhook back
  await fetch(`${TELEGRAM_API}/setWebhook?url=https://lazim-apartment-management.vercel.app/api/telegram/webhook`);
}
run();
