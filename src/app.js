function app(D){
// As linhas escolares atendem só estudantes: ficam fora do mapa público (lista, mapa, pontos e planejador), mesmo que venham nos dados.
D.linhas=D.linhas.filter(l=>!l.esc);
D.poi.forEach(p=>{ p.linhas=(p.linhas||[]).filter(id=>D.linhas.some(l=>l.id===id)); });
const $ = s => document.querySelector(s);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const I18N = window.__FOZ_I18N;
let verPassados=false, trechoNovo=false;
let trecho=null, trechoMarker=null, trechoK=0, extraLayer=null;
const TOL=40; // metros: um trajeto "passa no trecho" se chega a esta distância do ponto clicado
let dest=null, destMarker=null, loc=null, geoQ=null, geoRes=null, geoSt='';
let lang='pt', sel=null, dia=null, sent='T', aba='all', viagem=null, tripLayer=null;
const isMob=()=>matchMedia('(max-width:820px)').matches;
// O mapa abre sempre em português. Quem escolhe ES ou EN fica nesse idioma só durante a visita (aba aberta): antes a escolha ficava gravada
// no aparelho, e um toque sem querer em "EN" fazia o site abrir em inglês para sempre.
try{ localStorage.removeItem('mapa_lang'); const s=sessionStorage.getItem('mapa_lang'); if(s&&I18N[s]) lang=s; }catch(e){}
const T = k => I18N[lang][k];

// ── cores por família ──
const SH = [0,-14,12,-24,20,-6,28];
function fam(l){ if(l.esc) return 'fe'; const n=parseInt(l.id,10); return n<100?'f0':n<200?'f1':n<300?'f2':'f3'; }
function shade(hex,p){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255; const f=v=>Math.max(0,Math.min(255,Math.round(p<0?v*(1+p/100):v+(255-v)*p/100))); return '#'+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function lumi(hex){ const n=parseInt(hex.slice(1),16); const f=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(n>>16)+0.7152*f((n>>8)&255)+0.0722*f(n&255); }
function contraste(a,b){ const x=lumi(a)+0.05, y=lumi(b)+0.05; return x>y?x/y:y/x; }
// fundo e cor do texto para o número da linha com contraste de pelo menos 4,5:1 (escurece um pouco o fundo se nem branco nem escuro bastarem)
function fundoTinta(hex){ let c=hex; for(let k=0;k<12;k++){ if(contraste(c,'#ffffff')>=4.5) return [c,'#ffffff']; if(contraste(c,'#14212b')>=4.5) return [c,'#14212b']; c=shade(c,-6); } return [c,'#ffffff']; }
const bg=l=>'background:'+l.bgc+';color:'+l.ink;
function colorize(){ const idx={}; D.linhas.forEach(l=>{ const f=fam(l); idx[f]=(idx[f]||0); l.cor=shade(css('--'+f),SH[idx[f]%SH.length]); const ft=fundoTinta(l.cor); l.bgc=ft[0]; l.ink=ft[1]; idx[f]++; }); }
colorize();
const BYID = Object.fromEntries(D.linhas.map(l=>[l.id,l]));
// cada ponto: [lat, lon, nome de referência, [linhas], endereço, [sentido de cada linha]]; dados antigos trazem só até as linhas
D.stops.forEach(s=>{ s.L=(s[3]||[]).map((id,i)=>({id:String(id),s:(s[5]||[])[i]||''})).filter(o=>BYID[o.id]); });
const TEM_GPS = D.linhas.some(l=>l.shapes.some(s=>s.g)); // há tempos de viagem medidos por GPS nos dados

// ── tempo ──
const hm = m => String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function hoje(){ const n=new Date(); if(n.getHours()<3) n.setDate(n.getDate()-1); const d=n.getDay(); return d===0?'DOM':d===6?'SAB':'DU'; }
function agora(){ const d=new Date(); const m=d.getHours()*60+d.getMinutes(); return m<180?m+1440:m; }
// dia operacional: viagens depois da meia-noite (até 03h) contam no fim do dia anterior
// Viagens "ESP" (especiais) não levam passageiros: o ônibus só se desloca para cobrir outra viagem. Elas saem de tudo o que o público vê
// (quadro de horários, próximas saídas, planejador, trajetos no mapa e ônibus em tempo real). No cadastro, cada trajeto ESP é usado só por viagens ESP.
const ESP_RE=/(^|[^A-Za-zÀ-ÿ])ESP([^A-Za-zÀ-ÿ]|$)/i;
D.linhas.forEach(l=>{ l.depV={}; l.espM={};
  l.shapes.forEach(s=>{ if(ESP_RE.test(s.v||'')){ s.esp=1; s.main=0; } });
  if(!l.shapes.some(s=>s.main)){ const k=l.shapes.findIndex(s=>!s.esp); if(k>=0) l.shapes[k].main=1; }
  Object.keys(l.dep).forEach(dk=>{ l.depV[dk]={}; l.espM[dk]={};
    Object.keys(l.dep[dk]).forEach(s=>{ const tudo=l.dep[dk][s].map(x=>[x[0]<180?x[0]+1440:x[0],x[1]]).sort((a,b)=>a[0]-b[0]), arr=tudo.filter(x=>!l.shapes[x[1]].esp);
      l.espM[dk][s]=tudo.filter(x=>l.shapes[x[1]].esp).map(x=>x[0]);
      if(arr.length){ l.dep[dk][s]=arr.map(x=>x[0]); l.depV[dk][s]=arr.map(x=>x[1]); } else delete l.dep[dk][s]; });
    if(!Object.keys(l.dep[dk]).length){ delete l.dep[dk]; delete l.depV[dk]; } }); });
function proximas(l,dk,s,n){ const a=(l.dep[dk]||{})[s]||[]; const t=agora(); return a.filter(x=>x>=t).slice(0,n); }
function sentidos(l,dk){ const d=l.dep[dk]||{}; return ['T','B'].filter(k=>d[k]&&d[k].length); }
function mediana(a){ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; }
function intervalo(a){ const pico=a.filter(t=>(t>=360&&t<540)||(t>=960&&t<1140)); const h=pico.slice(1).map((t,i)=>t-pico[i]); const all=a.slice(1).map((t,i)=>t-a[i]); return mediana(h.length>=2?h:all); }

// ── mapa ──
let map=null, layers={}, stopLayer=null, locMarker=null;
const mapState = {
  get map() { return map; }, set map(value) { map = value; },
  get layers() { return layers; },
  get stopLayer() { return stopLayer; }, set stopLayer(value) { stopLayer = value; },
  get locMarker() { return locMarker; }, set locMarker(value) { locMarker = value; },
  get sel() { return sel; },
  get dia() { return dia; },
  get sent() { return sent; },
  get viagem() { return viagem; },
  get tripLayer() { return tripLayer; },
  get arrowLayer() { return arrowLayer; }, set arrowLayer(value) { arrowLayer = value; },
  get dest() { return dest; },
  get planoSel() { return planoSel; },
  get planLayer() { return planLayer; },
  get trechoMarker() { return trechoMarker; },
  get origMarker() { return origMarker; },
  get lang() { return lang; }
};
const mapUi = window.createMapUI({
  D, $, css, T, BYID, bg, fam, passagens, hoje, hm, semNumero, escapeHtml: value => esc(value),
  rotSent, getViagensShape: (...args) => viagensShape(...args), viagensTrecho, distLinha, passam,
  fatia, corPerna, isMob, textos, rtFrente, rtDesenha, cliqueMapa, destino, verViagemOnibus,
  limpaDestino, setTrecho, selecionar, anuncia, state: mapState
});
const { PontoBus, pontoBus, initMap, escuro, setTiles, MT_KEY, getBase, nextBase, chip, rotSent, popupStop, pontosDaLinha, popupPoi, dirInfo, ocultaLinhas, estilo, setas, ajusta, escurecer } = mapUi;
function telaCheia(){
  if(!FE) return; const on=FE.dataset.fs!=='1'; if(on&&FE.dataset.css==null) FE.dataset.css=FE.style.cssText;
  FE.dataset.fs=on?'1':'';
  FE.style.cssText=on?'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;border:0;margin:0;z-index:2147483000;background:#fff':FE.dataset.css;
  try{ parent.document.documentElement.style.overflow=on?'hidden':''; }catch(e){}
  textos(); setTimeout(()=>{ if(map) map.invalidateSize(); },80);
}
// ── acessibilidade ──
let tecl=false; // a última interação foi pelo teclado? (decide para onde vai o foco)
document.addEventListener('keydown',e=>{ if(['Tab','Enter',' ','Escape'].indexOf(e.key)>=0) tecl=true; },true);
document.addEventListener('pointerdown',()=>{ tecl=false; },true);
let liveT=null; function anuncia(txt){ clearTimeout(liveT); liveT=setTimeout(()=>{ $('#live').textContent=txt; },150); }
// Esc desfaz um passo: balão → viagem → trecho → linha → destino → legenda
document.addEventListener('keydown',e=>{ if(e.key!=='Escape') return;
  if(!$('#legend').hidden){ legenda(false); return; }
  if(pickOrig){ escolherPartida(false); return; }
  if(map&&map._popup&&map._popup.isOpen()){ map.closePopup(); return; }
  if(viagem!=null){ mostrarViagem(null); return; }
  if(sel&&trecho&&!(dest&&dest.trecho)){ setTrecho(null); mostrarViagem(null); return; }
  if(sel){ selecionar(null); return; }
  if(dest&&planoSel!=null){ planoSel=null; verDestino(); estilo(); return; }
  if(dest){ limpaDestino(); selecionar(null); } });
function legenda(abre){ const lg=$('#legend'); lg.hidden=!abre; $('#btnLeg').setAttribute('aria-expanded',abre?'true':'false'); if(abre&&tecl) $('#legX').focus(); else if(!abre&&tecl) $('#btnLeg').focus(); }
function htmlLegenda(){
  const fams=[['f0','10–70'],['f1','101–120'],['f2','200–250'],['f3','310–380']];
  return '<h3 id="t-leg">'+T('leg')+'<button class="vmap" id="legX" aria-label="'+T('legX')+'">×</button></h3><ul>'+
    '<li><i class="lg lg-l"></i><span>'+T('lg1')+'</span></li><li><i class="lg lg-d"></i><span>'+T('lg2')+'</span></li>'+
    '<li><span class="lg"><span class="arw" style="display:block;--c:'+css('--f1')+'"><i></i></span></span><span>'+T('lg3')+'</span></li>'+
    '<li><span class="lg lg-b" aria-hidden="true"><i></i></span><span>'+T('lg4')+'</span></li><li><span class="lg pin" style="width:22px;height:22px;font-size:11px">T</span><span>'+T('lg5')+'</span></li>'+
    '<li><i class="lg lg-o"></i><span>'+T('lg6')+'</span></li><li><span class="lg" style="height:26px;display:grid;place-items:center"><span class="dpin" style="width:16px;height:16px;border-width:2px"></span></span><span>'+T('lg7')+'</span></li>'+
    '<li><span class="lg-f"><span style="grid-column:1/-1;font-weight:400;padding:0">'+T('lg8')+'</span>'+fams.map(f=>{ const ft=fundoTinta(css('--'+f[0])); return '<span style="background:'+ft[0]+';color:'+ft[1]+'">'+f[1]+'</span>'; }).join('')+'</span></li></ul>';
}
// ── painel ──
function textos(){
  $('#t-title').innerHTML='<span class="tl">'+T('title')+'</span><span class="ts">'+T('titleS')+'</span>'; $('#t-sub').textContent=T('sub'); $('#q').placeholder=T('search'); $('#t-q').textContent=T('qlabel'); { const qp=$('#qPin'); if(qp){ qp.title=T('pickMapB'); qp.setAttribute('aria-label',T('pickMapB')); } }
  $('#btnLeg').textContent=T('leg'); $('#legend').innerHTML=htmlLegenda(); $('#legX').onclick=()=>legenda(false);
  $('#map').setAttribute('aria-label',T('mapL')); $('#sheetbar').setAttribute('aria-label',T('sheet'));
  $('#btnAll').textContent=T('all'); $('#btnLoc').textContent=T('loc'); $('#btnBase').textContent=T('base')+': '+T('b_'+getBase()); $('#btnFull').textContent=$('.app').classList.contains('full')?T('unfull'):T('full');
  document.querySelectorAll('.lang button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.l===lang));
  document.documentElement.lang = lang==='pt'?'pt-BR':lang;
  if(sel) $('#btnBackMap').textContent=T('backAll')+' · '+sel;
  $('#btnFs').textContent=(FE&&FE.dataset.fs==='1')?T('fsx'):T('fs');
}
function lista(){
  const nz=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  const qraw=($('#q').value||'').trim(); const q=nz(qraw);
  const ok=l=>!q||nz(l.id+' '+l.nome).includes(q);
  const dk=hoje(); let h='';
  const TABS=[['all','tall'],['f0','t0'],['f1','t1'],['f2','t2'],['f3','t3']];
  if(!q) h+='<div class="home"><button class="locbtn" id="btnNear">'+T('nearBtn')+'</button></div>';
  if(!q) h+='<div class="tabs" role="group" aria-label="'+T('filt')+'">'+TABS.map(([k,t])=>'<button data-tab="'+k+'" aria-pressed="'+(k===aba)+'">'+T(t)+'</button>').join('')+'</div>';
  const ls=D.linhas.filter(l=>ok(l)&&(q||aba==='all'||fam(l)===aba));
  const pois=D.poi.filter(p=>!q||nz(p.pt+' '+p.es+' '+p.en).includes(q));
  const hPoi=pois.length?'<div class="group">'+T('places')+'</div><div class="poil">'+pois.map(p=>'<button class="poib" data-poi="'+p.k+'"><span class="pin">'+p.ic+'</span><span>'+p[lang]+'</span></button>').join('')+'</div>':'';
  if(q) h+=hPoi; // com busca digitada, os destinos vêm antes das linhas
  h+='<div class="rows" role="list">'+ls.map(l=>{ const s=sentidos(l,dk)[0]; const nx=s?proximas(l,dk,s,1)[0]:null;
    return '<div class="lrow" role="listitem"><button class="lmain" data-id="'+l.id+'"><span class="badge" style="'+bg(l)+'">'+l.id+'</span><span class="nm">'+l.nome+(nx!=null?'<small>'+T('nextdep')+' '+hm(nx)+'</small>':'')+'</span><span class="chev" aria-hidden="true">›</span></button><span class="lacts"><button class="vmap" data-map="'+l.id+'" aria-label="'+T('vmapA').replace('{id}',l.id)+'">'+T('vmap')+'</button>'+(s?'<button class="vmap" data-exp="'+l.id+'" aria-label="'+T('expRowA').replace('{id}',l.id)+'">'+T('expRow')+'</button>':'')+'</span></div>'; }).join('')+'</div>';
  // endereços e locais (busca automática depois de uma pausa na digitação): ficam logo abaixo das linhas
  if(q.length>=3){
    const botao='<button class="geo" id="btnGeo">'+T('geo').replace('{q}',esc(qraw))+'<small>'+T('geoHint')+'</small></button>';
    if(geoQ===qraw&&geoSt==='ok'){ h+='<div class="group">'+T('placesR')+'</div><div class="poil">'+(geoRes.length?geoRes.map((r,i)=>'<button class="poib" data-geo="'+i+'"><span class="pin">◎</span><span>'+esc(r.nome)+(r.sub?'<small style="display:block;color:var(--muted)">'+esc(r.sub)+'</small>':'')+'</span></button>').join(''):'<p class="note" style="margin:0 4px">'+T('geoNone')+'</p>')+'</div>'+(geoRes.some(r=>r.ibge)?'<p class="note" style="padding:0 18px 8px;margin:0">'+T('endFonte')+'</p>':'')+(geoRes.length||geoAmplo?'':botao); }
    else if(geoQ===qraw&&geoSt==='load'){ h+='<p class="note" style="padding:0 18px 12px">'+T('geoLoad')+'</p>'; }
    else { h+=(geoQ===qraw&&geoSt==='err'?'<p class="note" style="padding:0 18px 8px">'+T('geoErr')+'</p>':'')+botao; }
  }
  const pst=q.length>=3?D.stops.map((s,i)=>[s,i]).filter(x=>x[0].L.length&&nz((x[0][2]||'')+' '+(x[0][4]||'')).includes(q)).slice(0,8):[];
  if(pst.length){ h+='<div class="group">'+T('stopsG')+'</div><div class="poil">'+pst.map(x=>'<button class="poib" data-st="'+x[1]+'"><span class="pin">P</span><span>'+esc(x[0][2]||x[0][4])+(x[0][2]&&x[0][4]?'<small style="display:block;color:var(--muted)">'+esc(x[0][4])+'</small>':'')+'</span></button>').join('')+'</div>'; }
  if(!q) h+=hPoi;
  h+='<p class="note" style="padding:0 18px 18px">'+T('disc')+(D.versao?' '+T('upd')+' '+D.versao.slice(8,10)+'/'+D.versao.slice(5,7)+'/'+D.versao.slice(0,4)+(D.versao.length>=16?' '+T('atH')+' '+D.versao.slice(11,16):'')+' ('+T(D._fonte==='drive'?'srcD':'srcE')+'). '+T('fonte'):'')+'</p>';
  $('#pbody').innerHTML=h; $('#linebar').hidden=true; $('#tripbar').hidden=true; $('#trechobar').hidden=true;
  $('#pbody').querySelectorAll('.lmain').forEach(b=>b.addEventListener('click',()=>selecionar(b.dataset.id)));
  const bn=$('#btnNear'); if(bn) bn.onclick=()=>$('#btnLoc').click();
  if(q) anuncia(T('aRes').replace('{n}',ls.length));
  $('#pbody').querySelectorAll('.vmap[data-exp]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); exportaHorario(b,b.dataset.exp,hoje()); }));
  $('#pbody').querySelectorAll('.vmap[data-map]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); selecionar(b.dataset.map); if(isMob()){ $('#panel').classList.add('min'); sheetTxt(); ajusta(L.latLngBounds(BYID[b.dataset.map].shapes.filter(s=>s.main).map(s=>s.p))); } }));
  $('#pbody').querySelectorAll('[data-st]').forEach(b=>b.addEventListener('click',()=>{ const s=D.stops[+b.dataset.st]; if(!map) return; if(isMob()){ $('#panel').classList.add('min'); map.invalidateSize({animate:false}); } map.setView([s[0],s[1]],17,{animate:false}); if(!map.hasLayer(stopLayer)) stopLayer.addTo(map); s._m.openPopup(); }));
  const bgeo=$('#btnGeo'); if(bgeo) bgeo.onclick=()=>geocode(qraw,geoQ===qraw&&geoSt==='ok');
  $('#pbody').querySelectorAll('[data-geo]').forEach(b=>b.addEventListener('click',()=>destino(geoRes[+b.dataset.geo])));
  $('#pbody').querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ aba=b.dataset.tab; lista(); }));
  $('#pbody').querySelectorAll('.poib[data-poi]').forEach(b=>b.addEventListener('click',()=>{ const p=D.poi.find(x=>x.k===b.dataset.poi); destino({nome:p[lang],lat:p.lat,lon:p.lon}); }));
}
const esc=s=>String(s).replace(/[<>"']/g,c=>({'<':'‹','>':'›','"':'”',"'":'’'})[c]);
// distância (m) de um ponto ao trajeto mais próximo da linha
// ponto do trajeto mais próximo de (lat,lon): {d: metros, lat, lon}
function pertoDe(P,lat,lon){
  const kx=111320*Math.cos(lat*Math.PI/180), ky=110540; let best=1e18, bx=0, by=0;
  for(let i=1;i<P.length;i++){ const ax=(P[i-1][1]-lon)*kx, ay=(P[i-1][0]-lat)*ky, dx=(P[i][1]-lon)*kx-ax, dy=(P[i][0]-lat)*ky-ay; const L2=dx*dx+dy*dy;
    let t=L2?-(ax*dx+ay*dy)/L2:0; t=t<0?0:t>1?1:t; const x=ax+t*dx, y=ay+t*dy, d=x*x+y*y; if(d<best){ best=d; bx=x; by=y; } }
  return {d:Math.sqrt(best),lat:lat+by/ky,lon:lon+bx/kx};
}
// posição (0 a 1) do ponto do trajeto mais próximo de (lat,lon) e a distância até ele
function aoLongo(s,lat,lon){
  const P=s.p; if(!s._c){ const k0=111320*Math.cos(P[0][0]*Math.PI/180); let acc=0; s._c=[0]; for(let i=1;i<P.length;i++){ acc+=Math.hypot((P[i][1]-P[i-1][1])*k0,(P[i][0]-P[i-1][0])*110540); s._c.push(acc); } }
  const kx=111320*Math.cos(lat*Math.PI/180), ky=110540; let best=1e18, f=0;
  for(let i=1;i<P.length;i++){ const ax=(P[i-1][1]-lon)*kx, ay=(P[i-1][0]-lat)*ky, dx=(P[i][1]-lon)*kx-ax, dy=(P[i][0]-lat)*ky-ay; const L2=dx*dx+dy*dy;
    let t=L2?-(ax*dx+ay*dy)/L2:0; t=t<0?0:t>1?1:t; const x=ax+t*dx, y=ay+t*dy, d=x*x+y*y; if(d<best){ best=d; f=s._c[i-1]+t*(s._c[i]-s._c[i-1]); } }
  return {d:Math.sqrt(best),f:f/(s._c[P.length-1]||1)};
}
// minutos entre a saída do ponto inicial e a passagem estimada em (lat,lon): duração da viagem × fração do percurso
// duração da viagem em minutos: a do GTFS; se os dados não trouxerem, estima a 20 km/h
function faixa(m){ m=((m%1440)+1440)%1440; return m<300?3:m<540?0:m<960?1:m<1170?2:3; } // 05–09h, 09–16h, 16–19h30, noite
// ── estimativa de passagem: típica, cedo e tarde ──
// O passageiro vê só o horário CEDO (o ônibus quase nunca passa antes dele), apresentado como "estimado", sem explicação na tela.
// O horário TARDE não aparece: serve para a viagem não sumir de "próxima passagem" enquanto o ônibus ainda pode estar chegando.
// Nas amostras de GPS conferidas, o ônibus passou antes do horário "cedo" em cerca de 7% das vezes e depois do "tarde" em cerca de 20%.
// Sentido do cadastro do trajeto (último número do código SP_linha_trajeto_sentido): o Google Transit erra a duração de forma diferente em cada sentido.
const sentSid=s=>{ const m=/_(\d)$/.exec(s.sid||''); return m?m[1]:''; };
// razão entre a duração medida por GPS e a do Google Transit nos trajetos medidos: por linha+sentido, por sentido e geral
const RZ={}; D.linhas.forEach(l=>l.shapes.forEach(s=>{ if(!s.esp&&s.g&&s.g.m&&s.d>0){ const r=s.g.m/s.d, k=sentSid(s); ['L|'+l.id+'|'+k,'G|'+k,'G|*'].forEach(q=>(RZ[q]=RZ[q]||[]).push(r)); } }));
Object.keys(RZ).forEach(k=>RZ[k].sort((a,b)=>a-b));
const pctl=(a,q)=>a[Math.round((a.length-1)*q)];
// trajeto SEM medição: fatores [cedo, típico, tarde] sobre a duração do Google Transit, tirados dos trajetos medidos da mesma linha e sentido;
// se a linha não tem medição, dos de mesmo sentido das outras linhas; sem medição nenhuma nos dados, uma margem fixa
function fatSem(s,l){ if(s._fs) return s._fs; const k=sentSid(s), a=RZ['L|'+l.id+'|'+k], g=RZ['G|'+k], t=RZ['G|*'];
  const b=(a&&a.length>=2)?a:(g&&g.length>=4)?g:(t&&t.length>=4)?t:null;
  return s._fs=b?[Math.min(pctl(b,.2)*0.95,pctl(b,.5)),pctl(b,.5),Math.max(pctl(b,.8)*1.06,pctl(b,.5))]:[0.75,1,1.2]; }
// duração típica da viagem (min) para o dia e a hora de saída: GPS da faixa de horário > GPS geral > Google Transit ajustado > 20 km/h
function durS(s,l,dk,m){ const g=s.g; if(g){ const v=g.d&&g.d[dk]&&g.d[dk][faixa(m)]; if(v) return v; if(g.m) return g.m; }
  if(s.d>0) return s.d*(l?fatSem(s,l)[1]:1); if(!s._c) aoLongo(s,s.p[0][0],s.p[0][1]); return s._c[s.p.length-1]/1000/20*60; }
// quanto a viagem rápida e a lenta levam em relação à típica: [cedo, tarde]
function fatCT(s,l){ const g=s.g; if(g) return [(1+(g.e||0.86))/2,(1+(g.u||1.2))/2]; if(s.d>0&&l){ const f=fatSem(s,l); return [f[0]/f[1],f[2]/f[1]]; } return [0.8,1.2]; }
// atraso de saída medido por GPS (min), quando existe: 'a' = típico (quartil inferior), 'c' = tarde
function saidaG(s,dk,m,o){ const g=s.g; if(!g) return 0; o=o||'a'; const v=g[o]&&g[o][dk]&&g[o][dk][faixa(m)]; return v!=null?v:(g[o+'m']!=null?g[o+'m']:(g.am||0)); }
// fração do tempo de viagem gasta até a fração f do percurso (o ônibus não anda igual no trajeto todo)
function fracTempo(s,f){ const q=s.g&&s.g.p; if(!q) return f; const x=f*10, i=Math.min(9,Math.floor(x)); return (q[i]+(q[i+1]-q[i])*(x-i))/1000; }
// minutos entre a saída programada (minuto m) e a passagem na fração f do trajeto: típica, cedo e tarde
function minAte(l,s,dk,m,f){ return Math.round(saidaG(s,dk,m)+durS(s,l,dk,m)*fracTempo(s,f)); }
function minCedo(l,s,dk,m,f){ return Math.floor(saidaG(s,dk,m)+durS(s,l,dk,m)*fracTempo(s,f)*fatCT(s,l)[0]); }
function minTarde(l,s,dk,m,f){ return Math.ceil(Math.max(saidaG(s,dk,m),saidaG(s,dk,m,'c'))+durS(s,l,dk,m)*fracTempo(s,f)*fatCT(s,l)[1]); }
// ── tempo real: posição dos ônibus ──
// O ITS não aceita consultas do Google, então uma "ponte" (aba de navegador na FOZTRANS) envia as posições ao Apps Script a cada 30 s
// e a página lê em ...exec?onibus=1. Cada veículo: [prefixo, lat, lon, linha, sentido do ITS, minuto da viagem planejada, idade da posição (s), velocidade].
// Sentido do ITS (campo GTFS_Sentido) = direction_id do GTFS: 0 = IDA (trajetos com final _1), 1 = VOLTA (final _0). Conferido com dados reais (65 de 65 veículos).
// No mapa, T/B é geométrico (viagem que sai de perto do TTU = T). Na regra geral 0 → T e 1 → B; em poucas viagens (225A, 55, 50, 245, 110, 320 e escolares)
// a letra é a outra, e rtCasa acha a viagem pelo plano B (procura o horário no outro sentido). Os relatórios do ITSReports usam a numeração contrária (Sentido=0 é Volta).
// Sem ponte (ou com a página aberta fora do site) nada disto aparece e valem os horários estimados de sempre.
const RT_FORA=150;  // metros: ônibus mais longe que isto do trajeto da sua viagem não gera previsão (desvio, deslocamento vazio)
let RT={t:0,v:[],k:{},q:{},em:0}, rtLayer=null;
const rtVale=()=>RT.t>0&&(Date.now()-RT.em)<100000;
const agoraSeg=()=>{ const d=new Date(); const m=d.getHours()*60+d.getMinutes()+d.getSeconds()/60; return m<180?m+1440:m; };
// idade da posição agora (s). Se o relógio do aparelho estiver errado, usa só o que veio do servidor.
const rtIdade=o=>{ const a=Date.now()/1000-o.ts; return (a>=o.i0-5&&a<=o.i0+260)?Math.max(0,a):o.i0+(Date.now()-RT.em)/1000+15; };
// fração do percurso em que o ônibus estaria depois da fração tf do tempo de viagem (inverso de fracTempo)
function fracPercurso(s,tf){ if(tf<=0) return 0; if(tf>=1) return 1; let a=0,b=1; for(let i=0;i<14;i++){ const m=(a+b)/2; if(fracTempo(s,m)<tf) a=m; else b=m; } return (a+b)/2; }
// onde o ônibus está no trajeto (0 a 1). Se o trajeto passa mais de uma vez perto dele (laço, ida e volta na mesma rua), fica a passada mais coerente com o horário.
function rtProj(s,lat,lon,fEsp){
  const P=s.p; if(!s._c) aoLongo(s,lat,lon); const kx=111320*Math.cos(lat*Math.PI/180), ky=110540, tot=s._c[P.length-1]||1; let best=1e18; const c=[];
  for(let i=1;i<P.length;i++){ const ax=(P[i-1][1]-lon)*kx, ay=(P[i-1][0]-lat)*ky, dx=(P[i][1]-lon)*kx-ax, dy=(P[i][0]-lat)*ky-ay; const L2=dx*dx+dy*dy;
    let t=L2?-(ax*dx+ay*dy)/L2:0; t=t<0?0:t>1?1:t; const x=ax+t*dx, y=ay+t*dy, d=Math.sqrt(x*x+y*y); if(d<best) best=d; if(d<400) c.push([d,(s._c[i-1]+t*(s._c[i]-s._c[i-1]))/tot]); }
  if(!c.length) return {d:best,f:0};
  const lim=Math.max(45,best+25); let q=null; c.forEach(x=>{ if(x[0]<=lim&&(!q||Math.abs(x[1]-fEsp)<Math.abs(q[1]-fEsp))) q=x; });
  return {d:q[0],f:q[1]};
}
// casa o veículo com a viagem do quadro de hoje (linha + sentido + horário planejado) e acha a posição dele no trajeto dessa viagem
function rtCasa(x,t){ const l=BYID[x[3]]; if(!l) return null; const dk=hoje(), d=l.dep[dk]||{}, m=x[5];
  let s=x[4]==='0'?'T':x[4]==='1'?'B':null, i=-1;
  if(m!=null){ const acha=k=>{ const a=d[k]||[]; let j=a.indexOf(m); if(j<0&&m<180) j=a.indexOf(m+1440); return j; };
    const esp=k=>{ const a=(l.espM[dk]||{})[k]||[]; return a.indexOf(m)>=0||(m<180&&a.indexOf(m+1440)>=0); }; // está numa viagem ESP (sem passageiros)?
    if(s) i=acha(s); if(i<0&&s&&esp(s)) return null;
    if(i<0){ const o=s==='T'?'B':'T', j=acha(o); if(j>=0){ s=o; i=j; } else if(esp(o)) return null; } }
  const o={px:x[3]+'|'+x[4]+'|'+(m==null?'':m),lat:x[1],lon:x[2],l:l,s:s,i:i,mi:m,vel:x[7],i0:x[6]||0,ts:t-(x[6]||0),m:null,si:null,f:0,d:1e9,ok:false};
  if(i>=0){ const si=l.depV[dk][s][i], m2=l.dep[dk][s][i], sh=l.shapes[si];
    const pr=rtProj(sh,o.lat,o.lon,fracPercurso(sh,(agoraSeg()-m2-saidaG(sh,dk,m2))/Math.max(1,durS(sh,l,dk,m2))));
    o.si=si; o.m=m2; o.f=pr.f; o.d=pr.d; o.ok=pr.d<=RT_FORA; }
  return o; }
// passagem pela fração fs do trajeto, calculada de onde o ônibus está: [cedo, tarde] em minutos do dia; [-1,-1] se já passou;
// null se não dá para usar (sem ônibus casado, fora do trajeto ou ainda antes do horário de saída — aí vale o programado)
function rtEta(o,fs){ if(!o||!o.ok||!rtVale()) return null;
  if(o.enc){ const te=rtEta(o.enc,0.999); if(!te) return null; const ag=agoraSeg(), fim=te[1]<0?[ag,ag,ag]:te; // viagem encadeada: chega ao fim da atual, espera 1 min e faz esta
    const sh=o.l.shapes[o.si], dur=durS(sh,o.l,hoje(),o.m)*fracTempo(sh,fs), ct=fatCT(sh,o.l), sai=x=>Math.max(x+1,o.m);
    return [Math.floor(sai(fim[0])+dur*ct[0]),Math.ceil(sai(fim[1])+dur*ct[1]),Math.round(sai(fim[2])+dur)]; }
  const now=agoraSeg(); if(now<o.m) return null;
  if(fs<=o.f+0.004) return [-1,-1];
  const sh=o.l.shapes[o.si], falta=durS(sh,o.l,hoje(),o.m)*(fracTempo(sh,fs)-fracTempo(sh,o.f)), ct=fatCT(sh,o.l), base=now-rtIdade(o)/60;
  return [Math.floor(base+falta*ct[0]),Math.ceil(base+falta*ct[1]),Math.round(base+falta)]; }
let rtU=0; // urgência das consultas de passagem em andamento (a lista de linhas perto do destino vale menos que as opções de viagem)
const rtDe=(l,dk,s,i)=>{ if(dk!==hoje()) return null; rtQuero(l.id,rtU); return RT.k[l.id+'|'+s+'|'+i]; };
// o ônibus que está fazendo a viagem do trajeto si que saiu (ou sai) no minuto m
const rtV=(l,si,m,dk)=>(!futuro()&&(dk===undefined||dk===hoje()))?RT.q[l.id+'|'+si+'|'+m]:null;
// ENCADEAMENTO: a viagem que o mesmo carro faz em seguida — começa até 250 m do fim da viagem atual e até 10 min do fim programado dela
// (ex.: a ida da 320 das 17:55 termina às 19:45 em Vila C, onde a volta das 19:45 começa). null se não houver.
function proxEnc(o){ const l=o.l, dk=hoje(), sh=l.shapes[o.si], P=sh.p, fim=P[P.length-1], dur=sh.d>0?sh.d:durS(sh,l,dk,o.m), te=o.m+dur, d=l.dep[dk]||{}; let best=null;
  Object.keys(d).forEach(k=>d[k].forEach((m,i)=>{ if(m<=o.m) return; const dm=Math.abs(m-te); if(dm>10) return; const si=l.depV[dk][k][i], q=l.shapes[si].p[0];
    if(metros(q[0],q[1],fim[0],fim[1])>250) return; if(!best||dm<best.dm) best={s:k,i,si,m,dm}; }));
  return best; }
// desenho do ônibus no mapa: disco na cor da linha; de perto ganha o desenho do ônibus
const BusVivo=window.L?L.CircleMarker.extend({
  _updatePath(){ const r=this._renderer, c=r&&r._ctx; if(!c){ L.CircleMarker.prototype._updatePath.call(this); return; } if(this._empty()) return;
    const p=this._point, R=this.options.radius, cor=this.options.cor;
    c.save(); c.translate(p.x,p.y); c.globalAlpha=this.options.fraco?0.5:1;
    if(R>=10){ c.beginPath(); c.arc(0,0,R+5,0,Math.PI*2); c.fillStyle='rgba(255,255,255,.92)'; c.fill(); c.lineWidth=1.2; c.strokeStyle='rgba(0,0,0,.5)'; c.stroke(); }
    c.beginPath(); c.arc(0,0,R,0,Math.PI*2); c.fillStyle=cor; c.fill(); c.lineWidth=2; c.strokeStyle='#ffffff'; c.stroke();
    if(R<10){ c.beginPath(); c.arc(0,0,R+1,0,Math.PI*2); c.lineWidth=1; c.strokeStyle='rgba(0,0,0,.45)'; c.stroke(); }
    if(R>=10){ const s=R*0.62, w=s*1.3, h=s*1.5, y0=-h/2-s*0.08; c.fillStyle='#ffffff';
      c.fillRect(-w/2+s*0.12,y0+h-s*0.05,s*0.3,s*0.24); c.fillRect(w/2-s*0.42,y0+h-s*0.05,s*0.3,s*0.24);
      c.beginPath(); if(c.roundRect) c.roundRect(-w/2,y0,w,h,s*0.25); else c.rect(-w/2,y0,w,h); c.fill();
      c.fillStyle=cor; c.fillRect(-w/2+s*0.16,y0+s*0.18,w-s*0.32,h*0.4);
      c.beginPath(); c.arc(-w*0.27,y0+h*0.78,s*0.11,0,Math.PI*2); c.arc(w*0.27,y0+h*0.78,s*0.11,0,Math.PI*2); c.fill(); }
    c.restore(); }
}):null;
const maiusc=t=>t?t.charAt(0).toUpperCase()+t.slice(1):t;
function popupBus(o){ const l=o.l, id=Math.round(rtIdade(o));
  const temV=o.i>=0&&o.si!=null&&!!o.s, jaV=temV&&sel===l.id&&dia===hoje()&&sent===o.s&&viagem===o.i;
  let via=temV?trajetoVar(l,o.si):''; if(via===l.nome) via='';
  // com uma opção de viagem aberta: este carro ainda passa no ponto de embarque? a que horas (pela posição dele)?
  let aqui=''; { const op=(!sel&&dest&&dest.plano&&planoSel!=null)?dest.plano.ops[planoSel]:null, x=op?rtVindo(op).find(y=>y.o===o):null;
    const qz=(!x&&!sel&&dest&&dest.plano&&dest.plano.quase)?dest.plano.quase.find(y=>y.o.px===o.px&&y.o.l===o.l):null;
    if(qz) aqui=T(op?'busQuase':'busQuase0').replace('{p}',esc(nomePonto(qz.k))).replace('{h}','<b>'+hm(qz.eta)+'</b>').replace('{c}',hm(qz.cheg));
    if(!x&&op){ op.legs.some(g=>{ const b=rtV(g.l,g.si,g.m); if(!b||b.enc!==o) return false; const e=rtEta(b,g.f0); if(e&&e[1]>=0) aqui=T('busEnc').replace('{v}',hm(b.m)).replace('{h}','<b>'+hm(Math.max(e[0],agora()))+'</b>'); return true; }); }
    if(x) aqui=x.meu?T('busMeu').replace('{h}','<b>'+hm(x.eta)+'</b>'):x.da?T('busHere').replace('{h}','<b>'+hm(x.eta)+'</b>')+(x.outra?'':' '+T(x.eta>op.legs[0].t0?'busDepois':'busAntes')):T('busPerde').replace('{h}','<b>'+hm(x.eta)+'</b>').replace('{c}',hm(x.cheg)); }
  return '<b>'+T('busL').replace('{l}',l.id)+' · '+esc(l.nome)+'</b><div class="note" style="margin-top:4px">'+maiusc([o.s?rotSent(l,o.s):'',o.m!=null?T('busTrip').replace('{h}',hm(o.m)):''].filter(Boolean).join(' · '))+'</div>'+
    '<div class="note">'+(id<90?T('busAgeS').replace('{n}',id):T('busAgeM').replace('{n}',Math.round(id/60)))+'</div>'+
    (via?'<div class="note">'+T('busVia').replace('{t}',esc(via))+'</div>':'')+
    (o.i<0?'<div class="note">'+(o.mi==null?T('busNoTrip'):T('busOffTab').replace('{h}',hm(o.mi)))+'</div>':'')+
    (aqui?'<div class="note bq"><span class="vivo">'+aqui+'</span></div>':'')+
    (temV&&!jaV?'<div style="margin-top:8px"><button class="walk" data-trip="'+l.id+'|'+o.s+'|'+o.i+'">'+T('busSee')+'</button></div>':
      (sel===l.id?'':'<div style="margin-top:8px"><button class="walk" data-go="'+l.id+'">'+T('seeLine')+'</button></div>')); }
// abre a linha do ônibus já com a viagem dele desenhada (o mesmo que tocar no horário dessa viagem no quadro)
function verViagemOnibus(lid,s,i){ const l=BYID[lid]; if(!l||((l.dep[hoje()]||{})[s]||[])[i]===undefined) return;
  if(trecho) setTrecho(null);
  if(sel!==lid) selecionar(lid,false,false,s);
  dia=hoje(); sent=s; mostrarViagem(i); if(map) estilo(); }
// ônibus da linha do 1º embarque que ainda vão passar pelo ponto de embarque e seguem até onde a pessoa desce (qualquer viagem dessa linha):
// [{o: veículo, f: fração do ponto de embarque no trajeto dele}], os mais próximos primeiro. Só carros com viagem casada, no trajeto e já em viagem.
function rtVindo(op){ if(!op||!rtVale()) return []; const q=op.legs[0], ttu=noTTU(q.k1), agora_=agoraSeg(), out=[];
  const cheg=agora()+(op.rO!=null?Math.max(1,Math.ceil(op.rO/ANDA)):op.wo);                         // quando a pessoa chega ao ponto, a pé
  RT.v.forEach(o=>{ if(o.l!==q.l||!o.ok||o.i<0||o.si==null||agora_<o.m) return; const P=pontosDoTrajeto(o.l,o.si);
    const e=P.filter(x=>x[0]===q.k0&&x[1]>o.f+0.004).sort((a,b)=>a[1]-b[1])[0]; if(!e) return;
    let outra=false;
    if(!P.some(x=>x[1]>e[1]+0.004&&(x[0]===q.k1||(ttu&&noTTU(x[0]))))){                              // esse carro não vai até o ponto onde a pessoa desce…
      const g=op.legs[1]; if(!g||!trocas({l:o.l,si:o.si},{l:g.l,si:g.si}).some(c=>c[1]>e[1]+0.004&&c[3]<g.f1-0.004)) return; outra=true; } // …mas alcança o segundo ônibus em outro ponto (ex.: variante direta, que troca no Terminal)
    const t=rtEta(o,e[1]); if(!t||t[1]<0) return;
    const sh=o.l.shapes[o.si]; if(!sh._c) aoLongo(sh,sh.p[0][0],sh.p[0][1]);
    out.push({o,f:e[1],d:(e[1]-o.f)*sh._c[sh.p.length-1],eta:Math.max(t[0],agora()),cheg,da:t[0]>=cheg,meu:!outra&&o.si===q.si&&o.m===q.m,outra}); });   // da = dá tempo de pegar; meu = é o da viagem da opção
  return out.sort((a,b)=>a.d-b.d).slice(0,3); }
// ônibus no mapa: só os da linha aberta ou da opção de viagem escolhida; na visão geral, nenhum
function rtDesenha(){ if(!map||!BusVivo) return;
  // balão de um ônibus aberto: redesenha do mesmo jeito e reabre o balão no mesmo carro, já na posição nova
  // (o Leaflet não limpa map._popup quando o balão fecha; por isso a pergunta é se ele está aberto, não se existe)
  const pop=map._popup, aberto=(rtLayer&&pop&&pop.isOpen&&pop.isOpen()&&pop._source instanceof BusVivo&&rtLayer.hasLayer(pop._source))?pop._source.options.px:null;
  const op=(!sel&&!quando&&dest&&dest.plano&&planoSel!=null)?dest.plano.ops[planoSel]:null, ids=sel?new Set([sel]):op?new Set(op.legs.map(g=>g.l.id)):null;
  const qv=(!sel&&dest&&dest.plano&&quaseVer&&(dest.plano.quase||[]).some(q=>q.o.px===quaseVer.px))?quaseVer:null; // carro do aviso "Passando agora" pedido no painel (enquanto ainda estiver no aviso)
  if(ids) ids.forEach(id=>rtQuero(id,0)); // as linhas que vão para o mapa entram no próximo pedido de posições
  if(qv) rtQuero(qv.l,0);
  if(rtLayer){ map.removeLayer(rtLayer); rtLayer=null; } rtTraj(null); if(!rtVale()) return;
  if(!ids&&!qv) return; // visão geral (nenhuma linha aberta nem opção de viagem escolhida): não mostra a frota inteira no mapa
  const meus=op?op.legs.map(g=>{ const b=rtV(g.l,g.si,g.m); return b&&b.enc?b.enc:b; }).filter(Boolean).concat(rtVindo(op).filter(x=>x.da&&!x.outra&&x.eta<=op.legs[0].t0).map(x=>x.o)):[];
  const g=L.layerGroup(); let volta=null;
  RT.v.forEach(o=>{ const ex=!!qv&&o.px===qv.px&&o.l.id===qv.l; if(!ex&&(!ids||!ids.has(o.l.id))) return;
    const m=new BusVivo([o.lat,o.lon],{radius:12,cor:escurecer(o.l.cor,.4),fraco:ex?false:!!(sel?(o.s&&o.s!==sent):(op&&meus.indexOf(o)<0)),px:o.px,bubblingMouseEvents:false});
    m.bindPopup(()=>popupBus(o),{minWidth:200,maxWidth:280,autoPan:o.px!==aberto}); m.on('popupopen',()=>rtTraj(o)); m.on('popupclose',()=>rtTraj(null)); g.addLayer(m); if(o.px===aberto) volta=m; });
  rtLayer=g.addTo(map); if(volta) volta.openPopup(); }
// ao tocar num ônibus com viagem conhecida: tracejado do que ele ainda vai percorrer (da posição dele ao fim da viagem). Some ao fechar o balão.
let rtTrajL=null;
function rtTraj(o){ if(rtTrajL&&map){ map.removeLayer(rtTrajL); } rtTrajL=null;
  if(!o||!map||!o.ok||o.i<0||o.si==null||o.f>0.996) return; const sh=o.l.shapes[o.si], pts=fatia(sh,o.f,1); if(!pts||pts.length<2) return;
  const op=(!sel&&dest&&dest.plano&&planoSel!=null)?dest.plano.ops[planoSel]:null, ip=op?op.legs.findIndex(q=>q.l===o.l):-1, cv=ip>=0?corPerna(op,ip):escurecer(o.l.cor,.4);
  rtTrajL=L.layerGroup([L.polyline(pts,{color:'#ffffff',weight:7,opacity:.9,interactive:false}),L.polyline(pts,{color:cv,weight:3.5,opacity:1,dashArray:'2 8',lineCap:'round',interactive:false,traj:1})]).addTo(map); rtFrente(); }
function rtFrente(){ if(rtLayer) rtLayer.eachLayer(m=>m.bringToFront()); }
function rtAplica(j){ const t=(j&&j.t)||0, k={}, tinha=RT.v.length, v=t?(j.v||[]).map(x=>rtCasa(x,t)).filter(Boolean):[];
  const qq={};
  v.forEach(o=>{ if(o.i>=0){ const q=o.l.id+'|'+o.s+'|'+o.i, a=k[q]; if(!a||(o.ok&&!a.ok)||(o.ok===a.ok&&o.d<a.d)){ k[q]=o; qq[o.l.id+'|'+o.si+'|'+o.m]=o; } } });
  RT={t:t,v:v,k:k,q:qq,em:Date.now()};
  // carro atrasado que ainda está na viagem anterior: a viagem seguinte dele (sem carro próprio informado) herda a posição — a passagem
  // é estimada pela chegada dele ao fim da viagem atual + o trajeto da seguinte. Só quando ele chega depois do horário de saída dela.
  v.forEach(o=>{ if(!o.ok||o.i<0||o.si==null) return; const nx=proxEnc(o); if(!nx) return; const key=o.l.id+'|'+nx.si+'|'+nx.m; if(qq[key]) return;
    const te=rtEta(o,0.999), fimT=te?(te[1]<0?agoraSeg():te[2]):null; if(fimT==null||fimT<=nx.m+2) return;
    qq[key]={px:o.px+'>'+nx.m,l:o.l,s:nx.s,i:nx.i,si:nx.si,m:nx.m,mi:nx.m,f:0,d:0,ok:true,enc:o,lat:o.lat,lon:o.lon,i0:o.i0,ts:o.ts,vel:o.vel}; });
  if(v.length||tinha){
    if(sel&&trecho&&dia===hoje()){ const st=$('#pbody').scrollTop; detalhe(); $('#pbody').scrollTop=st; }
    else if(!sel&&dest&&!pickOrig&&!digitando()&&(dest.trecho||dest.eu||(dest.plano&&origem()))){
      // opções de viagem na tela: refaz com a posição nova, sem tirar a rolagem nem o foco do teclado de onde estavam
      const st=$('#pbody').scrollTop, fa=document.activeElement, ds=fa&&fa.dataset?fa.dataset:{}, alvo=ds.pm!=null?'[data-pm="'+ds.pm+'"]':ds.pl!=null?'[data-pl="'+ds.pl+'"]':null;
      const mn=$('#panel').classList.contains('min'); verDestino(); if(mn) $('#panel').classList.add('min'); $('#pbody').scrollTop=st; if(alvo){ const nb=$('#pbody').querySelector(alvo); if(nb) nb.focus({preventScroll:true}); } } }
  rtDesenha();
  // balão de ponto de parada aberto: refaz o conteúdo (fecha e reabre no mesmo lugar, para os botões voltarem a funcionar)
  const pop=map&&map._popup, src=pop&&pop.isOpen&&pop.isOpen()?pop._source:null;
  if(src&&(v.length||tinha)&&!(BusVivo&&src instanceof BusVivo)&&src._ponto){ const ap=pop.options.autoPan; pop.options.autoPan=false; src.closePopup(); src.openPopup(); pop.options.autoPan=ap; } }
// ── quais linhas pedir ──
// A página não baixa a frota inteira: pede só as linhas que está mostrando (linha aberta, opções de viagem, ponto ou trecho consultado),
// no máximo RT_MAX por vez. Cada consulta a rtV/rtDe anota a linha; se a lista mudar, busca logo em vez de esperar os 30 s.
const RT_MAX=12; let rtPede=new Map(), rtUlt=null, rtEm=0, rtPonte=null, rtJa=null, rtRapidas=[], rtSeq=0;
// u = urgência: 0 = está na tela ou embarque nos próximos 15 min; 1 = até 40 min; 2 = mais longe (aí quase nunca há ônibus já em viagem)
function rtQuero(id,u){ let e=rtPede.get(id); if(!e) rtPede.set(id,e=[0,0,0]); e[u]=Date.now(); if(!rtJa) rtJa=setTimeout(rtConfere,500); } // guarda quando foi a última consulta em cada urgência
function rtQuer(){ const out=[], poe=id=>{ if(id&&BYID[id]&&out.indexOf(id)<0&&out.length<RT_MAX) out.push(id); };
  if(sel) poe(sel);
  const pl=(!sel&&dest&&dest.plano)?dest.plano:null;
  if(pl&&pl.ops){ if(planoSel!=null&&pl.ops[planoSel]) pl.ops[planoSel].legs.forEach(g=>poe(g.l.id)); pl.ops.forEach(o=>o.legs.forEach(g=>poe(g.l.id))); }
  const lim=Date.now()-90000; [0,1,2].forEach(u=>D.linhas.forEach(l=>{ const e=rtPede.get(l.id); if(e&&e[u]>=lim) poe(l.id); }));
  return out.sort(); }
function rtConfere(){ rtJa=null; if(rtPonte===false||document.hidden||rtUlt===null) return; // sem ponte (ou antes da 1ª busca) vale o relógio normal
  if(rtQuer().join(',')===rtUlt) return;
  const now=Date.now(); rtRapidas=rtRapidas.filter(x=>now-x<30000); if(rtRapidas.length>=4) return; rtRapidas.push(now);
  clearTimeout(rtRelogio); rtRelogio=setTimeout(rtBusca,Math.max(0,3000-(now-rtEm))); }
// consulta a cada 30 s enquanto houver ponte; sem ponte, confere só de 2 em 2 minutos
let rtRelogio=null;
function rtBusca(){ clearTimeout(rtRelogio); const u=window.__DADOS_URL__||''; if(!u) return;
  const depois=()=>{ if(RT.t&&!rtVale()) rtAplica(null); rtRelogio=setTimeout(rtBusca,rtPonte===false?120000:30000); };
  if(document.hidden){ depois(); return; }
  const q=rtQuer(), n=++rtSeq; rtUlt=q.join(','); if(!q.length){ depois(); return; } // nada na tela usa posição: não pede nada
  rtEm=Date.now();
  fetch(u+(u.indexOf('?')<0?'?':'&')+'onibus=1&linha='+encodeURIComponent(rtUlt)).then(r=>r.json()).then(j=>{ if(n!==rtSeq) return; rtPonte=!!(j&&j.t); rtAplica(j); }).catch(()=>{}).then(()=>{ if(n===rtSeq) depois(); }); }
// próxima passagem estimada de cada sentido perto de (lat,lon), hoje: {T: minuto, B: minuto}
function passagens(l,dk,lat,lon,raio){
  const now=agora(), out={}, c={}; const d=l.dep[dk]||{};
  const vivo={};
  Object.keys(d).forEach(s=>{ const a=d[s], v=l.depV[dk][s]; let best=null, bv=false;
    for(let i=0;i<a.length;i++){ const si=v[i]; if(c[si]===undefined){ const r=aoLongo(l.shapes[si],lat,lon); c[si]=r.d<=raio?r.f:null; }
      if(c[si]==null) continue; let ce=a[i]+minCedo(l,l.shapes[si],dk,a[i],c[si]), ta=a[i]+minTarde(l,l.shapes[si],dk,a[i],c[si]), vv=false;
      const e=rtEta(rtDe(l,dk,s,i),c[si]); if(e){ ce=e[0]; ta=e[1]; vv=true; }
      if(ta<now) continue; const t=Math.max(now,ce); if(best==null||t<best){ best=t; bv=vv; } }
    if(best!=null){ out[s]=best; if(bv) vivo[s]=1; } });
  Object.defineProperty(out,'v',{value:vivo,enumerable:false});
  return out;
}
function txtPassagens(l,ps){ const ks=['T','B'].filter(k=>ps[k]!=null); if(!ks.length) return '<small class="w">'+T('noPass')+'</small>';
  return ks.map(k=>'<small class="w">'+T('pass')+' ≈ <b>'+hm(ps[k])+'</b> · '+(l.ttu?(k==='T'?T('toB'):T('toT')):(k==='T'?T('toA'):T('toV')))+(ps.v&&ps.v[k]?' · <span class="vivo">'+T('live')+'</span>':'')+'</small>').join(''); }
function distLinha(l,lat,lon){ let b=1e18; l.shapes.forEach(s=>{ if(s.main){ const d=pertoDe(s.p,lat,lon).d; if(d<b) b=d; } }); return b; }
// trajetos (índices) da linha que passam no trecho selecionado
function passam(l){
  if(!trecho) return null;
  if(l._tk!==trecho.k){ l._tk=trecho.k; l._ts=new Set(); l.shapes.forEach((s,i)=>{ if(pertoDe(s.p,trecho.lat,trecho.lon).d<=TOL) l._ts.add(i); }); }
  return l._ts;
}
// viagens da linha que passam no trecho, no dia dk: [[minuto, sentido, índice], …]
function viagensTrecho(l,dk){ const ps=passam(l), out=[]; const d=l.dep[dk]||{};
  Object.keys(d).forEach(s=>d[s].forEach((m,i)=>{ if(!ps||ps.has(l.depV[dk][s][i])) out.push([m,s,i]); })); return out.sort((x,y)=>x[0]-y[0]); }
function setTrecho(pt){
  trecho=pt?{lat:pt.lat,lon:pt.lon,k:++trechoK}:null; trechoNovo=!!pt;
  if(trechoMarker&&map){ map.removeLayer(trechoMarker); } trechoMarker=null;
  if(trecho&&map){ trechoMarker=L.circleMarker([trecho.lat,trecho.lon],{radius:10,color:'#ffffff',weight:3,fillColor:css('--accent'),fillOpacity:1,interactive:false}).addTo(map); }
}
// clique no mapa: escolhe o trecho mais próximo e mostra o que passa ali
function cliqueMapa(ll){
  if(pickOrig){ confirmaPartida(ll); return; }
  if(dest&&!sel&&planoSel!=null) return; // com uma opção de viagem desenhada, o toque no mapa não troca de tela
  const mpp=40075016*Math.cos(ll.lat*Math.PI/180)/(256*Math.pow(2,map.getZoom())); const tol=Math.max((isMob()?20:13)*mpp,12);
  if(sel){ // linha aberta: trecho dentro dela (inclusive variantes tracejadas)
    const l=BYID[sel]; const antes=trecho; trecho=null; const di=dirInfo(l); trecho=antes; let m=null;
    l.shapes.forEach((s,i)=>{ if(!(s.main||di.set.has(i))) return; const r=pertoDe(s.p,ll.lat,ll.lng); if(r.d<=tol&&(!m||r.d<m.d)) m=r; });
    if(m){ viagem=null; if(tripLayer){ map.removeLayer(tripLayer); tripLayer=null; } setTrecho(m); const st=$('#pbody').scrollTop; detalhe(); $('#pbody').scrollTop=st; estilo(); return; }
  }
  let m=null; D.linhas.forEach(l=>l.shapes.forEach(s=>{ if(!s.main) return; const r=pertoDe(s.p,ll.lat,ll.lng); if(r.d<=tol&&(!m||r.d<m.d)) m=r; }));
  if(!m) return;
  limpaDestino(); setTrecho(m); const dk=hoje();
  const ls=D.linhas.map(l=>({id:l.id,v:viagensTrecho(l,dk),any:passam(l).size>0})).filter(x=>x.any).sort((a,b)=>b.v.length-a.v.length);
  if(!ls.length){ setTrecho(null); return; }
  if(ls.length===1){ selecionar(ls[0].id,false,true); return; }
  dest={trecho:true,nome:T('stretch'),lat:m.lat,lon:m.lon,lista:ls,ids:ls.map(x=>x.id)};
  sel=null; viagem=null; if(tripLayer){ map.removeLayer(tripLayer); tripLayer=null; } extras();
  verDestino(); ajusta(); estilo();
}
// variantes pouco usadas da linha aberta (não aparecem no mapa geral): desenhadas só enquanto a linha está aberta
function extras(){
  if(!map) return; if(extraLayer){ map.removeLayer(extraLayer); extraLayer=null; }
  if(!sel) return; const l=BYID[sel];
  if(!l._extra){ l._extra=[]; l.shapes.forEach((s,si)=>{ if(s.main||s.esp) return;
    const casing=L.polyline(s.p,{color:css('--casing'),weight:6,opacity:0,interactive:false}); const line=L.polyline(s.p,{color:l.cor,weight:3.5,opacity:0,interactive:false});
    l._extra.push({casing,line,si,i:1,x:1}); }); }
  const g=L.layerGroup(); l._extra.forEach(o=>{ g.addLayer(o.casing); g.addLayer(o.line); }); extraLayer=g.addTo(map);
}
// Busca de endereço, bairro ou local, restrita a Foz do Iguaçu.
// 1º Photon (serviço público do OpenStreetMap, sem chave, feito para busca enquanto se digita); 2º MapTiler (usa a cota da chave),
// só se o Photon falhar ou quando a pessoa pede a busca ampliada depois de um resultado vazio. Para usar só o MapTiler, deixe PHOTON vazio.
const addressSearch = window.createAddressSearch({ D, T, MT_KEY, metros, getLang: () => lang });
const { PHOTON, nzq, buscaPhoton, buscaMapTiler, buscaNumero, endJunta } = addressSearch;
function geocode(q,amplo){
  if(!q||q.length<3) return; clearTimeout(geoT); const ck=(amplo?'M|':'P|')+nzq(q);
  const fim=(res,st)=>{ if(st==='ok') _geo[ck]=res; if(geoQ!==q) return; geoRes=res; geoSt=st; geoAmplo=!!amplo||!PHOTON; if(!sel&&!dest){ lista(); if(st==='ok') anuncia(T('aGeo').replace('{n}',res.length)); } };
  geoQ=q; if(_geo[ck]) return fim(_geo[ck],'ok');
  geoSt='load'; geoRes=null; if(!sel&&!dest) lista();
  const pn=buscaNumero(q); // rua + número: índice do IBGE, em paralelo com a busca comum
  const mt=()=>buscaMapTiler(q).then(r=>endJunta(pn,r)).then(r=>fim(r,'ok')).catch(()=>pn.then(n=>n.length?fim(n,'ok'):fim(null,'err')));
  if(amplo||!PHOTON) mt(); else buscaPhoton(q).then(r=>endJunta(pn,r)).then(r=>fim(r,'ok')).catch(mt);
}
// busca automática: espera a pessoa parar de digitar (0,6 s); não dispara para número de linha nem texto curto
function agendaGeo(v){ clearTimeout(geoT); if(v.length<4||/^\d+\s?\w?$/.test(v)) return; if(geoQ===v&&geoSt!=='err') return;
  geoQ=v; geoSt='load'; geoRes=null; geoT=setTimeout(()=>geocode(v),600); }
// ponto de parada em cima do qual a pessoa soltou o alfinete (só com os pontos à vista no mapa); null se não há ponto perto
function pontoPerto(la,lo){ if(!map||!stopLayer||!map.hasLayer(stopLayer)) return null; const mpp=40075016*Math.cos(la*Math.PI/180)/(256*Math.pow(2,map.getZoom())); let bd=Math.min(35,Math.max(12,(isMob()?22:16)*mpp)), b=null;
  D.stops.forEach(p=>{ const d=metros(p[0],p[1],la,lo); if(d<=bd){ bd=d; b=p; } }); return b; }
const nomeDoPonto=b=>b[2]||semNumero(b[4])||T('stop');
function destino(r){
  if(!r.meuLocal) origNao=false;
  setTrecho(null); sel=null; extras();
  const todas=D.linhas.map(l=>({id:l.id,d:distLinha(l,r.lat,r.lon)})).sort((a,b)=>a.d-b.d);
  let perto=todas.filter(x=>x.d<=500); const longe=!perto.length; if(longe) perto=todas.slice(0,3);
  dest={nome:r.nome,lat:r.lat,lon:r.lon,lista:perto,longe,ids:perto.map(x=>x.id),eu:!!r.eu,ml:!!r.meuLocal};
  if(map){ if(destMarker) map.removeLayer(destMarker); destMarker=null;
    if(!r.eu) destMarker=L.marker([r.lat,r.lon],{icon:L.divIcon({className:'dest-ic',html:'<div class="dpin"></div>',iconSize:[30,30],iconAnchor:[15,34]}),zIndexOffset:900,keyboard:false,draggable:true,autoPan:true,title:T('dragD')}).bindTooltip(r.nome,{direction:'top',offset:[0,-34]}).addTo(map);
    // arrastou o destino: vale o lugar novo (sem tirar o mapa de onde a pessoa está olhando)
    if(destMarker) destMarker.on('dragend',()=>{ const q=destMarker.getLatLng(); let nome=T('dMapP'), la=q.lat, lo=q.lng;
      { const b=pontoPerto(la,lo); if(b){ nome=nomeDoPonto(b); la=b[0]; lo=b[1]; } } // soltou em cima de um ponto de parada: o destino passa a ser o ponto, com o nome dele
      destino({nome,lat:la,lon:lo,fica:true}); setTimeout(()=>{ if(map) map.closePopup(); },80); }); }
  sel=null; viagem=null; planoSel=null; locErr=false; verDestino();
  if(map){ map.invalidateSize({animate:false}); if(!r.fica) map.setView([r.lat,r.lon],r.eu?16:15); estilo(); }
}
function verDestino(){
  $('.app').classList.add('has-sel'); $('#panel').classList.remove('min');
  const lb=$('#linebar'); lb.hidden=false; $('#tripbar').hidden=true; $('#trechobar').hidden=true;
  lb.innerHTML='<button class="back" id="back">'+T('back')+'</button><span class="pin" style="flex:none">◎</span><h2 style="font-size:17px">'+esc(dest.trecho?T('stretch'):dest.eu?T('nearYou'):dest.nome)+'</h2>';
  const dk=hoje();
  const rows=dest.lista.map(x=>{ const l=BYID[x.id]; const s=sentidos(l,dk)[0]; const nx=s?proximas(l,dk,s,1)[0]:null; const dir=loc&&distLinha(l,loc[0],loc[1])<=500;
    rtU=(dest.trecho||dest.eu)?0:2; const pp=txtPassagens(l,passagens(l,dk,dest.lat,dest.lon,dest.trecho?TOL:500)); rtU=0;
    if(dest.trecho){
      return '<button class="lbtn" data-id="'+l.id+'"><span class="badge" style="'+bg(l)+'">'+l.id+'</span><span class="nm">'+l.nome+'<small class="w">'+T('tripsToday').replace('{n}',x.v.length)+'</small>'+pp+'</span><span class="chev" aria-hidden="true">›</span></button>'; }
    return '<button class="lbtn" data-id="'+l.id+'"><span class="badge" style="'+bg(l)+'">'+l.id+'</span><span class="nm">'+l.nome+(dir&&!dest.eu?'<span class="tagd">'+T('direct')+'</span>':'')+'<small class="w">'+T('at').replace('{n}',Math.round(x.d/10)*10)+'</small>'+pp+'</span><span class="chev" aria-hidden="true">›</span></button>'; }).join('');
  const plano=(!dest.trecho&&!dest.eu)?htmlPlano():'';
  $('#pbody').innerHTML=plano+'<div class="group">'+(dest.trecho?T('stretchL'):dest.longe?T('noNear'):dest.eu?T('nearYouL'):T('nearL'))+'</div><div class="rows">'+rows+'</div><p class="note" style="padding:0 18px 18px">'+T('estNote')+' '+T('disc')+'</p>';
  // com uma opção de viagem aberta no mapa, "Voltar" fecha só essa opção e mostra de novo todas; sem opção aberta, sai do destino
  $('#back').onclick=()=>{ if(dest&&!dest.trecho&&!dest.eu&&planoSel!=null){ planoSel=null; verDestino(); $('#pbody').scrollTop=0; ajusta(); if(map) map.setView([dest.lat,dest.lon],15); estilo(); return; } limpaDestino(); selecionar(null); };
  $('#pbody').querySelectorAll('.lbtn').forEach(b=>b.addEventListener('click',()=>selecionar(b.dataset.id,false,!!(dest&&dest.trecho))));
  if(plano) ligaPlano();
  desenhaPlano(false);
}
function limpaDestino(){ if(dest&&dest.trecho) setTrecho(null); dest=null; planoSel=null; quaseVer=null; quando=null; if(pickOrig) escolherPartida(false); desenhaPlano(false); if(destMarker&&map) map.removeLayer(destMarker); destMarker=null; }

// ── como chegar de ônibus: linha direta ou uma troca (integração) ──
const ANDA=70;       // metros por minuto a pé (≈ 4 km/h), sobre a distância em linha reta × 1,25
const R_PE=800;      // distância máxima a pé (m) da partida até o embarque e do desembarque até o destino
const R_TERM=150;    // raio (m) para considerar que um trajeto atende as plataformas do Terminal ou o ponto da sua ponta
const R_PONTO=60;    // um trajeto atende um ponto de parada se passa a esta distância dele (m)
const R_TROCA=250;   // distância máxima a pé (m) entre o ponto onde desce e o ponto onde embarca de novo
const R_COMODA=60;   // troca "cômoda": desce e embarca no mesmo ponto ou num ponto vizinho (m)
const INTEG=90;      // minutos da integração gratuita, contados do primeiro embarque
const FOLGA=3;       // minutos mínimos entre descer de um ônibus e embarcar no outro
let origM=null, pickOrig=false, origMarker=null, planoSel=null, planLayer=null, locErr=false, quaseVer=null, pickAlvo='de', origNao=false, quando=null; // quando = {data, t, dk}: viagem planejada para outro dia/horário // quaseVer = ônibus do aviso "Passando agora" que a pessoa pediu para ver no mapa
const origem=()=>origM||(loc&&!origNao?{lat:loc[0],lon:loc[1],eu:true}:null); // origNao: o destino é a própria localização, então ela não serve de partida
// planejador num dia/horário escolhido pela pessoa: só horário programado (sem posição ao vivo)
function futuro(){ return !!(quando&&dest&&!sel&&!dest.trecho&&!dest.eu); }
function setQuando(data,hhmm){ if(!data||!hhmm){ quando=null; return; } const p=data.split('-').map(Number), h=hhmm.split(':').map(Number); let t=h[0]*60+h[1];
  const d=new Date(p[0],p[1]-1,p[2]); if(t<180){ d.setDate(d.getDate()-1); t+=1440; } const w=d.getDay(); quando={data,hhmm,t,dk:w===0?'DOM':w===6?'SAB':'DU'}; }
const dataISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function txtQuando(){ const p=quando.data.split('-').map(Number), d=new Date(p[0],p[1]-1,p[2]); const loc={pt:'pt-BR',es:'es',en:'en'}[lang]||'pt-BR';
  return d.toLocaleDateString(loc,{weekday:'short',day:'2-digit',month:'2-digit'}).replace(/\.,/,','); }
const digitando=()=>{ const a=document.activeElement; return !!a&&(a.id==='plDe'||a.id==='plPara'); };
const metros=(a,b,c,d)=>Math.hypot((b-d)*111320*Math.cos(a*Math.PI/180),(a-c)*110540);
const aPe=m=>Math.max(1,Math.round(m*1.25/ANDA));
const r10=m=>Math.max(10,Math.round(m/10)*10);
// nome do ponto para o passageiro: o nome de referência, se houver; senão a rua, sem a numeração (as faixas de número do cadastro confundem mais do que ajudam)
const semNumero=e=>String(e||'').replace(/,\s*\d[\d\s\-–]*$/,'');
const nomePonto=k=>{ const p=D.stops[k]; return p[2]||semNumero(p[4])||T('stop'); };
const TTU=D.poi.find(p=>p.k==='ttu');
const noTTU=k=>{ const p=D.stops[k]; if(p._t===undefined) p._t=!!TTU&&metros(p[0],p[1],TTU.lat,TTU.lon)<=200; return p._t; };
// coordenadas planas (m) para as contas de distância do planejador
const KX=111320*Math.cos(25.5*Math.PI/180), KY=110540;
D.stops.forEach(p=>{ p._x=p[1]*KX; p._y=p[0]*KY; });
const routeEngine = window.createRouteEngine({
  D, BYID, R_PE, R_TERM, R_PONTO, R_TROCA, R_COMODA, INTEG, FOLGA, KX, KY,
  hoje, agora, rtQuero, rtEta, rtV, rtVale, agoraSeg, aPe, minCedo, minAte, metros, noTTU, aoLongo,
  getWhen: () => quando,
  getRealtime: () => RT
});
const { pontosDoTrajeto, viagensShape, candidatos, trocas, planejar } = routeEngine;
// trecho do trajeto entre as frações f0 e f1
function fatia(s,f0,f1){ const P=s.p; if(!s._c) aoLongo(s,P[0][0],P[0][1]); const c=s._c, tot=c[P.length-1], a=f0*tot, b=f1*tot;
  const em=d=>{ let i=1; while(i<P.length-1&&c[i]<d) i++; const t=(d-c[i-1])/((c[i]-c[i-1])||1); return [P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t]; };
  const out=[em(a)]; for(let i=1;i<P.length-1;i++) if(c[i]>a&&c[i]<b) out.push(P[i]); out.push(em(b)); return out; }
function assinatura(o){ return o.legs.map(g=>g.l.id+'@'+g.si+'@'+g.m).join('>'); }
function htmlPlano(){
  const O=origem(); let h='<div class="group">'+T('how')+'</div><div class="plan">';
  // De → Para: o destino está no título; aqui a pessoa diz de onde sai (digitando, pela localização ou tocando no mapa)
  // A → B, como nos aplicativos de mapa: em cada campo dá para digitar (endereço, ponto de parada ou local), usar a própria localização ou escolher no mapa
  const campoDe=O=>{ const bt=(id,cls,key)=>'<button type="button" id="'+id+'" class="depin'+cls+'" title="'+T(key)+'" aria-label="'+T(key)+'"><i></i></button>';
    return '<div class="de ab">'+
      '<div class="deR"><span class="abL" aria-hidden="true">A</span><input id="plDe" type="search" autocomplete="off" aria-label="'+T('deL')+'" placeholder="'+T(!O?'deL':O.eu?'oLocP':O.nome?'deL':'oMapP')+'" value="'+(O&&O.nome?esc(O.nome):'')+'">'+bt('plLoc',' loc','useLocA')+bt('plPin','','pickMapA')+'</div>'+
      '<div id="plSug" class="poil" hidden></div>'+
      '<div class="deR"><span class="abL b" aria-hidden="true">B</span><input id="plPara" type="search" autocomplete="off" aria-label="'+T('paraL')+'" placeholder="'+T('paraL')+'" value="'+esc(dest.nome||'')+'">'+bt('plLocB',' loc','useLocA')+bt('plPinB','','pickMapB')+'</div>'+
      '<div id="plSugB" class="poil" hidden></div>'+
      (O?'<button type="button" id="plSwap" class="abSwap" title="'+T('swapAB')+'" aria-label="'+T('swapAB')+'">⇅</button>':'')+
      (!O?'<button class="cardbtn" id="plLoc0">'+T('useLoc')+'</button>':'')+
      // dia e horário: "agora" ou outro dia/hora escolhido (ícone de calendário)
      '<button type="button" id="plQuando" class="qbtn'+(quando?' on':'')+'" aria-expanded="false"><i class="cal"></i><span>'+(quando?T('qSai').replace('{d}',esc(txtQuando())).replace('{h}',quando.hhmm):T('qAgora'))+'</span><span class="chev" aria-hidden="true">▾</span></button>'+
      '<div id="plQPanel" class="qpanel" hidden><div class="qchips"><button type="button" class="chip" data-q="agora">'+T('qVolta')+'</button><button type="button" class="chip" data-q="am">'+T('qAmanhaM')+'</button><button type="button" class="chip" data-q="an">'+T('qAmanhaN')+'</button></div>'+
        '<div class="qrow"><label>'+T('qDia')+'<input type="date" id="plQData"></label><label>'+T('qHora')+'<input type="time" id="plQHora" step="300"></label></div>'+
        '<button type="button" class="cardbtn" id="plQOk">'+T('qOk')+'</button></div>'+
      '</div>'; };
  if(!O){ dest.plano=null; planoSel=null;
    return h+campoDe(null)+(locErr?'<p class="note" style="margin:0">'+T('locFail')+'</p>':'')+'</div>'; }
  const key=O.lat.toFixed(5)+','+O.lon.toFixed(5)+'@'+(quando?'Q'+quando.data+'|'+quando.t:hoje()+agora()+'|'+RT.t);
  if(!dest.plano||dest.plano.key!==key){ const velho=dest.plano, ant=(velho&&planoSel!=null&&velho.ops[planoSel])?assinatura(velho.ops[planoSel]):null;
    const r=planejar(O,dest); let an=0;
    // mesma partida: as caminhadas já conferidas pela rua continuam valendo nas opções que se repetem (e a ordem segue a chegada real)
    if(velho&&velho.O&&velho.O.lat===O.lat&&velho.O.lon===O.lon){ const ch=o=>assinatura(o)+'|'+o.legs.map(g=>g.k0+'-'+g.k1).join('|'), V={}; velho.ops.forEach(o=>{ V[ch(o)]=o; }); let levou=false;
      r.ops.forEach(o=>{ const v=V[ch(o)]; if(v) ['rO','rD','rT'].forEach(c=>{ if(v[c]!=null){ o[c]=v[c]; levou=true; } }); });
      if(levou){ const real=q=>{ const z=q.legs[q.legs.length-1]; return q.rD!=null?z.t1+Math.max(1,Math.ceil(q.rD/ANDA)):q.chega; }; r.ops.sort((a,b)=>real(a)-real(b)); }
      if(velho.ops.length===r.ops.length) an=velho.an||0; }
    dest.plano={key,O,ops:r.ops,quase:r.quase||[],semPonto:!!r.semPonto,semServ:!!r.semServ,an:an}; planoSel=null;
    if(ant){ const i=r.ops.findIndex(o=>assinatura(o)===ant); if(i>=0) planoSel=i; } }
  const P=dest.plano, now=quando?quando.t:agora(), dOX=metros(O.lat,O.lon,dest.lat,dest.lon);
  h+=campoDe(O)+(locErr?'<p class="note" style="margin:0">'+T('locFail')+'</p>':'');
  if(dOX<=R_PE) h+='<p class="note" style="margin:0">'+T('close').replace('{m}',r10(dOX))+'</p>';
  if(P.semPonto||P.semServ) h+='<p class="note" style="margin:0">'+T(P.semPonto?'noStopO':'noServO')+'</p>';
  else if(!P.ops.length){ if(dOX>R_PE) h+='<p class="note" style="margin:0">'+T('noPlan')+'</p>'; }
  if(quando&&P.ops.length) h+='<div class="futaviso"><i class="cal"></i><span>'+T('qAviso').replace('{d}','<b>'+esc(txtQuando())+'</b>').replace('{h}','<b>'+quando.hhmm+'</b>')+'</span></div>';
  if(P.quase&&P.quase.length) h+='<div class="quase"><div class="quaseT">'+T('quaseT')+'</div>'+P.quase.map((q,qi)=>'<button class="quaseR" data-pq="'+qi+'"><span class="badge" style="'+bg(q.l)+'">'+q.l.id+'</span><span>'+
    T('quase').replace('{h}','<b>'+hm(q.eta)+'</b>')+' <span class="vivo">'+T('live')+'</span> · '+T('quaseP').replace('{p}','<b>'+esc(nomePonto(q.k))+'</b>').replace('{m}',r10(q.d))+' · '+T('perdeF').replace('{c}',hm(q.cheg))+(q.tr?' · '+T('quaseTr').replace('{l}','<b>'+q.tr.l.id+'</b>'):'')+'<span class="quaseV">'+T('quaseVer')+'</span></span></button>').join('')+'</div>';
  if(P.ops.length) h+='<p class="note" style="margin:0">'+T('tapOpt')+'</p>';
  P.ops.forEach((o,i)=>{ const a=o.legs[0], z=o.legs[o.legs.length-1], tr=o.legs.length>1;
    const sentido=g=>rotSent(g.l,sentShape(g.l)[g.si].charAt(0)||'T');
    // com o caminho pela rua já conhecido, a distância, a hora de sair e a de chegar passam a usar a caminhada real
    const rua=m=>Math.max(1,Math.ceil(m/ANDA)), sai=o.rO!=null?a.t0-rua(o.rO):o.sai, chega=o.rD!=null?z.t1+rua(o.rD):o.chega, tarde=o.rO!=null&&sai<now;
    // o destaque é o que a pessoa precisa fazer primeiro: qual ônibus pegar e a que horas; a chegada fica no fim
    h+='<div class="opt'+(planoSel===i?' on':'')+'" data-po="'+i+'"><div class="opth"><span class="badge" style="'+bg(a.l)+'">'+a.l.id+'</span><span class="emb">'+(mesmaCor(o)?'<i class="pern" style="background:'+corPerna(o,0)+'"></i>':'')+T('board')+' ≈ <b>'+hm(a.t0)+'</b></span>'+(a.lv?'<span class="tag vv" style="margin:0">'+T('live')+'</span>':'<span class="tag" style="margin:0">'+T('tagEst')+'</span>')+'</div>'+
      '<div class="opts">'+sentido(a).replace(/^./,c=>c.toUpperCase())+' · '+T(tr?'troca1':'direto')+'</div>'+
      (o.alt&&o.alt.length?'<div class="opts">'+T('orAlso')+' '+o.alt.map(x=>x.l.id+' ≈ '+hm(x.t0)).join(' · ')+'</div>':'')+
      (o.antes?'<div class="opts antes">'+T('antes').replace('{l}',o.antes.l.id).replace('{h}','<b>'+hm(o.antes.t0)+'</b>')+' <span class="vivo">'+T('live')+'</span> · '+T('antesF').replace('{n}',Math.max(0,z.t0-o.antes.t1))+'</div>':'')+
      (tarde?'<div class="warn">'+T('late').replace('{m}',r10(o.rO)).replace('{n}',rua(o.rO))+'</div>':'')+
      (o.rD!=null&&o.rD>=700&&o.rD>=1.8*o.dD?'<div class="warn">'+T('longe').replace('{m}',r10(o.rD)).replace('{n}',rua(o.rD))+'</div>':'')+'<ol class="legs">'+
      '<li><span class="ico">'+T('pe')+'</span><span>'+T('walkTo').replace('{m}',r10(o.rO!=null?o.rO:o.dO)).replace('{p}','<b>'+esc(nomePonto(a.k0))+'</b>')+'</span></li>'+
      (tr?'<li><span class="ico tr">'+T('trf')+'</span><span>'+(o.ttu?T('trfTTU'):T('trfAt').replace('{p}','<b>'+esc(nomePonto(a.k1))+'</b>')+(o.dT>30?' · '+T('trfWalk').replace('{m}',r10(o.rT!=null?o.rT:o.dT)).replace('{p}','<b>'+esc(nomePonto(z.k0))+'</b>'):''))+' ≈ <b>'+hm(a.t1)+'</b> · '+T('wait').replace('{n}',Math.max(0,z.t0-a.t1))+'</span></li>'+
        '<li><span class="badge" style="'+bg(z.l)+'">'+z.l.id+'</span><span>'+(mesmaCor(o)?'<i class="pern" style="background:'+corPerna(o,1)+'"></i>':'')+T('board')+' ≈ <b class="hgr'+(z.lv?' vivo':'')+'">'+hm(z.t0)+'</b> · '+sentido(z)+(z.lv?' · '+T('live'):'')+'</span></li>':'')+
      '<li><span class="ico">'+T(o.dD<=200?'offI':'pe')+'</span><span>'+T('offAt').replace('{p}','<b>'+esc(nomePonto(z.k1))+'</b>')+' ≈ <b>'+hm(z.t1)+'</b> · '+(o.dD<=200?T('nearDest'):T('walkEnd').replace('{m}',r10(o.rD!=null?o.rD:o.dD)))+'</span></li>'+
      '<li class="fim"><span class="ico tr">'+T('arr').toLowerCase()+'</span><span>≈ <b>'+hm(chega)+'</b> · '+T('durMin').replace('{n}',chega-Math.max(sai,now))+'</span></li></ol>'+
      '<div class="optb"><button class="vmap" data-pm="'+i+'" aria-pressed="'+(planoSel===i)+'">'+T('seeMap')+'</button>'+o.legs.map((g,j)=>'<button class="vmap" data-pl="'+i+','+j+'">'+T('seeTimes').replace('{id}',g.l.id)+'</button>').join('')+'</div></div>'; });
  return h+'</div>';
}
function ligaPlano(){
  const usaLoc=()=>localizar(()=>{ origM=null; origNao=false; marcaPartida(); locErr=false; verDestino(); estilo(); },()=>{ locErr=true; if(dest&&!sel) verDestino(); });
  ['#plLoc','#plLoc0'].forEach(q=>{ const b=$(q); if(b) b.onclick=usaLoc; });
  const bn=$('#plPin'); if(bn) bn.onclick=()=>escolherPartida(true,'de');
  const bnB=$('#plPinB'); if(bnB) bnB.onclick=()=>escolherPartida(true,'para');
  // destino = onde a pessoa está (ex.: alguém vem até ela): a localização deixa de valer como partida, que passa a ser pedida no campo A
  const blB=$('#plLocB'); if(blB) blB.onclick=()=>localizar(ll=>{ origNao=!origM; locErr=false; destino({nome:T('meuLocal'),lat:ll[0],lon:ll[1],meuLocal:true}); },()=>{ locErr=true; if(dest&&!sel) verDestino(); });
  const campo=(id,alvo,sug)=>{ const de=$(id); if(!de) return; de.oninput=()=>sugereDe(de.value.trim(),alvo); de.onfocus=()=>{ de.select(); if(alvo==='de'&&de.value.trim().length>=3) sugereDe(de.value.trim(),alvo); };
    de.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); const b=$(sug+' [data-de]'); if(b) b.click(); } else if(e.key==='Escape'&&!$(sug).hidden){ e.stopPropagation(); $(sug).hidden=true; } }; };
  campo('#plDe','de','#plSug'); campo('#plPara','para','#plSugB');
  // inverter A e B: o destino vira a partida e a partida vira o destino ("sua localização" vai junto)
  const bs=$('#plSwap'); if(bs) bs.onclick=()=>{ const O=origem(); if(!O||!dest) return; const d=dest;
    origM=d.ml?null:{lat:d.lat,lon:d.lon,nome:d.nome}; origNao=false;
    const nb=O.eu?{nome:T('meuLocal'),lat:O.lat,lon:O.lon,meuLocal:true,fica:true}:{nome:O.nome||T('dMapP'),lat:O.lat,lon:O.lon,fica:true};
    destino(nb); marcaPartida(); if(map){ ajusta(L.latLngBounds([[d.lat,d.lon],[nb.lat,nb.lon]])); estilo(); } anuncia(T('aSwap')); };
  // dia e horário
  const qb=$('#plQuando'), qp=$('#plQPanel'), aplica=()=>{ dest.plano=null; planoSel=null; quaseVer=null; verDestino(); estilo(); if(planLayer==null&&map) desenhaPlano(false); };
  if(qb&&qp){ qb.onclick=()=>{ const ab=qp.hidden; qp.hidden=!ab; qb.setAttribute('aria-expanded',String(ab));
      if(ab){ const n=new Date(); $('#plQData').value=quando?quando.data:dataISO(n); $('#plQData').min=dataISO(n); const mx=new Date(n); mx.setDate(mx.getDate()+60); $('#plQData').max=dataISO(mx);
        $('#plQHora').value=quando?quando.hhmm:String(n.getHours()).padStart(2,'0')+':'+String(Math.floor(n.getMinutes()/5)*5).padStart(2,'0'); } };
    qp.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ const k=b.dataset.q; if(k==='agora') quando=null; else { const a=new Date(); a.setDate(a.getDate()+1); setQuando(dataISO(a),k==='am'?'07:00':'19:00'); } aplica(); });
    $('#plQOk').onclick=()=>{ setQuando($('#plQData').value,$('#plQHora').value); aplica(); }; }
  $('#pbody').querySelectorAll('[data-pm]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.pm; quaseVer=null; planoSel=(planoSel===i&&!isMob())?null:i; const st=$('#pbody').scrollTop; verDestino(); $('#pbody').scrollTop=st;
    if(planoSel!=null&&isMob()) $('#panel').classList.add('min'); desenhaPlano(true); if(planoSel==null&&map){ ajusta(); map.setView([dest.lat,dest.lon],15); } estilo();
    if(tecl){ const nb=$('#pbody').querySelector('[data-pm="'+i+'"]'); if(nb) nb.focus({preventScroll:true}); } });
  // tocar numa linha do aviso "Passando agora": mostra aquele ônibus no mapa (com o ponto por onde ele passa) e abre o balão dele
  $('#pbody').querySelectorAll('[data-pq]').forEach(b=>b.onclick=()=>{ const q=dest&&dest.plano&&dest.plano.quase?dest.plano.quase[+b.dataset.pq]:null; if(!q||!map) return;
    quaseVer={px:q.o.px,l:q.l.id}; const pn=$('#panel'); if(isMob()&&pn.classList.contains('alto')){ pn.classList.remove('alto'); sheetTxt(); }
    rtDesenha(); const p=D.stops[q.k], px=q.o.px; let feito=false;
    // o balão só abre depois que o mapa termina de se enquadrar; senão o Leaflet calcula a posição dele com o mapa ainda em movimento e ele fica cortado
    const abre=()=>{ if(feito) return; feito=true; let m=null; if(rtLayer) rtLayer.eachLayer(x=>{ if(!m&&x.options&&x.options.px===px) m=x; }); if(m) m.openPopup(); };
    map.once('moveend',abre); setTimeout(abre,600); ajusta(L.latLngBounds([[q.o.lat,q.o.lon],[p[0],p[1]]]),isMob()?150:230); });
  // tocar no cartão (fora dos botões) escolhe a opção e mostra o trajeto dela no mapa, sem recolher o painel: dá para alternar entre as opções só pelos cartões
  $('#pbody').querySelectorAll('.opt[data-po]').forEach(c=>c.onclick=e=>{ if(e.target.closest('button,a,input')) return; const sl=window.getSelection?String(window.getSelection()):''; if(sl) return;
    const i=+c.dataset.po, pn=$('#panel'), pb=$('#pbody'); quaseVer=null; if(planoSel!==i){ planoSel=i; const st=pb.scrollTop; verDestino(); pb.scrollTop=st; }
    if(isMob()&&pn.classList.contains('alto')){ pn.classList.remove('alto'); sheetTxt(); }             // painel puxado para cima: volta ao meio, para o mapa aparecer
    desenhaPlano(true); estilo();
    const nc=pb.querySelector('.opt[data-po="'+i+'"]'); if(nc){ const r=nc.getBoundingClientRect(), R=pb.getBoundingClientRect(); if(r.top<R.top||r.top>R.bottom-120) pb.scrollTop+=r.top-R.top-8; } });
  $('#pbody').querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{ const q=b.dataset.pl.split(','), g=dest.plano.ops[+q[0]].legs[+q[1]], p=D.stops[g.k0];
    setTrecho({lat:p[0],lon:p[1]}); selecionar(g.l.id,false,true,sentShape(g.l)[g.si].charAt(0)||null); });
  if(dest.plano&&dest.plano.ops.length){ if(!dest.plano.an){ dest.plano.an=1; anuncia(T('aPlan').replace('{n}',dest.plano.ops.length)); } confere(dest.plano.ops[0]); }
}
// caminho a pé pelas ruas: serviço público de rotas do OpenStreetMap (FOSSGIS). Um pedido por segundo, só ao ver a opção no mapa;
// se não responder em 6 s, ou devolver um caminho absurdo, a caminhada continua em linha reta. Para desligar, deixe ROTA_PE vazio.
const ROTA_PE='https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const _rotas={}; let rotaFila=Promise.resolve(), rotaCred=false;
// caminho bruto do serviço entre dois pontos: [[lat,lon],…] ou null (uma consulta por segundo, com memória)
function pedeRota(a,c){
  const key=[a[0],a[1],c[0],c[1]].map(v=>(+v).toFixed(5)).join(','); if(_rotas[key]) return _rotas[key];
  const p=rotaFila.then(()=>new Promise(res=>{ const ctl=window.AbortController?new AbortController():null; const tm=setTimeout(()=>{ if(ctl) ctl.abort(); res(null); },6000);
    fetch(ROTA_PE+(+a[1]).toFixed(5)+','+(+a[0]).toFixed(5)+';'+(+c[1]).toFixed(5)+','+(+c[0]).toFixed(5)+'?overview=full&geometries=geojson',ctl?{signal:ctl.signal}:{}).then(r=>r.json()).then(j=>{ clearTimeout(tm);
      const r=j&&j.code==='Ok'&&j.routes&&j.routes[0]; if(!r||!r.geometry||!r.geometry.coordinates||r.geometry.coordinates.length<2) return res(null);
      res(r.geometry.coordinates.map(v=>[v[1],v[0]])); }).catch(()=>{ clearTimeout(tm); res(null); }); }));
  rotaFila=p.then(()=>new Promise(r=>setTimeout(r,1100)));
  p.then(v=>{ if(!v) delete _rotas[key]; });
  return _rotas[key]=p; }
