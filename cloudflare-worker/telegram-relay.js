export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // Health check via GET
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, message: 'Telegram relay is running!' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Must be POST from here
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Use POST' }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    let body = {};
    try {
      const raw = await request.text();
      body = JSON.parse(raw);
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body: ' + e.message }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const token  = (body.token  || '').toString().trim();
    const chatId = (body.chatId || '').toString().trim();
    const text   = (body.text   || '').toString().trim();

    // Validate
    if (!token) return new Response(JSON.stringify({ ok: false, error: 'Missing: token' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (!chatId) return new Response(JSON.stringify({ ok: false, error: 'Missing: chatId' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (!text)   return new Response(JSON.stringify({ ok: false, error: 'Missing: text' }),   { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    // Forward to Telegram
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text }),
      });
      const data = await tgRes.json();
      return new Response(JSON.stringify(data), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: 'Telegram fetch failed: ' + err.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
