import { pilotBadge } from './pilot-badges.js';
import { badgeReview } from './badge-review.js';
import { selkentCandidate } from './selkent-candidate.js';
import { selkentFeed } from './selkent-feed.js';

// The existing static assets remain the authority for public directory and fixtures.
// This diagnostic only reports their freshness within the protected pilot site.
const FEEDS = {
  directory: { path: '/data/directory.json', maxAgeHours: 9 * 24 },
  fixtures: { path: '/data/results.json', maxAgeHours: 18 },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/__pilot_badges/')) return pilotBadge(request, env);
    if (url.pathname === '/__badge_review') return badgeReview(request, env);
    if (url.pathname === '/__selkent_candidate') return selkentCandidate(request, env);
    if (url.pathname === '/data/results.json') return selkentFeed(request, env);
    if (url.pathname !== '/__health') return env.ASSETS.fetch(request);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    };
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...headers, Allow: 'GET' },
      });
    }
    const now = Date.now();
    const checks = await Promise.all(Object.entries(FEEDS).map(async ([name, feed]) => {
      try {
        const asset = await env.ASSETS.fetch(new Request(new URL(feed.path, url)));
        if (!asset.ok) throw new Error(`Asset HTTP ${asset.status}`);
        const data = await asset.json();
        const updated = Date.parse(data.last_updated);
        if (!Number.isFinite(updated) || updated > now + 5 * 60_000) {
          throw new Error('Invalid feed timestamp');
        }
        const ageHours = Math.round((now - updated) / 3_600_000 * 10) / 10;
        return [name, { last_updated: data.last_updated, age_hours: ageHours,
          max_age_hours: feed.maxAgeHours, status: ageHours > feed.maxAgeHours ? 'stale' : 'fresh' }];
      } catch {
        return [name, { status: 'unavailable' }];
      }
    }));
    const feeds = Object.fromEntries(checks);
    const healthy = Object.values(feeds).every(feed => feed.status === 'fresh');
    return new Response(JSON.stringify({ status: healthy ? 'healthy' : 'degraded', feeds }), {
      status: healthy ? 200 : 503, headers,
    });
  },
};