// Caminhada de a até c → { m: metros, p: caminho } ou null (fica a linha reta).
// altA / altC: ponto a 60 m do ponto de parada, do lado de quem vai a pé. O serviço "gruda" o ponto de parada na pista do sentido do ônibus e,
// numa avenida de pista dupla, manda dar a volta até o retorno; pedindo o caminho até o outro lado da avenida e somando a travessia, sai o caminho real.
// Essa segunda consulta só é feita quando a primeira dá uma volta grande.
function rotaPe(a,c,altA,altC){ if(!ROTA_PE||!window.fetch) return Promise.resolve(null);
  const reta=metros(a[0],a[1],c[0],c[1]);
  const fecha=q=>{ q=atalho(atalho([a].concat(q,[c])).reverse()).reverse(); let m=0; for(let i=1;i<q.length;i++) m+=metros(q[i-1][0],q[i-1][1],q[i][0],q[i][1]); return m>reta*8+1500?null:{m:Math.round(m),p:q}; };
  return pedeRota(a,c).then(q=>{ if(!q) return null; const r1=fecha(q);
    if(!(altA||altC)||(r1&&r1.m<=reta*1.35+150)) return r1;
    return pedeRota(altA||a,altC||c).then(q2=>{ const r2=q2?fecha(q2):null; return r2&&(!r1||r2.m<r1.m-80)?r2:r1; }); }); }
