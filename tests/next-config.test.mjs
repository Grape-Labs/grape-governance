import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';

test('Next exposes browser configuration without copying server credentials', async () => {
  const keys=['REACT_APP_MIGRATION_TEST','FIREBASE_PRIVATE_KEY','API_V1_KEYS','CRON_SECRET'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  for(const key of keys)process.env[key]='test-only-sentinel';
  try {
    const {default: config}=await import('../next.config.mjs');
    assert.equal(config.env.REACT_APP_MIGRATION_TEST,'test-only-sentinel');
    for(const key of keys.slice(1))assert.equal(config.env[key],undefined);
    assert.ok(['true','false'].includes(config.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED));
  } finally {
    for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  }
});

test('all public legacy handlers have native Next API routes and v1 supports nested paths', async () => {
  const entries=await readdir(new URL('../api/',import.meta.url));
  for(const name of entries.filter(name=>!name.startsWith('_')&&/\.(js|ts)$/.test(name)&&name!=='v1.js')) {
    const route=await readFile(new URL('../src/pages/api/'+name.replace(/\.(js|ts)$/,'.ts'),import.meta.url),'utf8');
    assert.ok(route.includes("../../../api/"+name));
  }
  const nested=await readFile(new URL('../src/pages/api/v1/[[...path]].ts',import.meta.url),'utf8');
  assert.ok(nested.includes('../../../../api/v1.js'));
});
