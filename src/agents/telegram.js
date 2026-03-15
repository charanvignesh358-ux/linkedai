// ================================================================
//  telegram.js — Telegram sender via Cloudflare Worker relay
// ================================================================

const RELAY_URL = 'https://shiny-mountain-c7b9.charanvignesh358.workers.dev';

/**
 * Send a message via Cloudflare Worker relay
 */
export async function sendTelegramMessage(token, chatId, text) {
  if (!token || !chatId) throw new Error('Missing token or chatId');

  const res = await fetch(RELAY_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      token:  token.trim(),
      chatId: String(chatId).trim(),
      text:   text,
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Relay returned invalid response (status ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `Relay error: ${res.status}`);
  }

  if (!data.ok) {
    throw new Error(data.description || 'Telegram API error');
  }

  return data;
}

/**
 * Test message
 */
export async function testTelegramBot(token, chatId) {
  const msg = [
    `🤖 LinkedAI Bot Connected!`,
    ``,
    `Your Telegram notifications are working!`,
    `You will receive alerts for:`,
    `- Job applications`,
    `- Connection requests`,
    `- Pipeline completions`,
    ``,
    new Date().toLocaleString(),
  ].join('\n');

  return sendTelegramMessage(token, chatId, msg);
}

/**
 * Pipeline complete summary
 */
export async function notifyPipelineComplete(token, chatId, results) {
  if (!token || !chatId) return;

  const applied     = (results.applied     || []).filter(a => a?.applyResult?.success).length;
  const connections = (results.connections || []).filter(c => c?.result?.success).length;
  const jobsFound   = (results.jobsFound   || []).length;
  const status      = results.status === 'success' ? '✅' : results.status === 'warning' ? '⚠️' : '❌';

  const msg = [
    `${status} LinkedAI Pipeline Complete`,
    ``,
    `Jobs Found: ${jobsFound}`,
    `Applied: ${applied}`,
    `Connections Sent: ${connections}`,
    ``,
    new Date().toLocaleString(),
  ].join('\n');

  try {
    await sendTelegramMessage(token, chatId, msg);
    console.log('Telegram pipeline summary sent');
  } catch (e) {
    console.warn('Telegram notify failed (non-fatal):', e.message);
  }
}