// O serviço só conhece as vias mapeadas: numa avenida de pista dupla ele manda andar até o retorno, como um carro, em vez de atravessar o canteiro.
// Quando o que falta do caminho é muito maior que a linha reta até o fim, e o fim está perto (até 100 m), o caminho é cortado no ponto
// de onde sai mais curto seguir reto. Só vale para travessia curta (até 100 m): volta grande de verdade — rodovia, rio — fica como o serviço mandou.
// p: [[lat,lon],…] do começo ao fim.
function atalho(p){
  const d=[]; for(let i=0;i<p.length;i++){ if(i){ const a=p[i-1], b=p[i], n=Math.floor(metros(a[0],a[1],b[0],b[1])/30); for(let k=1;k<=n;k++){ const t=k/(n+1); d.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); } } d.push(p[i]); }
  const n=d.length, fim=d[n-1], ate=[0]; for(let i=1;i<n;i++) ate.push(ate[i-1]+metros(d[i-1][0],d[i-1][1],d[i][0],d[i][1]));
  const tot=ate[n-1]; let best=-1, bc=tot-150;                               // só vale se economizar pelo menos 150 m
  for(let i=0;i<n-1;i++){ const ds=metros(d[i][0],d[i][1],fim[0],fim[1]); if(ds>100||tot-ate[i]<=2.5*ds+80) continue; const c=ate[i]+1.3*ds; if(c<bc){ bc=c; best=i; } }
  return best<0?p:d.slice(0,best+1).concat([fim]); }
