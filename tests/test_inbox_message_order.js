#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const cloud = fs.readFileSync('app/src/main/assets/cloud.js', 'utf8');
const start = cloud.indexOf('async function listClubMessages(');
const end = cloud.indexOf('async function sendClubMessage(', start);
assert.ok(start >= 0 && end > start);
const context = {
  role: () => 'coach',
  rpc: async () => [
    {message_id: 'new', thread_id: 'current', sender_user_id: 'me', recipient_user_id: 'parent', sent_at: '2026-09-26T12:00:00Z'},
    {message_id: 'old', thread_id: 'old-thread', sender_user_id: 'parent', recipient_user_id: 'me', sent_at: '2026-09-25T12:00:00Z'},
  ],
};
vm.runInNewContext(cloud.slice(start, end), context);

(async () => {
  const messages = await context.listClubMessages();
  assert.deepEqual(Array.from(messages, m => m.id), ['old', 'new']);

  const app = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
  const functionStart = app.indexOf('function existingInboxThread(');
  const functionEnd = app.indexOf('async function sendInboxMessage(', functionStart);
  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  const view = {__inboxMessages: messages, inboxMyUserId: () => 'me'};
  vm.runInNewContext(app.slice(functionStart, functionEnd), view);
  assert.equal(view.existingInboxThread('parent'), 'current');
  console.log('PASS inbox shows messages in time order and replies to latest thread');
})().catch(error => {console.error(error);process.exitCode = 1;});
