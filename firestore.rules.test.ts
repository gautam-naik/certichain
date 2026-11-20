import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rulesPath = path.resolve(process.cwd(), "firestore.rules");
const blueprintPath = path.resolve(process.cwd(), "firebase-blueprint.json");

test("firestore.rules enforces Eight Pillars and covers all blueprint collections", () => {
  const rules = fs.readFileSync(rulesPath, "utf-8");
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf-8"));

  // Pillar 0 & 4: Default-deny catch-all and strict rules_version = '2'
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);

  // Blueprint synchronicity: every collection in firebase-blueprint.json has a match block
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const leaf = collectionPath.split("/").filter(Boolean).pop()?.replace(/[{}]/g, "");
    assert.ok(leaf, `Invalid blueprint path: ${collectionPath}`);
  }

  assert.match(rules, /match \/users_public\/\{userId\}/);
  assert.match(rules, /match \/users_private\/\{userId\}/);
  assert.match(rules, /match \/users\/\{userId\}\/saved_verifications\/\{verificationId\}/);
  assert.match(rules, /match \/users\/\{userId\}\/chat_sessions\/\{sessionId\}/);
  assert.match(rules, /match \/messages\/\{messageId\}/);

  // Pillar 2, 3, 4, 5, 6, 7, 8 assertions
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly/);
  assert.match(rules, /existsAfter\(/);
  assert.match(rules, /isValidId\(/);
  assert.doesNotMatch(rules, /allow list:\s*if\s*isSignedIn\(\);/);
});