function creditoRota(){ if(rotaCred||!map||!map.attributionControl) return; rotaCred=true; map.attributionControl.addAttribution('a pé: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS</a> (<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">corrigir</a>)'); }
// Cor de cada ônibus da viagem no mapa: a cor da própria linha. Quando as duas linhas da troca são da mesma família de cor (ex.: 101 e 120, azuis),
// o segundo ônibus ganha uma cor de contraste, para o ponto da troca saltar aos olhos; nesse caso o cartão repete as cores numa barrinha ao lado de cada embarque.
function mesmaCor(o){ return o.legs.length>1&&fam(o.legs[0].l)===fam(o.legs[1].l); }
function corPerna(o,i){ const l=o.legs[i].l; if(i===1&&mesmaCor(o)) return fam(l)==='f0'?'#1c62b9':'#c2410c'; return escurecer(l.cor,escuro()?0:.35); }
// caminhadas de uma opção de viagem: [de, até, campo onde guardar a distância real, altA, altC] (altA/altC: ver rotaPe)
function caminhadas(o,O){ const pt=k=>[D.stops[k][0],D.stops[k][1]], ult=o.legs[o.legs.length-1], Op=[O.lat,O.lon], Dp=[dest.lat,dest.lon];
  // ponto a 60 m do ponto de parada, perpendicular ao trajeto do ônibus, para o lado onde está "outro"
  const lado=(q,ini,outro)=>{ const f=ini?q.f0:q.f1, t=fatia(q.l.shapes[q.si],Math.max(0,f-0.004),Math.min(1,f+0.004)), A=t[0], B=t[t.length-1], P=pt(ini?q.k0:q.k1);
    const tx=(B[1]-A[1])*KX, ty=(B[0]-A[0])*KY, n=Math.hypot(tx,ty); if(!n) return null; let nx=-ty/n, ny=tx/n;
    const d=(outro[1]-P[1])*KX*nx+(outro[0]-P[0])*KY*ny; if(Math.abs(d)<25) return null; if(d<0){ nx=-nx; ny=-ny; }
    return [P[0]+ny*60/KY,P[1]+nx*60/KX]; };
  const r=[[Op,pt(o.legs[0].k0),'rO',null,lado(o.legs[0],true,Op)]];
  if(o.legs.length>1&&o.dT>30) r.push([pt(o.legs[0].k1),pt(o.legs[1].k0),'rT',null,null]);
  r.push([pt(ult.k1),Dp,'rD',lado(ult,false,Dp),null]); return r; }
