// ================================================================
//  src/agents/pipelineRunner.js  — v4.1  (Bug Fixed)
//
//  Fixes vs v4.0:
//   ✅ FIX #8: BACKEND URL now reads from REACT_APP_BACKEND_URL
//      env var first, falling back to localhost:4000. No more
//      hardcoded URL — production deployments work correctly.
// ================================================================

// FIX #8: configurable backend URL via env var
const BACKEND = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');

let _xhr     = null;
let _running = false;

export function isPipelineRunning() { return _running; }

export function stopPipeline() {
  if (_xhr) { _xhr.abort(); _xhr = null; }
  _running = false;
}

/**
 * Start the SSE pipeline.
 *
 * @param {object}   params      - Sent as JSON body to /api/agent/run
 * @param {object}   callbacks
 *   @param {Function} onEvent    (phase, message, data)   — every SSE event
 *   @param {Function} onStats    (statsUpdate)            — incremental stat deltas
 *   @param {Function} onComplete (finalResult | null)     — pipeline finished
 *   @param {Function} onError    (errorString)            — pipeline failed
 */
export function startPipeline(params, callbacks) {
  if (_running) { console.warn('[Runner] already running'); return; }

  const { onEvent, onStats, onComplete, onError } = callbacks;
  _running = true;

  onEvent?.('ping', '🔌 Connecting to backend…', {});

  const xhr = new XMLHttpRequest();
  _xhr = xhr;

  xhr.open('POST', `${BACKEND}/api/agent/run`, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 600_000; // 10 min

  let charPos     = 0;
  let sseBuffer   = '';
  let finalResult = null;

  // ── SSE parser ────────────────────────────────────────────────
  function processBuffer() {
    const parts  = sseBuffer.split('\n\n');
    sseBuffer    = parts.pop(); // last segment may be incomplete

    for (const part of parts) {
      let dataLine = '';
      for (const line of part.split('\n')) {
        const t = line.trim();
        if (t.startsWith('data: ')) {
          dataLine += (dataLine ? '\n' : '') + t.slice(6);
        }
      }
      if (!dataLine) continue;

      try {
        const data = JSON.parse(dataLine);
        const { phase, message } = data;

        console.log(`[Runner] ← ${phase} | ${(message || '').slice(0, 80)}`);

        if (data.results) finalResult = data.results;
        // FIX A: pass ONLY the statsUpdate delta, not the whole data object
        if (data.statsUpdate && typeof data.statsUpdate === 'object' && onStats) {
          onStats(data.statsUpdate);
        }

        onEvent?.(phase, message, data);

      } catch (e) {
        console.warn('[Runner] JSON parse error:', e.message, '| raw:', dataLine.slice(0, 120));
      }
    }
  }

  xhr.onreadystatechange = () => {
    if (xhr.readyState < 3) return;

    const text = xhr.responseText || '';
    if (text.length === charPos) return;

    sseBuffer += text.slice(charPos);
    charPos    = text.length;

    processBuffer();

    if (xhr.readyState === 4) {
      sseBuffer += '\n\n';
      processBuffer();

      _xhr     = null;
      _running = false;

      if (xhr.status === 200) {
        console.log('[Runner] pipeline complete. finalResult:', finalResult ? 'present' : 'null');
        onComplete?.(finalResult);
      } else if (xhr.status !== 0) {
        onError?.(`Backend error ${xhr.status}: ${xhr.statusText}`);
      }
    }
  };

  xhr.onerror   = () => {
    _xhr     = null;
    _running = false;
    onError?.(`❌ Cannot reach backend at ${BACKEND} — open a terminal and run:\n  cd backend && node server.js`);
  };

  xhr.ontimeout = () => {
    _xhr     = null;
    _running = false;
    onError?.('Pipeline timed out (10 min). Check backend logs.');
  };

  xhr.onabort   = () => {
    _xhr     = null;
    _running = false;
    console.log('[Runner] pipeline aborted by user');
  };

  console.log(`[Runner] → POST ${BACKEND}/api/agent/run | email: ${params.email} | userId: ${params.userId || 'MISSING'}`);
  xhr.send(JSON.stringify(params));
}
