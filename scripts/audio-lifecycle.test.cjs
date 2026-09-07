const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code=readFileSync(require('node:path').join(__dirname,'../assets/game-audio.js'),'utf8');
const flush=async()=>{for(let i=0;i<12;i++) await Promise.resolve()};

function setup(saved=null, supported=true) {
  let clock=100, allowed=false;
  const nodes=[], contexts=[], downloads=[], storage=new Map();
  if(saved) storage.set('voice_game_sound_v1',JSON.stringify(saved));
  class EventTarget {
    constructor(){this.events={};this.attrs={};this.value='';this.classList={toggle(){}};}
    addEventListener(name, fn){(this.events[name] ||= []).push(fn)}
    fire(name, event={}){for(const fn of this.events[name] || []) fn(event)}
    setAttribute(k,v){this.attrs[k]=v}
    contains(){return false}
  }
  class Param {
    constructor(v=1){this.value=v}
    cancelAndHoldAtTime(){}
    cancelScheduledValues(){}
    setValueAtTime(v){assert(Number.isFinite(v));this.value=v}
    linearRampToValueAtTime(v){assert(Number.isFinite(v));this.value=v}
    exponentialRampToValueAtTime(v){assert(v>0);this.value=v}
  }
  class AudioNode {
    constructor(type){this.kind=type;this.gain=new Param();this.frequency=new Param();nodes.push(this)}
    connect(node){this.target=node}
    disconnect(){this.disconnected=true}
    start(){this.started=true}
    stop(){this.stopped=true}
  }
  class AudioContext extends EventTarget {
    constructor(){super();this.state='suspended';this.sampleRate=32000;this.currentTime=0;this.destination={};this.resumes=[];contexts.push(this)}
    createGain(){return new AudioNode('gain')}
    createDynamicsCompressor(){const n=new AudioNode('compressor');for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param();return n}
    createOscillator(){return new AudioNode('oscillator')}
    createBufferSource(){return new AudioNode('source')}
    createBiquadFilter(){return new AudioNode('filter')}
    createBuffer(channels,count){return {getChannelData:()=>new Float32Array(count)}}
    decodeAudioData(data){return Promise.resolve({name:data.name,duration:50})}
    resume(){
      if(allowed){this.state='running';this.fire('statechange');return Promise.resolve()}
      return new Promise(resolve=>this.resumes.push(resolve))
    }
    suspend(){this.state='suspended';this.fire('statechange');return Promise.resolve()}
  }
  const elements=new Map();
  for(const id of ['sound-tools','sound-mute','sound-summary','sound-status','sound-music','sound-effects','sound-music-value','sound-effects-value'])elements.set(id,new EventTarget());
  const document=new EventTarget();document.hidden=false;document.currentScript={src:'https://example.test/game/assets/game-audio.js'};
  document.getElementById=id=>elements.get(id);
  const window=new EventTarget();if(supported)window.AudioContext=AudioContext;
  const sandbox={window,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}, URL, console, performance:{now:()=>clock},fetch:async url=>{downloads.push(String(url));return {ok:true,arrayBuffer:async()=>({name:url.pathname.split('/').pop()})}}};
  vm.runInNewContext(code,sandbox);
  return {audio:window.GameAudio,window,document,elements,nodes,contexts,downloads,storage,
    music:()=>nodes.filter(n=>n.kind==='source'&&n.loop&&n.started&&!n.stopped),
    effects:()=>nodes.filter(n=>n.kind==='oscillator'&&n.started),
    tick:()=>clock+=100,
    activate:()=>{allowed=true;for(const c of contexts){c.state='running';c.fire('statechange');for(const done of c.resumes)done();c.resumes=[]}},
  };
}

(async()=>{
  const g=setup();g.audio.init();await flush();
  assert.equal(g.music().length,0,'blocked autoplay is quiet');
  g.audio.effect('start');g.activate();await flush();
  assert.equal(g.contexts.length,1,'single AudioContext');
  assert.equal(g.music().length,1,'single landing loop');
  assert.equal(g.music()[0].buffer.name,'hero-theme.mp3');
  assert(g.effects().length>=3,'first gesture plays its effect after unlock');
  assert(g.downloads.every(url=>url.startsWith('https://example.test/game/assets/audio/')),'subpath URLs');
  g.tick();g.audio.setScreen('game');await flush();
  assert.equal(g.music().length,1);assert.equal(g.music()[0].buffer.name,'calm-focus.mp3');
  const calm=g.music()[0];g.audio.setScreen('game');g.audio.setSpeaking(true);
  assert.equal(g.music()[0],calm,'same scene does not restart the music');
  const musicBus=calm.target.target;
  assert.equal(musicBus.gain.value,.65*.16,'speech ducks the music');
  g.audio.setSpeaking(false);assert.equal(musicBus.gain.value,.65,'speech stop restores music');
  const before=g.effects().length;g.tick();g.audio.effect('click');g.audio.effect('complete');
  assert(g.effects().length>=before+7,'completion is not throttled by a preceding click');
  g.elements.get('sound-mute').fire('click');await flush();
  assert.equal(g.music().length,0,'mute stops music');
  const mutedEffects=g.effects().length;g.tick();g.audio.effect('correct');assert.equal(g.effects().length,mutedEffects);
  assert.equal(JSON.parse(g.storage.get('voice_game_sound_v1')).muted,true);
  g.elements.get('sound-mute').fire('click');await flush();assert.equal(g.music().length,1,'unmute restores current scene');
  g.document.hidden=true;g.document.fire('visibilitychange');await flush();
  assert.equal(g.contexts[0].state,'suspended');
  g.document.hidden=false;g.document.fire('visibilitychange');await flush();assert.equal(g.contexts[0].state,'running');
  g.elements.get('sound-music').fire('input',{target:{value:'0'}});assert.equal(g.music().length,0,'music-only mute');
  g.tick();const old=g.effects().length;g.audio.effect('correct');assert(g.effects().length>old,'effects remain on with music at zero');
  const persisted=setup({music:0,effects:.7,muted:false});persisted.audio.init();persisted.activate();await flush();assert.equal(persisted.music().length,0,'zero volume survives reload');
  const muted=setup({music:.65,effects:.7,muted:true});muted.audio.init();muted.activate();await flush();assert.equal(muted.contexts.length,0,'saved mute prevents autoplay');
  const unsupported=setup(null,false);unsupported.audio.init();unsupported.audio.effect('click');assert(unsupported.elements.get('sound-status').textContent.includes('지원하지'));
  const race=setup();race.audio.init();race.activate();race.audio.setScreen('game');race.audio.setScreen('landing');await flush();
  assert.equal(race.music().length,1);assert.equal(race.music()[0].buffer.name,'hero-theme.mp3','late decode follows latest screen');
  console.log('PASS: autoplay, first-click effect, crossfade, speech ducking, completion, mute, persisted zero, background resume, unsupported audio, async scene race');
})().catch(e=>{console.error(e);process.exitCode=1});