// A primeira opção é conferida sozinha, sem abrir o mapa: se a caminhada real for bem maior que a linha reta (rodovia, rio, quadra fechada),
// o cartão já mostra a distância pela rua. As outras opções são conferidas quando a pessoa toca em "Ver no mapa".
function confere(o){ if(!o||o._conf||!dest||!dest.plano) return; o._conf=1;
  caminhadas(o,dest.plano.O).forEach(x=>{ if(metros(x[0][0],x[0][1],x[1][0],x[1][1])<=250) return;
    rotaPe(x[0],x[1],x[3],x[4]).then(r=>{ if(!r||o[x[2]]===r.m) return; o[x[2]]=r.m; creditoRota();
      const P=dest&&dest.plano; if(!P||P.ops.indexOf(o)<0) return;
      // com a caminhada real, a opção pode deixar de ser a que chega primeiro: reordena (e a nova primeira é conferida em seguida)
      const real=q=>{ const z=q.legs[q.legs.length-1]; return q.rD!=null?z.t1+Math.max(1,Math.ceil(q.rD/ANDA)):q.chega; };
      const marcada=planoSel!=null?P.ops[planoSel]:null; P.ops.sort((a,b)=>real(a)-real(b)); if(marcada) planoSel=P.ops.indexOf(marcada);
      if(!sel&&!digitando()){ const st=$('#pbody').scrollTop; verDestino(); $('#pbody').scrollTop=st; } }); }); }
