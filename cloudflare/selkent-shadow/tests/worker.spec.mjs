import { SELF } from 'cloudflare:test';
import { expect, test } from 'vitest';

test('configured production entrypoint boots and exposes no public data route', async () => {
  const response = await SELF.fetch('https://private-worker.invalid/');
  expect(response.status).toBe(404);
  expect(await response.text()).toBe('Not found');
});
