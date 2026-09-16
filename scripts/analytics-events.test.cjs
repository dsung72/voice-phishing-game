const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(savedConsent = null, protocol = 'https:', storageBlocked = false) {
  const elements = new Map();
  const scripts = [];
  const listeners = new Map();
  const storage = new Map();
  if (savedConsent) storage.set('voice_game_analytics_consent', savedConsent);
  const node = () => ({classList:{add(){},remove(){},toggle(){}},style:{},setAttribute(){}});
  const document = {
    head:{appendChild:script=>scripts.push(script)}, createElement:()=>({}),
    getElementById:id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);},
    querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){},
  };
  const sandbox = {
    document, location:{protocol}, console, Date,
    localStorage:{getItem:key=>{if(storageBlocked)throw new Error('blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(storageBlocked)throw new Error('blocked');storage.set(key,value);}},
    window:{addEventListener:(name,fn)=>listeners.set(name,fn),scrollTo(){}},
    setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
  };
  vm.createContext(sandbox);
  for(const file of ['analytics.js','game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets',file),'utf8'),sandbox);
  }
  listeners.get('DOMContentLoaded')();
  return {
    run:code=>vm.runInContext(code,sandbox), scripts, storage,
    calls:()=>Array.from(sandbox.window.dataLayer,call=>Array.from(call)),
    events:()=>Array.from(sandbox.window.dataLayer).filter(call=>call[0]==='event'),
  };
}

const fresh=setup();
assert.equal(fresh.scripts.length,0,'no analytics request before consent');
assert.equal(fresh.calls().length,0,'no queued tracking before consent');
fresh.run('showScreen("mode")');
fresh.run('setAnalyticsConsent("granted")');
fresh.run('setAnalyticsConsent("granted")');
fresh.run('window.loadGoogleAnalytics()');
assert.equal(fresh.scripts.length,1,'one Google tag loader');
const configs=fresh.calls().filter(call=>call[0]==='config');
assert.equal(configs.length,1,'one automatic page view configuration');
assert.equal(configs[0][1],'G-95DKGBG9MY');
assert.equal(configs[0][2].send_page_view,true);
assert.equal(fresh.events().length,1,'consent repeat does not repeat current screen');
assert.equal(fresh.events()[0][2].screen_name,'mode','no backfill of screens seen before consent');
fresh.run('showScreen("game"); showScreen("game"); showScreen("result"); showScreen("recovery"); showScreen("result")');
assert.deepEqual(fresh.events().map(call=>call[2].screen_name),['mode','game','result','recovery','result']);
assert(fresh.events().every(call=>call[1]==='game_screen_view'),'navigation never emits page_view or screen_view');
fresh.run('setAnalyticsConsent("denied"); showScreen("mode")');
assert.equal(fresh.events().length,5,'denied game events are not queued');

const returning=setup('granted');
assert.equal(returning.scripts.length,1);
assert.equal(returning.events().length,1);
assert.equal(returning.events()[0][2].screen_name,'landing');
returning.run('showScreen("landing")');
assert.equal(returning.events().length,1,'startup re-render is not a second screen view');
const denied=setup('denied');
denied.run('showScreen("mode"); showScreen("game")');
assert.equal(denied.calls().length,0);
const offline=setup('granted','file:');
offline.run('showScreen("mode")');
assert.equal(offline.calls().length,0);
const privateMode=setup(null,'https:',true);
privateMode.run('setAnalyticsConsent("granted"); showScreen("mode")');
assert.equal(privateMode.scripts.length,1,'storage failure does not break consented play');
assert.equal(privateMode.events().length,2);
console.log('PASS: consent, one page-view configuration, custom navigation events, repeat-screen deduplication, returning visitors, local-file exclusion, unavailable storage');