// Caminhadas de até 250 m em linha reta não consultam o serviço: ficam retas. Até 200 m do ponto ao destino, o cartão diz só "ao lado do destino"
// (o endereço de um lugar grande — rodoviária, aeroporto, hospital — cai no meio do terreno, e o ônibus para na porta).
// desenha no mapa a opção de viagem escolhida: caminhadas (pontilhado), trechos de ônibus, embarques e desembarque
function desenhaPlano(enquadra){
  if(planLayer&&map) map.removeLayer(planLayer); planLayer=null;
  if(!map||sel||!dest||!dest.plano||planoSel==null) return; const o=dest.plano.ops[planoSel]; if(!o) return; const O=dest.plano.O;
  const g=L.layerGroup(), b=L.latLngBounds([]), pt=k=>[D.stops[k][0],D.stops[k][1]]; let comBus=false;
  // caminhada: sai em linha reta e, quando o serviço de rotas responde, passa a seguir as ruas (campo = onde guardar a distância real)
  const pe=(a,c,campo,altA,altC)=>{ const ln=L.polyline([a,c],{color:css('--ink'),weight:4,dashArray:'1 8',lineCap:'round',opacity:.9,interactive:false}); g.addLayer(ln); b.extend(a); b.extend(c);
    if(campo&&metros(a[0],a[1],c[0],c[1])>250) rotaPe(a,c,altA,altC).then(r=>{ if(!r||planLayer!==g) return; ln.setLatLngs(r.p); creditoRota();
      if(o[campo]!==r.m){ o[campo]=r.m; if(dest&&!sel&&dest.plano&&dest.plano.ops[planoSel]===o){ const st=$('#pbody').scrollTop; verDestino(); $('#pbody').scrollTop=st; } } }); };
  caminhadas(o,O).forEach(x=>pe(x[0],x[1],x[2],x[3],x[4]));
  o.legs.forEach((q,i)=>{ const pts=fatia(q.l.shapes[q.si],q.f0,q.f1), cv=corPerna(o,i); b.extend(pts);
    // plataforma ou ponto afastado do traçado (comum no Terminal): liga o ponto ao começo e ao fim do trecho
    [[q.k0,pts[0]],[q.k1,pts[pts.length-1]]].forEach(e=>{ const c=pt(e[0]); if(metros(c[0],c[1],e[1][0],e[1][1])>25) pe(c,e[1]); });
    g.addLayer(L.polyline(pts,{color:'#ffffff',weight:13,opacity:1,interactive:false})); g.addLayer(L.polyline(pts,{color:cv,weight:7.5,opacity:1,interactive:false}));
    const bus=rtV(q.l,q.si,q.m); if(bus&&bus.ok&&rtVale()&&bus.f<q.f0-0.004){ const vem=fatia(q.l.shapes[q.si],bus.f,q.f0), tr=[vem];
      if(bus.enc&&bus.enc.f<0.996){ const ant=fatia(bus.enc.l.shapes[bus.enc.si],bus.enc.f,1); if(ant&&ant.length>1) tr.push(ant); }
      tr.forEach(pts=>{ g.addLayer(L.polyline(pts,{color:'#ffffff',weight:8,opacity:.9,interactive:false})); g.addLayer(L.polyline(pts,{color:cv,weight:4,opacity:1,dashArray:'2 9',lineCap:'round',interactive:false})); });
      if(i===0&&(q.f0-bus.f)*q.l.shapes[q.si]._c[q.l.shapes[q.si].p.length-1]<=10000){ b.extend([bus.lat,bus.lon]); comBus=true; } } });
  // os outros carros da linha que passam no ponto de embarque ANTES do ônibus da opção e que a pessoa ainda consegue pegar: tracejado mais fino, no trajeto de cada um.
  // Carro que vem atrás do ônibus da opção fica apagado e sem tracejado: o traço dele cobriria o do ônibus escolhido e seguiria além dele (linha circular, vários carros na rua).
  // Carro que passa antes de ela chegar a pé fica apagado e sem tracejado, para não parecer que é o ônibus da opção.
  if(!quando){ const q0=o.legs[0], meu=rtV(q0.l,q0.si,q0.m), cv=corPerna(o,0); rtVindo(o).forEach(x=>{ if(x.o===meu||!x.da||x.outra||x.eta>q0.t0) return; const vem=fatia(x.o.l.shapes[x.o.si],x.o.f,x.f);
      g.addLayer(L.polyline(vem,{color:'#ffffff',weight:6,opacity:.85,interactive:false})); g.addLayer(L.polyline(vem,{color:cv,weight:3,opacity:.9,dashArray:'2 8',lineCap:'round',interactive:false}));
      if(x.d<=10000){ b.extend([x.o.lat,x.o.lon]); comBus=true; } }); }
  o.legs.forEach((q,i)=>{ const cv=corPerna(o,i);
    g.addLayer(L.circleMarker(pt(q.k0),{radius:9,color:'#ffffff',weight:3,fillColor:cv,fillOpacity:1,interactive:false}).bindTooltip(q.l.id+' · '+hm(q.t0),{permanent:true,direction:'top',offset:[0,-8]}));
    if(i===o.legs.length-1) g.addLayer(L.circleMarker(pt(q.k1),{radius:8,color:cv,weight:4,fillColor:'#ffffff',fillOpacity:1,interactive:false}).bindTooltip(T('offHere')+' · '+hm(q.t1),{permanent:true,direction:'bottom',offset:[0,8]})); });
  planLayer=g.addTo(map); rtFrente(); if(enquadra) ajusta(b,comBus?(isMob()?150:205):0);
}
// sugestões para o campo "De onde você sai?": pontos turísticos e terminais, pontos de parada com nome e, depois de uma pausa, endereços e locais
let deT=null;
function buscaEnd(q){ const ck='P|'+nzq(q); if(_geo[ck]) return Promise.resolve(_geo[ck]);
  const pn=buscaNumero(q);
  return (PHOTON?buscaPhoton(q).catch(()=>buscaMapTiler(q)):buscaMapTiler(q)).catch(()=>[]).then(r=>endJunta(pn,r)).then(r=>(_geo[ck]=r)).catch(()=>[]); }
