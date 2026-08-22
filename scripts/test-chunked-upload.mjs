// End-to-end test of the chunked upload system against the live backend.
const API = "http://127.0.0.1:3210/api";

async function callConvex(kind, name, args, token) {
  const res = await fetch(`${API}/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ path: name, args, format: "json" }),
  });
  const body = await res.json();
  if (body.status !== "success") throw new Error(`${kind}:${name} -> ${JSON.stringify(body).slice(0, 300)}`);
  return body.value;
}

// 1. Sign in
const signIn = await callConvex("action", "auth:signIn", {
  provider: "password",
  params: { flow: "signIn", email: "full.check@example.com", password: "check12345" },
});
const token = signIn?.tokens?.token ?? null;
if (!token) { console.log("SIGNIN_FAILED", JSON.stringify(signIn).slice(0, 200)); process.exit(1); }
console.log("1. sign-in OK");

// 2. Build a resume file (~600KB => multi-chunk) as base64
const rawBytes = Buffer.alloc(600 * 1024);
rawBytes.write("Rahul Test\nEmail: rahul.test@example.com\nPhone: +91 98765 43210\nLocation: Mumbai\nSkills: Python, SQL, Excel, Communication\nEducation: BSc Computer Science - Mumbai University\n");
for (let i = 100; i < rawBytes.length; i++) rawBytes[i] = 65 + (i % 26);
const b64 = rawBytes.toString("base64");
const CHUNK = 700000;
const chunks = [];
for (let i = 0; i < b64.length; i += CHUNK) chunks.push(b64.slice(i, i + CHUNK));
console.log(`2. file built: ${rawBytes.length} bytes -> ${chunks.length} chunks`);

// 3-5. The exact new flow: begin -> push chunks -> finalize
const sessionId = await callConvex("mutation", "uploads:beginChunkedUpload", {
  fileName: "rahul-resume.txt", mimeType: "text/plain", totalChunks: chunks.length,
}, token);
console.log("3. session:", sessionId);
for (let i = 0; i < chunks.length; i++) {
  await callConvex("mutation", "uploads:pushUploadChunk", { sessionId, index: i, data: chunks[i] }, token);
}
console.log("4. chunks pushed:", chunks.length);

const fin = await callConvex("action", "uploads:finalizeChunkedUpload", { sessionId }, token);
const storageId = String(fin.storageId);
console.log(`5. finalized -> storageId=${storageId} size=${fin.size} (expected ${rawBytes.length}) ${fin.size === rawBytes.length ? "BYTES_MATCH" : "SIZE_MISMATCH!"}`);

// 6. Scan with the real parser
const scan = await callConvex("action", "resume:parseResume", { storageId }, token);
console.log("6. scan:", JSON.stringify({ ok: scan.ok, name: scan.name, email: scan.email, phone: scan.phone, location: scan.location, skills: scan.skills }));

// 7. Attach to profile like the UI does, read it back
await callConvex("mutation", "profiles:setResume", { storageId, fileName: "rahul-resume.txt" }, token);
const prof = await callConvex("query", "profiles:getMyProfile", {}, token);
console.log("7. profile resumeFileName:", prof?.resumeFileName ?? "(none)");
console.log("ALL_DONE");
