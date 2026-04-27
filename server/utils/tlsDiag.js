/**
 * TLS / connectivity diagnostic for test.cept.gov.in
 *
 * Run from the server/ directory:
 *   node utils/tlsDiag.js
 */

require("dotenv").config();

const https = require("https");
const tls   = require("tls");
const net   = require("net");

const HOST       = "test.cept.gov.in";
const PORT       = 443;
const LOGIN_PATH = "/beextcustomer/v1/access/login";
const USERNAME   = process.env.INDIAPOST_USERNAME || "1100008334";
const PASSWORD   = process.env.INDIAPOST_PASSWORD || "Dop@1234";

// ─── 1. Raw TCP ───────────────────────────────────────────────────────────────
function checkTcp() {
  return new Promise((resolve) => {
    console.log(`\n[1] TCP — connecting to ${HOST}:${PORT} …`);
    const sock = net.createConnection({ host: HOST, port: PORT, timeout: 8000 });
    sock.once("connect", () => { console.log("    ✅ TCP connected"); sock.destroy(); resolve(true); });
    sock.once("timeout", () => { console.log("    ❌ TCP timeout");   sock.destroy(); resolve(false); });
    sock.once("error",  (e) => { console.log(`    ❌ TCP error: ${e.message}`);      resolve(false); });
  });
}

// ─── 2. TLS probe — try every meaningful combination ─────────────────────────
const TLS_VERSIONS = ["TLSv1.3", "TLSv1.2", "TLSv1.1", "TLSv1"];

// Cipher groups from modern → legacy
const CIPHER_SETS = {
  "Modern (ECDHE-AES-GCM)":
    "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384",
  "Classic (ECDHE-AES-SHA)":
    "ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA",
  "RSA-AES":
    "AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA",
  "Legacy (3DES / RC4)":
    "DES-CBC3-SHA:RC4-SHA:RC4-MD5",
  "DEFAULT (let Node decide)":
    tls.DEFAULT_CIPHERS,
};

function probeTls(version, cipherLabel, ciphers) {
  return new Promise((resolve) => {
    const opts = {
      host: HOST, port: PORT, servername: HOST,
      rejectUnauthorized: false,
      minVersion: version, maxVersion: version,
      ciphers,
    };
    const sock = tls.connect(opts, () => {
      const info = {
        proto:  sock.getProtocol(),
        cipher: sock.getCipher()?.name,
        cert:   sock.getPeerCertificate()?.subject?.CN,
        expiry: sock.getPeerCertificate()?.valid_to,
        auth:   sock.authorized,
      };
      sock.destroy();
      resolve({ ok: true, ...info });
    });
    sock.setTimeout(6000, () => { sock.destroy(); resolve({ ok: false, reason: "timeout" }); });
    sock.once("error", (e) => { sock.destroy(); resolve({ ok: false, reason: e.message }); });
  });
}

async function checkTls() {
  console.log("\n[2] TLS — probing all version × cipher combinations …");
  const winners = [];

  for (const ver of TLS_VERSIONS) {
    for (const [label, ciphers] of Object.entries(CIPHER_SETS)) {
      process.stdout.write(`    ${ver.padEnd(9)} | ${label.padEnd(35)} → `);
      const r = await probeTls(ver, label, ciphers);
      if (r.ok) {
        console.log(`✅  negotiated: ${r.proto} / ${r.cipher}`);
        winners.push({ ver, label, ciphers, proto: r.proto, cipher: r.cipher, certCN: r.cert, certExpiry: r.expiry });
      } else {
        console.log(`❌  ${r.reason}`);
      }
    }
  }

  if (winners.length === 0) {
    console.log("\n    ⛔ No TLS combination worked.");
    console.log("    Try: node --openssl-legacy-provider utils/tlsDiag.js");
  } else {
    console.log(`\n    ✅ Working combinations: ${winners.length}`);
    console.log("    Best match:", winners[0]);
  }

  return winners[0] ?? null;
}

// ─── 3. HTTP POST with winning settings ──────────────────────────────────────
function checkLogin(winner) {
  return new Promise((resolve) => {
    console.log(`\n[3] HTTP — POST https://${HOST}${LOGIN_PATH}`);

    if (!winner) {
      console.log("    ⏭  Skipped — no working TLS combo found above.");
      return resolve(false);
    }

    const body = JSON.stringify({ username: USERNAME, password: PASSWORD });

    const agent = new https.Agent({
      keepAlive: false,
      rejectUnauthorized: false,
      minVersion: winner.ver,
      maxVersion: winner.ver,
      ciphers: winner.ciphers,
    });

    const req = https.request(
      {
        hostname: HOST, port: PORT, path: LOGIN_PATH,
        method: "POST", agent,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Connection: "close",
        },
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          console.log(`    HTTP ${res.statusCode}`);
          try {
            const p = JSON.parse(data);
            console.log(`    success : ${p.success}`);
            if (p.data?.access_token) console.log(`    token   : ${p.data.access_token.slice(0, 40)}…`);
            else console.log(`    body    : ${data.slice(0, 300)}`);
          } catch { console.log(`    raw     : ${data.slice(0, 300)}`); }
          resolve(true);
        });
      }
    );
    req.on("error", (e) => { console.log(`    ❌ ${e.message} (${e.code})`); resolve(false); });
    req.on("timeout", () => { console.log("    ❌ timeout"); req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ─── 4. Print recommended apiClient.js settings ──────────────────────────────
function printRecommendation(winner) {
  if (!winner) {
    console.log(`
=======================================================
 RECOMMENDATION
=======================================================
  No TLS combination worked with the standard Node.js
  OpenSSL provider.

  Re-run with the legacy provider:
    node --openssl-legacy-provider utils/tlsDiag.js

  If that works, update package.json scripts:
    "dev":   "nodemon --exec \\"node --openssl-legacy-provider\\" app.js"
    "start": "node --openssl-legacy-provider app.js"
`);
    return;
  }

  console.log(`
=======================================================
 RECOMMENDATION — paste into utils/apiClient.js
=======================================================
const httpsAgent = new https.Agent({
  keepAlive: false,
  minVersion: "${winner.ver}",
  maxVersion: "${winner.ver}",
  ciphers: "${winner.ciphers}",
  rejectUnauthorized: false,
});
`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log("=======================================================");
  console.log(" India Post TLS / Connectivity Diagnostic");
  console.log("=======================================================");

  const tcpOk = await checkTcp();
  if (!tcpOk) {
    console.log("\n⛔ TCP blocked — check firewall/VPN. No code fix possible.");
    process.exit(1);
  }

  const winner = await checkTls();
  await checkLogin(winner);
  printRecommendation(winner);
})();