function sugereDe(v,alvo){ const para=alvo==='para', qb=para?'#plSugB':'#plSug', box=$(qb); if(!box) return; clearTimeout(deT); const q=nzq(v);
  if(q.length<3){ box.hidden=true; box.innerHTML=''; return; }
  const itens=[], vistos={};
  D.poi.forEach(p=>{ if(nzq(p.pt+' '+p.es+' '+p.en).includes(q)) itens.push({nome:p[lang],sub:'',lat:p.lat,lon:p.lon,ic:p.ic}); });
  D.stops.forEach(s=>{ if(itens.length>=6||!s.L.length||!s[2]||!nzq(s[2]).includes(q)) return; const k=nzq(s[2]); if(vistos[k]) return; vistos[k]=1; itens.push({nome:s[2],sub:semNumero(s[4]),lat:s[0],lon:s[1],ic:'P'}); });
  const mostra=(geo,carregando)=>{ const todos=itens.concat((geo||[]).map(r=>({nome:r.nome,sub:r.sub,lat:r.lat,lon:r.lon,ic:'◎'}))); box.hidden=false;
    box.innerHTML=todos.map((r,i)=>'<button class="poib" data-de="'+i+'"><span class="pin">'+r.ic+'</span><span>'+esc(r.nome)+(r.sub?'<small style="display:block;color:var(--muted)">'+esc(r.sub)+'</small>':'')+'</span></button>').join('')+
      (carregando?'<p class="note" style="margin:0 4px">'+T('geoLoad')+'</p>':(todos.length?'':'<p class="note" style="margin:0 4px">'+T('geoNone')+'</p>'));
    box.querySelectorAll('[data-de]').forEach(b=>b.onclick=()=>{ clearTimeout(deT); const r=todos[+b.dataset.de]; if(para){ destino({nome:r.nome,lat:r.lat,lon:r.lon}); return; } origM={lat:r.lat,lon:r.lon,nome:r.nome}; locErr=false; marcaPartida(); dest.plano=null; planoSel=null; verDestino(); estilo(); anuncia(T('aDe').replace('{n}',r.nome)); });
    if(!carregando) anuncia(T('aGeo').replace('{n}',todos.length)); };
  const auto=v.length>=4&&!/^\d+\s?\w?$/.test(v); mostra(null,auto);
  if(auto) deT=setTimeout(()=>buscaEnd(v).then(g=>{ const de=$(para?'#plPara':'#plDe'); if(de&&de.value.trim()===v&&$(qb)===box) mostra(g,false); }),600);
}
function marcaPartida(){ if(!map) return; if(origMarker) map.removeLayer(origMarker); origMarker=null;
  // partida escolhida no mapa: marcador que dá para arrastar; soltou, as opções de viagem são refeitas
  if(origM){ origMarker=L.marker([origM.lat,origM.lon],{icon:L.divIcon({className:'orig-ic',html:'<div class="opin"></div>',iconSize:[28,28],iconAnchor:[14,14]}),draggable:true,autoPan:true,zIndexOffset:950,keyboard:false,title:T('dragO')})
      .bindTooltip(T('dep'),{permanent:true,direction:'left',offset:[-12,0]}).addTo(map);
    origMarker.on('dragend',()=>{ const q=origMarker.getLatLng(); origM={lat:q.lat,lon:q.lng}; if(dest&&!dest.trecho&&!dest.eu){ dest.plano=null; planoSel=null; if(!sel){ const mn=$('#panel').classList.contains('min'); verDestino(); if(mn) $('#panel').classList.add('min'); estilo(); } } }); } }
function confirmaPartida(ll){
  if(pickAlvo==='para'){ escolherPartida(false); const p=pontoPerto(ll.lat,ll.lng); destino(p?{nome:nomeDoPonto(p),lat:p[0],lon:p[1],fica:true}:{nome:T('dMapP'),lat:ll.lat,lon:ll.lng,fica:true}); ajusta(); return; }
  origM={lat:ll.lat,lon:ll.lng}; locErr=false; escolherPartida(false); marcaPartida(); if(dest&&!dest.trecho&&!dest.eu){ dest.plano=null; $('#panel').classList.remove('min'); verDestino(); ajusta(); estilo(); } }
function escolherPartida(on,alvo){ if(on) pickAlvo=alvo||'de'; const para=pickAlvo==='para'; pickOrig=on; const h=$('#hint'); h.hidden=!on; $('.app').classList.toggle('picking',on); $('.app').classList.toggle('pb',on&&para); if(on){ $('#hintT').textContent=T(para?'pickHintB':'pickHint'); $('#hintOk').textContent=T(para?'pickOkB':'pickOk'); $('#hintX').textContent=T('cancel'); if(isMob()){ $('#panel').classList.add('min'); ajusta(); }
    // o alfinete fica no centro do mapa: começa de onde a pessoa já tinha escolhido ou de onde ela está, se der para saber
    if(map){ if(!map._pin){ map._pin=document.createElement('div'); map._pin.className='pickpin'; map._pin.setAttribute('aria-hidden','true'); map._pin.innerHTML='<i></i>'; map.getContainer().appendChild(map._pin); }
      const c=para?((dest&&!dest.eu&&!dest.trecho)?[dest.lat,dest.lon]:null):origM?[origM.lat,origM.lon]:loc?[loc[0],loc[1]]:null; if(c) map.setView(c,Math.max(map.getZoom(),15),{animate:false}); else if(map.getZoom()>14) map.setZoom(14,{animate:false}); } // sem ponto de partida conhecido: afasta um pouco, para a pessoa achar o lugar
    anuncia(T(para?'pickHintB':'pickHint')); }
  if(map) map.getContainer().style.cursor=on?'crosshair':''; }
