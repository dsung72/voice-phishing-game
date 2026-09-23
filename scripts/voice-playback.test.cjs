const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Exercise the game's actual segmented speech callbacks. The companion audio
// lifecycle test verifies that setSpeaking(true) makes the music bus exactly 0.
function setup() {
  const speaking=[], utterances=[], timers=new Map(), elements=new Map();
  let nextTimer=0, failSpeak=false;
  const node=()=>{
    const classes=new Set();
    return {textContent:'',style:{},classList:{
      toggle(c,on){if(on)classes.add(c);else classes.delete(c)},
      add(c){classes.add(c)},remove(c){classes.delete(c)},contains:c=>classes.has(c)
    },setAttribute(){},querySelector:selector=>get(selector)};
  };
  const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
  const panel=get('.voice-audio-panel');
  const document={
    addEventListener(){},querySelectorAll:()=>[],getElementById:get,
    querySelector:selector=>selector==='.voice-audio-panel'?panel:null
  };
  const window={
    addEventListener(){},scrollTo(){},GameAudio:{setSpeaking:v=>speaking.push(v),setScreen(){},effect(){}},
    speechSynthesis:{cancel(){},getVoices:()=>[],addEventListener(){},speak(u){
      if(failSpeak)throw new Error('engine unavailable');
      utterances.push(u);u.onstart?.();
    }},
    SpeechSynthesisUtterance:class {constructor(text){this.text=text}}
  };
  const sandbox={window,document,console,Date,
    SpeechSynthesisUtterance:window.SpeechSynthesisUtterance,
    setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer},
    clearTimeout:id=>timers.delete(id),setInterval:()=>1,clearInterval(){}
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(__dirname,'../assets/game.js'),'utf8'),sandbox);
  for(const fn of timers.values())fn(); // Initial browser voice-list warmup.
  timers.clear();
  const run=code=>vm.runInContext(code,sandbox);
  run('state.mode="voice-audio";state.queue=SCENARIOS.filter(s=>s.type==="voice");state.index=0');
  return {run,panel,speaking,utterances,timers,
    step(){const entry=timers.entries().next().value;assert(entry);timers.delete(entry[0]);entry[1]()},
    fail(){failSpeak=true},silent:()=>speaking.at(-1)===true};
}

const natural=setup();natural.run('playVoiceScenario()');
assert(natural.silent(),'music silenced before speech starts');
let segments=0;
while(natural.silent() && segments<30) {
  natural.utterances.at(-1).onend();
  assert(natural.silent(),'inter-segment pauses remain silent');
  natural.step();segments++;
}
assert(segments>1 && segments<30,'multi-segment script reaches its end');
assert.equal(natural.silent(),false,'natural completion restores music');

const stop=setup();stop.run('playVoiceScenario()');
const stale=stop.utterances.at(-1);stale.onend();
stop.run('stopVoicePlayback()');
assert.equal(stop.timers.size,0,'stop clears the pending next segment');
assert.equal(stop.silent(),false,'manual stop restores music');
stop.run('playVoiceScenario()');
stale.onend();stale.onerror({error:'canceled'});
assert(stop.silent(),'old callbacks cannot unmute the new speech');
stop.run('showScreen("mode")');stale.onstart();
assert.equal(stop.silent(),false,'leaving the game cancels speech and restores music');

for(const error of ['synthesis-failed','interrupted','canceled','not-allowed']) {
  const game=setup();game.run('playVoiceScenario()');
  game.utterances.at(-1).onerror({error});
  assert.equal(game.silent(),false,`${error} restores music`);
  assert.equal(game.panel.classList.contains('speaking'),false);
}
const thrown=setup();thrown.fail();thrown.run('playVoiceScenario()');
assert.equal(thrown.silent(),false,'synchronous engine failure restores music');
console.log('PASS: segmented TTS, silent pauses, natural completion, stop/replay, stale callbacks, navigation, canceled/interrupted/failed speech');