$('#hintOk').onclick=()=>{ if(map&&pickOrig) confirmaPartida(map.getCenter()); };
$('#hintX').onclick=()=>{ escolherPartida(false); if(!sel&&isMob()){ $('#panel').classList.remove('min'); ajusta(); } };
$('#qPin').onclick=()=>escolherPartida(true,'para');
function detalhe(){
  const l=BYID[sel]; if(!l){ lista(); return; }
  const dias=['DU','SAB','DOM']; if(!dia||!l.dep[dia]) dia=l.dep[hoje()]?hoje():dias.find(d=>l.dep[d]);
  const ss=sentidos(l,dia); if(!ss.includes(sent)) sent=ss[0];
  const ps=passam(l); const fr={}; if(ps) ps.forEach(i=>{ fr[i]=aoLongo(l.shapes[i],trecho.lat,trecho.lon).f; });
  const of=(si,m)=>minCedo(l,l.shapes[si],dia,m,fr[si]), ofT=(si,m)=>minTarde(l,l.shapes[si],dia,m,fr[si]); const medido=!!(ps&&[...ps].some(i=>l.shapes[i].g));
  const filtra=s=>{ const aa=(l.dep[dia]||{})[s]||[], vv=(l.depV[dia]||{})[s]||[]; const r=aa.map((m,i)=>[m,i]).filter(x=>!ps||ps.has(vv[x[1]])); return ps?r.map(x=>{ const si=vv[x[1]]; let c=x[0]+of(si,x[0]), u=x[0]+ofT(si,x[0]), lv=0; const e=rtEta(rtDe(l,dia,s,x[1]),fr[si]);
      if(e){ if(e[1]<0){ u=agora()-1; c=Math.min(c,u); } else { c=e[0]; u=e[1]; lv=1; } } return [c,x[1],u,lv]; }).sort((x,y)=>x[0]-y[0]):r.map(x=>[x[0],x[1],x[0],0]); };
  if(ps&&trechoNovo&&!filtra(sent).length){ const o=ss.find(s=>filtra(s).length); if(o) sent=o; }
  trechoNovo=false;
  const a=(l.dep[dia]||{})[sent]||[]; const ehHoje=dia===hoje(); const t=agora();
  const F=filtra(sent); const am=F.map(x=>x[0]);
  const PX=ehHoje?F.filter(x=>x[2]>=t).slice(0,3):[]; const prox=PX.map(x=>x[0]); const iv=intervalo(am); // um ônibus só sai de "próxima passagem" depois do horário tarde
  const lab=s=>l.ttu?(s==='T'?T(INI_T[l.id]||'fromT'):T('fromB')):(s==='T'?T('fromA'):T('fromV'));
  const vs=(l.depV[dia]||{})[sent]||[]; if(viagem!=null){ if(viagem>=a.length) viagem=null; }
  const nxt=prox[0];
  // Quadro no formato de lista: cada horário escrito por inteiro (05:50, 06:20…), como o público está acostumado.
  // Trajetos deste sentido e dia: o que tem mais viagens é o principal (sem letra); os outros (extensões, variantes) ganham uma letra
  // ao lado do horário e entram na legenda abaixo do quadro.
  const MV=marcasVar(l,dia,sent);
  const nIdas=(ehHoje&&nxt!=null)?F.filter(x=>x[2]<t).length:0;
  const tt=F.filter(x=>verPassados||!nIdas||x[2]>=t).map(([m,i,u])=>{ const mk=MV.m[vs[i]]||'';
    return '<button class="tm'+(ehHoje&&u<t?' past':'')+(m===nxt?' nxt':'')+'" data-i="'+i+'" aria-pressed="'+(i===viagem)+'" style="--lc:'+l.bgc+';--li:'+l.ink+'" aria-label="'+hm(m)+(mk?', '+esc(trajetoVar(l,vs[i])):'')+'">'+hm(m)+(MV.ast[vs[i]]?'*':'')+(mk?(MV.sig?'<small>'+esc(mk)+'</small>':'<sup>'+mk+'</sup>'):'')+'</button>'; }).join('');
  const legV=MV.leg.length?'<ul class="vleg'+(MV.sig&&!(SIG_LINHA[l.id]||{}).txt?' sig':'')+'">'+MV.leg.map(g=>'<li><b>'+esc(g[0])+'</b> '+esc(g[1])+'</li>').join('')+'</ul>':'';
  let pm=null; if(loc&&!trecho){ l.shapes.forEach(s=>{ if(!s.main) return; const r=pertoDe(s.p,loc[0],loc[1]); if(!pm||r.d<pm.d) pm=r; }); if(pm&&pm.d>600) pm=null; }
  const lb=$('#linebar'); lb.hidden=false;
  lb.innerHTML='<button class="back" id="back">'+T('back')+'</button><span class="badge" style="'+bg(l)+'">'+l.id+'</span><h2>'+l.nome+'</h2><button class="vmap sheetbtn" id="btnSheet"></button>';
  const tb=$('#tripbar'); tb.hidden=viagem==null;
  tb.style.borderColor=l.cor;
  tb.innerHTML=viagem!=null?'<div><b>'+((ps&&ps.has(vs[viagem]))?T('tripHere').replace('{h}',hm(a[viagem])).replace('{p}',hm(a[viagem]+of(vs[viagem],a[viagem]))):T('trip').replace('{h}',hm(a[viagem])))+'</b><div class="note">'+T('route')+': '+esc(trajetoVar(l,vs[viagem]))+'</div></div><button class="vmap" id="tripclr">'+T('alltr')+'</button>':'';
  const tr=$('#trechobar'); tr.hidden=!trecho;
  if(trecho){ const outras=D.linhas.filter(x=>x.id!==l.id&&passam(x).size);
    tr.innerHTML='<div class="hd"><b>'+T('stretch')+'</b><button class="vmap" id="trclr">'+T('allTimes')+'</button></div>'+(F.length&&F.length>=a.length?'':'<div class="note xtra">'+(F.length?T('stretchN').replace('{n}',F.length).replace('{t}',a.length):T(ss.some(s=>filtra(s).length)?'stretch0s':'stretch0'))+'</div>')+
      (outras.length?'<div class="xtra"><span class="note">'+T('also')+'</span><div class="mchips">'+outras.map(x=>chip(x.id)).join('')+'</div></div>':''); }
  $('#pbody').innerHTML='<div class="detail">'+
    '<div class="seg" role="group" aria-label="'+T('dayG')+'">'+dias.map(d=>'<button data-d="'+d+'" aria-pressed="'+(d===dia)+'" '+(l.dep[d]?'':'disabled')+'>'+T(d.toLowerCase())+(d===hoje()?' · '+T('today'):'')+'</button>').join('')+'</div>'+
    (ss.length>1?'<div class="seg" role="group" aria-label="'+T('dirG')+'">'+ss.map(s=>'<button data-s="'+s+'" aria-pressed="'+(s===sent)+'">'+lab(s)+'</button>').join('')+'</div>':'<div class="note">'+lab(sent)+'</div>')+
    (ehHoje?'<div class="nextcard" style="border-color:'+l.cor+'"><div class="label">'+T(ps?'nextHere':'next')+(ps&&PX[0]&&PX[0][3]?'<span class="tag vv">'+T('live')+'</span>':'<span class="tag">'+T(ps?'tagEst':'tagProg')+'</span>')+'</div>'+
      (prox.length?'<div class="nbig"><b>'+hm(prox[0])+'</b><span>'+(prox[0]-t<=0?T('now'):prox[0]-t>90?'':T('inmin').replace('{n}',prox[0]-t))+'</span></div><div class="ndir">'+rotSent(l,sent)+'</div>'+(prox.length>1?'<div class="nnext">'+T('then')+': '+prox.slice(1).map(hm).join(' · ')+'</div>':''):'<div class="note">'+T('nomore')+'</div>')+'</div>':'')+
    (am.length?'<div class="svc">'+T('svc').replace('{a}','<b>'+hm(am[0])+'</b>').replace('{b}','<b>'+hm(am[am.length-1])+'</b>')+(iv&&iv<=120?' · '+T('every').replace('{n}',iv):'')+'</div>':'')+
    (pm?'<button class="nearme" id="nearme">'+T('nearMe')+' ('+T('at').replace('{n}',Math.round(pm.d/10)*10)+')</button>':'')+
    (viagem==null?'<p class="note" style="margin:0">'+T('tip')+'</p>':'')+
    '<div><div class="label">'+T(ps?'ttHere':'timetable')+' · '+F.length+' '+T('trips')+'</div>'+(nIdas?'<button class="vmap" id="btnPass" style="margin-top:6px">'+(verPassados?T('hidePast'):T('showPast').replace('{n}',nIdas))+'</button>':'')+(tt?'<div class="tg'+(MV.sig?' sig':'')+'" style="margin-top:6px">'+tt+'</div>'+legV:'<div class="note" style="padding:10px">'+T(ps?'stretch0s':'none')+'</div>')+
      (a.length||ss.length?'<div class="optb" style="margin-top:8px"><button class="vmap" id="expImg">'+T('expImg')+'</button></div>':'')+'</div>'+
    '<p class="note">'+(ps&&F.length?T(medido?'stretchG':'stretchH')+' ':'')+T('variants')+' '+T('disc')+'</p></div>';
  $('#back').onclick=()=>selecionar(null);
  $('#btnSheet').onclick=()=>{ $('#panel').classList.toggle('min'); sheetTxt(); ajusta(); };
  sheetTxt();
  $('#pbody').querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{dia=b.dataset.d;mostrarViagem(null);});
  $('#pbody').querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{sent=b.dataset.s;mostrarViagem(null);});
  $('#pbody').querySelectorAll('.tm').forEach(b=>b.onclick=()=>mostrarViagem(+b.dataset.i===viagem?null:+b.dataset.i));
  const bp=$('#btnPass'); if(bp) bp.onclick=()=>{ verPassados=!verPassados; const st=$('#pbody').scrollTop; detalhe(); $('#pbody').scrollTop=st; };
  const tc=$('#tripclr'); if(tc) tc.onclick=()=>mostrarViagem(null);
  const ei=$('#expImg'); if(ei) ei.onclick=()=>exportaHorario(ei,sel,dia);
  const nm=$('#nearme'); if(nm) nm.onclick=()=>{ viagem=null; if(tripLayer&&map){ map.removeLayer(tripLayer); tripLayer=null; } setTrecho(pm); detalhe(); $('#pbody').scrollTop=0; if(map){ map.setView([pm.lat,pm.lon],Math.max(map.getZoom(),15)); estilo(); } };
  const tx=$('#trclr'); if(tx) tx.onclick=()=>{ setTrecho(null); mostrarViagem(null); };
  $('#trechobar').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>selecionar(b.dataset.go,false,true));
}
const variantLabels = window.createVariantLabels({ D, T, TTU, metros });
const { SIG_LINHA, LINHAS_SIGLA, INI_T, codigosVar, rotSigla, txtSigla, nomeVar, marcasVar, trajetoVar } = variantLabels;
const scheduleExport = window.createScheduleExport({ BYID, LINHAS_SIGLA, SIG_LINHA, INI_T, T, D, css, sentidos, hm, marcasVar, trajetoVar, isMob, anuncia });
const { desenhaHorario, exportaHorario } = scheduleExport;
function sheetTxt(){ const b=$('#btnSheet'); if(b) b.textContent=$('#panel').classList.contains('min')?T('vtt'):T('vmapS'); }
function mostrarViagem(i){
  viagem=i; if(i!=null) setTimeout(()=>{ const tb=$('#tripbar'); if(tb&&!tb.hidden) anuncia(tb.querySelector('b').textContent); },0); const st=$('#pbody').scrollTop;
  if(tripLayer){ if(map) map.removeLayer(tripLayer); tripLayer=null; }
  if(i!=null&&isMob()) $('#panel').classList.add('min');
  detalhe(); $('#pbody').scrollTop=st;
  if(map){
    map.invalidateSize({animate:false});
    if(viagem!=null){
      const l=BYID[sel]; const s=l.shapes[l.depV[dia][sent][viagem]]; const cv=escurecer(l.cor,escuro()?0:.35);
      tripLayer=L.layerGroup([
        L.polyline(s.p,{color:'#ffffff',weight:13,opacity:1,interactive:false}),
        L.polyline(s.p,{color:cv,weight:7.5,opacity:1,interactive:false}),
        L.circleMarker(s.p[0],{radius:9,color:'#ffffff',weight:3,fillColor:cv,fillOpacity:1,interactive:false}).bindTooltip(T('start')+' '+hm(l.dep[dia][sent][viagem]),{permanent:true,direction:'top',offset:[0,-8]}),
        L.circleMarker(s.p[s.p.length-1],{radius:8,color:cv,weight:4,fillColor:'#ffffff',fillOpacity:1,interactive:false}).bindTooltip(T('end'),{permanent:true,direction:'bottom',offset:[0,8]})
      ]).addTo(map);
      ajusta(L.latLngBounds(s.p));
    }
    estilo();
  }
}
function selecionar(id,semHist,manter,sentIni){
  const antes=sel;
  sel=id&&BYID[id]?id:null; dia=null; sent=sentIni||'T'; viagem=null; verPassados=false;
  if(!manter&&!(dest&&dest.trecho)) setTrecho(null); else if(trecho) trechoNovo=true;
  extras(); if(sel) desenhaPlano(false);
  if(tripLayer){ if(map) map.removeLayer(tripLayer); tripLayer=null; }
  $('#panel').classList.remove('min'); $('.app').classList.toggle('has-sel',!!sel||!!dest);
  if(sel){ detalhe(); $('#pbody').scrollTop=0; if(map){ const b=L.latLngBounds([]); BYID[sel].shapes.filter(s=>s.main).forEach(s=>b.extend(s.p)); if(trecho) ajusta(); else ajusta(b); } }
  else if(dest){ verDestino(); ajusta(); if(map&&!dest.trecho){ if(planoSel!=null) desenhaPlano(true); else map.setView([dest.lat,dest.lon],15); } }
  else { lista(); ajusta(); }
  if(map) estilo();
  // leitor de tela e teclado: anuncia o que abriu e leva o foco para o lugar certo
  if(sel){ const l=BYID[sel]; const pr=dia===hoje()?proximas(l,dia,sent,1)[0]:null;
    anuncia(T('aLinha').replace('{id}',l.id).replace('{n}',l.nome)+(dia===hoje()?' '+(pr!=null?T('aProx').replace('{h}',hm(pr)):T('aSem')):''));
    if(tecl){ const b=$('#back'); if(b) b.focus({preventScroll:true}); } }
  else if(dest){ if(tecl){ const b=$('#back'); if(b) b.focus({preventScroll:true}); } }
  else { anuncia(T('aLista')); if(tecl&&antes){ const b=$('#pbody').querySelector('.lmain[data-id="'+antes+'"]'); if(b) b.focus(); } }
  const bm=$('#btnBackMap'); bm.hidden=!sel; if(sel) bm.textContent=T('backAll')+' · '+sel;
  if(!semHist){ const alvo=sel?'#L'+sel:'#'; try{ if(sel) history.pushState({l:sel},'',alvo); else history.replaceState(null,'',alvo); }catch(e){ try{ if(sel) history.pushState({l:sel},''); else history.replaceState(null,''); }catch(e2){} } }
}
// ── eventos ──
$('#q').addEventListener('input',()=>{ agendaGeo($('#q').value.trim()); if(sel||dest){ limpaDestino(); selecionar(null); } else lista(); });
$('#q').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const v=$('#q').value.trim(); if(v.length>=3){ e.preventDefault(); if(!(geoQ===v&&geoSt==='ok')) geocode(v); $('#q').blur(); } } });
document.querySelectorAll('.lang button').forEach(b=>b.addEventListener('click',()=>{ lang=b.dataset.l; try{sessionStorage.setItem('mapa_lang',lang);}catch(e){} textos(); sel?detalhe():dest?verDestino():lista(); }));
$('#btnAll').onclick=()=>{ limpaDestino(); selecionar(null); if(map) map.fitBounds(map._all,{padding:[20,20]}); };
// Pede a localização. Enquanto o aparelho responde (pode levar alguns segundos), os botões de localização mostram "Localizando…"
// e ficam travados; se falhar, mostram o motivo por uns segundos.
let locOcupado=false;
function localizar(ok,erro){
  if(locOcupado) return; locOcupado=true;
  const bts=['#btnLoc','#btnNear','#plLoc','#plLoc0','#plLocB'].map(q=>$(q)).filter(Boolean), txt=bts.map(b=>b.textContent), ic=b=>b.classList.contains('depin'); // botão de ícone: só fica ocupado, sem trocar o texto
  bts.forEach(b=>{ if(!ic(b)) b.textContent=T('locating'); b.disabled=true; b.setAttribute('aria-busy','true'); }); anuncia(T('locating'));
  const solta=msg=>{ locOcupado=false; bts.forEach((b,i)=>{ b.disabled=false; b.removeAttribute('aria-busy'); if(ic(b)) return; b.textContent=msg||txt[i]; if(msg) setTimeout(()=>{ if(b.textContent===msg) b.textContent=txt[i]; },3500); }); };
  const falha=err=>{ const m=T(err&&err.code===1?'locDenied':'noloc'); solta(m); anuncia(m); if(erro) erro(); };
  if(!navigator.geolocation||!map) return falha();
  try{ navigator.geolocation.getCurrentPosition(p=>{ const ll=[p.coords.latitude,p.coords.longitude]; loc=ll; solta(); anuncia(T('aLoc'));
    if(locMarker) map.removeLayer(locMarker);
    locMarker=L.circleMarker(ll,{radius:8,color:'#fff',weight:3,fillColor:css('--accent'),fillOpacity:1,interactive:false}).addTo(map);
    ok(ll); },falha,{enableHighAccuracy:true,timeout:8000}); }catch(e){ falha(); }
}
$('#btnLoc').onclick=()=>localizar(ll=>{
  if(sel){ const st=$('#pbody').scrollTop; detalhe(); $('#pbody').scrollTop=st; map.setView(ll,16); }
  else if(dest&&!dest.eu&&!dest.trecho){ origM=null; marcaPartida(); locErr=false; verDestino(); estilo(); } // com destino aberto: a localização vira a partida
  else destino({nome:T('nearYou'),lat:ll[0],lon:ll[1],eu:true}); });
$('#btnLeg').onclick=()=>legenda($('#legend').hidden);
$('#btnBase').onclick=()=>{ nextBase(); if(map) setTiles(); textos(); };
// barrinha do painel no celular: toque alterna recolhido/aberto; arrastar leva o painel junto do dedo e, ao soltar, encaixa em
// recolhido (mapa quase inteiro), meio (como abre) ou alto (painel ocupando quase a tela)
let barraArr=false;
$('#sheetbar').onclick=()=>{ if(barraArr) return; const p=$('#panel'); if(p.classList.contains('alto')&&!p.classList.contains('min')) p.classList.remove('alto'); else p.classList.toggle('min'); sheetTxt(); ajusta(); };
(function(){ const bar=$('#sheetbar'), pn=$('#panel'); let y0=null, h0=0, mov=false, pid=null;
  const altApp=()=>$('.app').getBoundingClientRect().height;
  bar.addEventListener('pointerdown',e=>{ if(!isMob()||(e.pointerType==='mouse'&&e.button!==0)) return; y0=e.clientY; h0=pn.getBoundingClientRect().height; mov=false; pid=e.pointerId; try{ bar.setPointerCapture(pid); }catch(_){} });
  bar.addEventListener('pointermove',e=>{ if(y0==null) return; const dy=e.clientY-y0; if(!mov&&Math.abs(dy)<8) return;
    if(!mov){ mov=true; pn.classList.add('arr'); pn.classList.remove('min'); }
    const H=altApp(); pn.style.height=Math.max(54,Math.min(H*0.9,h0-dy))+'px'; e.preventDefault(); });
  const solta=()=>{ if(y0==null) return; const era=mov; y0=null; mov=false; try{ bar.releasePointerCapture(pid); }catch(_){}
    if(!era) return; // foi só um toque: o clique cuida
    const f=pn.getBoundingClientRect().height/altApp(); pn.style.height=''; pn.classList.remove('arr');
    pn.classList.toggle('min',f<0.3); pn.classList.toggle('alto',f>=0.72); sheetTxt(); ajusta();
    barraArr=true; setTimeout(()=>{ barraArr=false; },350); };
  bar.addEventListener('pointerup',solta); bar.addEventListener('pointercancel',solta);
})();
$('#btnFull').onclick=()=>{ $('.app').classList.toggle('full'); textos(); if(map) setTimeout(()=>map.invalidateSize(),60); };
const mq=matchMedia('(prefers-color-scheme: dark)'); const retema=()=>{ colorize(); if(map){ setTiles(); D.linhas.forEach(l=>(l._lines||[]).forEach(o=>{o.line.setStyle({color:l.cor});o.casing.setStyle({color:css('--casing')});})); estilo(); } sel?detalhe():dest?verDestino():lista(); };
if(mq.addEventListener) mq.addEventListener('change',retema);
new MutationObserver(retema).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
window.__fz={buscaNumero,rtAplica,get rt(){return RT;},get rtQuer(){return rtQuer();},get map(){return map;},get estado(){return {sel,dia,sent,viagem,trecho,dest,planoSel,origM};},planejar,candidatos,trocas,pontosDoTrajeto,destino,setOrigem(o){ origM=o; marcaPartida(); if(dest&&!sel) verDestino(); }};
// ── início ──
textos(); initMap();
const h=(location.hash||'').match(/^#L([\w]+)$/); selecionar(h&&BYID[h[1]]?h[1]:null,true);
$('#btnBackMap').onclick=()=>selecionar(null);
// prepara aos poucos, em segundo plano, a lista de pontos de cada trajeto, para a primeira busca de viagem sair rápida
(function aquece(i){ setTimeout(()=>{ if(i>=D.linhas.length) return; const l=D.linhas[i], dk=hoje(); l.shapes.forEach((q,si)=>{ if(viagensShape(l,si,dk).length) pontosDoTrajeto(l,si); }); aquece(i+1); },i?40:1500); })(0);
if(FE){ $('#btnFs').hidden=false; $('#btnFs').onclick=telaCheia; textos(); }
// botão Voltar do navegador/celular fecha a linha aberta
window.addEventListener('popstate',e=>{ const m=(location.hash||'').match(/^#L([\w]+)$/); const id=(m&&m[1])||(e.state&&e.state.l)||null; selecionar(id&&BYID[id]?id:null,true); });
rtBusca(); document.addEventListener('visibilitychange',()=>{ if(!document.hidden) rtBusca(); });
setInterval(()=>{ if(sel&&dia===hoje()){ const st=$('#pbody').scrollTop; detalhe(); $('#pbody').scrollTop=st; }
  else if(!sel&&dest&&!dest.trecho&&!dest.eu&&planoSel==null&&origem()&&!pickOrig&&!digitando()){ const st=$('#pbody').scrollTop; verDestino(); $('#pbody').scrollTop=st; } },60000);
}
