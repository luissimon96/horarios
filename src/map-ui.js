window.createMapUI = function (context) {
  const { D, $, css, T, BYID, bg, fam, passagens, hoje, hm, semNumero, escapeHtml, getViagensShape, viagensTrecho, distLinha, passam, fatia, corPerna, isMob, textos, rtFrente, rtDesenha, cliqueMapa, destino, verViagemOnibus, limpaDestino, setTrecho, selecionar, anuncia } = context;
  const esc = escapeHtml;
  const viagensShape = (...args) => getViagensShape(...args);
  let tileLayer = null;

// Ponto de parada desenhado como uma plaquinha com um ônibus (direto no canvas do mapa, para mais de mil pontos não pesarem no celular).
// Longe (zoom menor que 15) vira só uma bolinha; o tamanho cresce ao aproximar. opções: cor (ônibus e borda) e fundo (placa).
const PontoBus=window.L?L.CircleMarker.extend({
  _updatePath(){ const r=this._renderer, c=r&&r._ctx; if(!c){ L.CircleMarker.prototype._updatePath.call(this); return; } if(this._empty()) return;
    const p=this._point, z=this._map.getZoom(), cor=this.options.cor, fundo=this.options.fundo;
    const rr=(x,y,w,h,q)=>{ c.beginPath(); if(c.roundRect) c.roundRect(x,y,w,h,q); else { c.moveTo(x+q,y); c.arcTo(x+w,y,x+w,y+h,q); c.arcTo(x+w,y+h,x,y+h,q); c.arcTo(x,y+h,x,y,q); c.arcTo(x,y,x+w,y,q); c.closePath(); } };
    c.save(); c.translate(p.x,p.y); c.globalAlpha=1;
    if(z<15){ c.beginPath(); c.arc(0,0,4.5,0,Math.PI*2); c.fillStyle=fundo; c.fill(); c.lineWidth=2.5; c.strokeStyle=cor; c.stroke(); c.restore(); return; }
    const s=z>=17?9.5:z>=16?8:6.5;
    rr(-s,-s,2*s,2*s,s*0.42); c.fillStyle=fundo; c.fill(); c.lineWidth=1.6; c.strokeStyle=cor; c.stroke();            // placa
    const w=s*1.16, h=s*1.22, y0=-h/2-s*0.06;
    c.fillStyle=cor; c.fillRect(-w/2+s*0.1,y0+h-s*0.04,s*0.26,s*0.2); c.fillRect(w/2-s*0.36,y0+h-s*0.04,s*0.26,s*0.2);  // rodas
    rr(-w/2,y0,w,h,s*0.22); c.fill();                                                                                    // corpo
    c.fillStyle=fundo; rr(-w/2+s*0.14,y0+s*0.14,w-s*0.28,h*0.42,s*0.1); c.fill();                                        // para-brisa
    c.beginPath(); c.arc(-w*0.28,y0+h*0.78,s*0.1,0,Math.PI*2); c.arc(w*0.28,y0+h*0.78,s*0.1,0,Math.PI*2); c.fill();      // faróis
    c.restore(); }
}):null;
const pontoBus=(ll,cor)=>new PontoBus(ll,{radius:10,weight:2,cor:cor,fundo:'#ffffff',bubblingMouseEvents:false});
function initMap(){
  if(!window.L){ $('#map').innerHTML='<p style="padding:20px">Mapa indisponível.</p>'; return; }
  context.state.map=L.map('map',{zoomControl:false,preferCanvas:true,attributionControl:true,zoomSnap:0.25}).setView([-25.53,-54.56],12);
  context.state.map.attributionControl.setPrefix(false); // créditos curtos: no celular a linha quebrava em duas
  L.control.zoom({position:'bottomright'}).addTo(context.state.map);
  setTiles();
  D.linhas.slice().sort((a,b)=>(b.esc-a.esc)).forEach(l=>{
    const g=L.layerGroup();
    l.shapes.filter(s=>s.main).forEach((s,i)=>{ const si=l.shapes.indexOf(s);
      const casing=L.polyline(s.p,{color:css('--casing'),weight:i?4.5:7,opacity:.95,interactive:false});
      const line=L.polyline(s.p,{color:l.cor,weight:i?2:4,opacity:.9});
      line.bindTooltip(l.id+' · '+l.nome,{sticky:true});
      g.addLayer(casing); g.addLayer(line); (l._lines=l._lines||[]).push({casing,line,i,si});
    });
    context.state.layers[l.id]=g; g.addTo(context.state.map);
  });
  const b=L.latLngBounds([]); D.linhas.forEach(l=>l.shapes.filter(s=>s.main).forEach(s=>b.extend(s.p))); context.state.map._all=b; context.state.map.fitBounds(b,{padding:[20,20]});
  // pontos turísticos
  D.poi.forEach(p=>{
    const m=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'poi-ic',html:'<div class="pin">'+p.ic+'</div>',iconSize:[28,28],iconAnchor:[14,14]}),zIndexOffset:500});
    m.bindPopup(()=>popupPoi(p)); m.addTo(context.state.map); p._m=m;
  });
  // pontos de parada (aparecem com zoom)
  context.state.stopLayer=L.layerGroup();
  D.stops.forEach(s=>{
    const c=pontoBus([s[0],s[1]],'#12325b');
    c.bindPopup(()=>popupStop(s),{minWidth:236,maxWidth:300}); c._ponto=1; s._m=c;
    context.state.stopLayer.addLayer(c);
  });
  context.state.map.on('moveend',setas);
  context.state.map.on('click',e=>cliqueMapa(e.latlng));
  context.state.map.on('popupopen',()=>$('.app').classList.add('balao')); context.state.map.on('popupclose',()=>$('.app').classList.remove('balao'));
  if(window.ResizeObserver){ new ResizeObserver(()=>context.state.map.invalidateSize({animate:false})).observe($('#map')); }
  context.state.map.on('zoomend',()=>{ if(context.state.map.getZoom()>=15){ if(!context.state.map.hasLayer(context.state.stopLayer)) context.state.stopLayer.addTo(context.state.map);} else context.state.map.removeLayer(context.state.stopLayer); });
  context.state.map.on('zoomend',pontosDaLinha);
  context.state.map.on('popupopen',e=>{ const el=e.popup.getElement();
    el.querySelectorAll('[data-dest]').forEach(b=>b.addEventListener('click',()=>{ context.state.map.closePopup(); const q=D.poi.find(x=>x.k===b.dataset.dest); destino({nome:q[context.state.lang],lat:q.lat,lon:q.lon}); }));
    el.querySelectorAll('[data-dst]').forEach(b=>b.addEventListener('click',()=>{ context.state.map.closePopup(); const q=D.stops[+b.dataset.dst]; destino({nome:q[2]||semNumero(q[4])||T('stop'),lat:q[0],lon:q[1]}); }));
    el.querySelectorAll('[data-trip]').forEach(b=>b.addEventListener('click',()=>{ const q=b.dataset.trip.split('|'); context.state.map.closePopup(); verViagemOnibus(q[0],q[1],+q[2]); }));
    el.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{ context.state.map.closePopup();
    if(b.dataset.pt){ const q=b.dataset.pt.split(','); limpaDestino(); setTrecho({lat:+q[0],lon:+q[1]}); selecionar(b.dataset.go,false,true,b.dataset.s||null); } // veio de um ponto de parada: abre a linha já com os horários naquele ponto
    else selecionar(b.dataset.go); })); });
}
function escuro(){ const t=document.documentElement.getAttribute('data-theme'); return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches; }
// Fundos de mapa. 'cor' = MapTiler Streets (hidrografia, parques, ruas coloridas).
// CHAVE MAPTILER: troque aqui se gerar outra chave. Se a chave falhar ou a cota acabar, o mapa cai sozinho no OpenStreetMap.
const MT_KEY='8Zh9UBxiKf2BpwWOJuCN';
const MT_ESTILO='streets-v2'; // outros: bright-v2, basic-v2, outdoor-v2, topo-v2
const OSM={url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',opt:{maxZoom:19,attribution:'© OpenStreetMap'}};
const BASES={
  cor:{mt:1,url:'https://api.maptiler.com/maps/'+MT_ESTILO+'/{z}/{x}/{y}.png?key='+MT_KEY,opt:{tileSize:512,zoomOffset:-1,minZoom:1,maxZoom:20,attribution:'<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>'}},
  sat:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',opt:{maxZoom:19,attribution:'Imagens © Esri'}}
};
let mtFalhou=false;
let base='cor'; try{ const s=localStorage.getItem('mapa_base'); if(s){ if(BASES[s]) base=s; } }catch(e){}
function setTiles(){
  if(tileLayer) context.state.map.removeLayer(tileLayer);
  let b=BASES[base]; if(b.mt&&(mtFalhou||!MT_KEY)) b=OSM;
  tileLayer=L.tileLayer(b.url,b.opt).addTo(context.state.map); tileLayer.bringToBack();
  if(!window._mtc){ const c=L.control({position:'bottomleft'}); c.onAdd=()=>{ const a=L.DomUtil.create('a'); a.id='mtlogo'; a.href='https://www.maptiler.com'; a.target='_blank'; a.rel='noopener'; const im=L.DomUtil.create('img','',a); im.src='https://api.maptiler.com/resources/logo.svg'; im.alt='MapTiler'; return a; }; c.addTo(context.state.map); window._mtc=c; }
  const lg=document.getElementById('mtlogo'); if(lg) lg.hidden=!b.mt;
  if(b.mt){ let ok=0,er=0; tileLayer.on('tileload',()=>{ok++;}); tileLayer.on('tileerror',()=>{ er++; if(!ok&&er>=3&&!mtFalhou){ mtFalhou=true; setTiles(); } }); }
}
const chip = id => '<button class="badge" data-go="'+id+'" style="'+bg(BYID[id])+';font-size:14px;min-width:0">'+id+'</button>';
const rotSent=(l,k)=>l.ttu?(k==='T'?T('toB'):T('toT')):(k==='T'?T('toA'):T('toV'));
// balão do ponto de parada: linhas que passam, sentido e próxima passagem estimada
function popupStop(s){
  const dk=hoje(), linhas=[];
  s.L.forEach(o=>{ const l=BYID[o.id]; const ps=passagens(l,dk,s[0],s[1],45); const ks=o.s?[o.s]:['T','B'].filter(k=>(l.dep[dk]||{})[k]);
    ks.forEach(k=>linhas.push({l,k,t:ps[k]!=null?ps[k]:null,v:!!(ps.v&&ps.v[k])})); });
  linhas.sort((a,b)=>(a.t==null)-(b.t==null)||(a.t||0)-(b.t||0));
  const tem=linhas.some(x=>x.t!=null);
  const rows=linhas.filter(x=>x.t!=null||!tem).map(x=>'<button class="prow" data-go="'+x.l.id+'" data-s="'+x.k+'" data-pt="'+s[0]+','+s[1]+'"><span class="badge" style="'+bg(x.l)+'">'+x.l.id+'</span><span>'+rotSent(x.l,x.k)+'</span><b'+(x.v?' class="vivo"':'')+'>'+(x.v?'<span class="sr">'+T('live')+' </span>':'')+(x.t!=null?'≈ '+hm(x.t):'')+'</b></button>').join('');
  const titulo=s[2]||semNumero(s[4])||T('stop');
  return '<b>'+esc(titulo)+'</b>'+(s[2]&&s[4]?'<div class="note">'+esc(semNumero(s[4]))+'</div>':'')+
    (tem?'':'<div class="note" style="margin-top:6px">'+T('stopNone')+'</div>')+
    '<div class="plist">'+rows+'</div><div class="note" style="margin-bottom:8px">'+(linhas.some(x=>x.v)?T('liveNote')+' ':'')+T('stopTip')+'</div>'+
    '<button class="walk" data-dst="'+D.stops.indexOf(s)+'">'+T('go')+'</button><a class="walk" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+s[0]+','+s[1]+'&travelmode=walking">'+T('walk')+'</a>';
}
// com uma linha aberta, mostra os pontos dela no sentido escolhido (a partir de um zoom médio)
let lineStops=null;
function pontosDaLinha(){
  if(!context.state.map) return; if(lineStops){ context.state.map.removeLayer(lineStops); lineStops=null; }
  if(!context.state.sel||context.state.map.getZoom()<13) return; const l=BYID[context.state.sel]; const g=L.layerGroup();
  D.stops.forEach(s=>{ if(!s.L.some(o=>o.id===context.state.sel&&(!o.s||o.s===context.state.sent))) return;
    const c=pontoBus([s[0],s[1]],escurecer(l.cor,.3));
    c.bindPopup(()=>popupStop(s),{minWidth:236,maxWidth:300}); c._ponto=1; g.addLayer(c); });
  lineStops=g.addTo(context.state.map); rtFrente();
}
function popupPoi(p){ return '<b>'+p[context.state.lang]+'</b><div class="note" style="margin-top:4px">'+(p.nota?T('near'):T('lines'))+'</div><div class="mchips">'+(p.linhas.map(chip).join('')||'—')+'</div><div style="margin-top:8px"><button class="walk" data-dest="'+p.k+'">'+T('go')+'</button></div>'; }
// trajetos do sentido escolhido (dia + sentido do painel): quais shapes e qual é o principal
function dirInfo(l){
  const v=((l.depV[context.state.dia]||{})[context.state.sent])||[]; const c={}; v.forEach(i=>{c[i]=(c[i]||0)+1;});
  let set=new Set(v); const ps=passam(l); if(ps){ const f=new Set([...set].filter(i=>ps.has(i))); if(f.size) set=f; }
  let top=null, mx=-1; set.forEach(i=>{ const w=c[i]+(l.shapes[i].main?0.5:0); if(w>mx){ mx=w; top=i; } });
  if(top==null){ set=new Set(l.shapes.map((s,i)=>i).filter(i=>l.shapes[i].main)); top=l.shapes.findIndex(s=>s.main); }
  return {set,top};
}
// com uma opção de viagem desenhada, as linhas saem do mapa (ficam só os dois ônibus da viagem); voltam ao fechar a opção
let ocultas=false;
function ocultaLinhas(on){
  if(!context.state.map||on===ocultas) return; ocultas=on;
  D.linhas.slice().sort((a,b)=>(b.esc-a.esc)).forEach(l=>{ const g=context.state.layers[l.id]; if(on){ if(context.state.map.hasLayer(g)) context.state.map.removeLayer(g); } else if(!context.state.map.hasLayer(g)) g.addTo(context.state.map); });
  if(!on){ if(context.state.stopLayer&&context.state.map.hasLayer(context.state.stopLayer)){ context.state.map.removeLayer(context.state.stopLayer); context.state.stopLayer.addTo(context.state.map); }
    [context.state.locMarker,context.state.origMarker].forEach(m=>{ if(m&&m.bringToFront&&context.state.map.hasLayer(m)) m.bringToFront(); }); }
}
function estilo(){
  ocultaLinhas(!context.state.sel&&!!context.state.dest&&context.state.planoSel!=null);
  const tq=context.state.viagem!=null; const di=context.state.sel?dirInfo(BYID[context.state.sel]):null;
  const perto=(context.state.dest&&!context.state.sel)?new Set(context.state.planoSel!=null?[]:context.state.dest.ids):null;
  D.linhas.forEach(l=>{ const s=context.state.sel===l.id, on=context.state.sel?s:(perto?perto.has(l.id):true);
    (s?(l._lines||[]).concat(l._extra||[]):(l._lines||[])).forEach(o=>{
      if(s){
        const ind=di.set.has(o.si), tp=o.si===di.top;
        if(tq){ o.line.setStyle({opacity:o.x?0:.22,weight:tp?3.5:2,dashArray:tp?null:'6 7'}); o.casing.setStyle({opacity:0}); }
        else { o.line.setStyle({opacity:ind?1:(o.x?0:.2),weight:tp?6.5:ind?3.5:2,dashArray:ind&&!tp?'6 7':null}); o.casing.setStyle({opacity:ind?.95:0,weight:tp?10.5:6}); }
      } else {
        o.line.setStyle({opacity:on?.9:(tq?(o.i?0:.07):.1),weight:o.i?2:4,dashArray:null});
        o.casing.setStyle({opacity:on?.95:0,weight:o.i?4.5:7});
      }
    });
  });
  if(context.state.sel){ const ls=(BYID[context.state.sel]._lines||[]).concat(BYID[context.state.sel]._extra||[]); const ord=o=>o.si===di.top?2:di.set.has(o.si)?1:0;
    ls.slice().sort((a,b)=>ord(a)-ord(b)).forEach(o=>{ if(ord(o)){ o.casing.bringToFront(); } o.line.bringToFront(); });
    ls.filter(o=>o.si===di.top).forEach(o=>{ o.casing.bringToFront(); o.line.bringToFront(); }); }
  if(context.state.tripLayer){ context.state.tripLayer.eachLayer(x=>{ if(x.bringToFront) x.bringToFront(); }); }
  if(context.state.planLayer){ context.state.planLayer.eachLayer(x=>{ if(x.bringToFront) x.bringToFront(); }); }
  pontosDaLinha();
  if(context.state.trechoMarker) context.state.trechoMarker.bringToFront();
  setas();
  rtDesenha();
}
// setas de sentido ao longo do trajeto (linha aberta: sentido escolhido; horário escolhido: aquela viagem)
function setas(){
  if(!context.state.map) return;
  if(context.state.arrowLayer){ context.state.map.removeLayer(context.state.arrowLayer); context.state.arrowLayer=null; }
  const op=(!context.state.sel&&context.state.dest&&context.state.dest.plano&&context.state.planoSel!=null)?context.state.dest.plano.ops[context.state.planoSel]:null;
  if(!context.state.sel&&!op) return;
  const l=BYID[context.state.sel]; let rotas=[];
  if(op){ rotas=op.legs.map((g,i)=>[fatia(g.l.shapes[g.si],g.f0,g.f1),corPerna(op,i)]); }
  else if(context.state.viagem!=null){ rotas=[[l.shapes[l.depV[context.state.dia][context.state.sent][context.state.viagem]].p,escurecer(l.cor,escuro()?0:.35)]]; }
  else { const di=dirInfo(l); const cor=escurecer(l.cor,escuro()?0:.3);
    l.shapes.forEach((s,i)=>{ if(di.set.has(i)) rotas.push([s.p,cor,i===di.top]); });
    rotas.sort((a,b)=>(b[2]?1:0)-(a[2]?1:0)); }
  const z=context.state.map.getZoom(), vb=context.state.map.getPixelBounds(), mg=40, PASSO=z>=15?130:95;
  const postas=[]; const g=L.layerGroup();
  rotas.forEach(([pts,cor])=>{
    const P=pts.map(q=>context.state.map.project(q,z)); let acc=0, prox=PASSO*0.5;
    for(let k=1;k<P.length;k++){ const a=P[k-1], b=P[k]; const d=Math.hypot(b.x-a.x,b.y-a.y); if(!d) continue;
      while(prox<=acc+d){ const t=(prox-acc)/d, x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t; prox+=PASSO;
        if(d<10){ prox-=PASSO-12; if(prox<=acc+d) continue; else break; }
        if(x<vb.min.x-mg||x>vb.max.x+mg||y<vb.min.y-mg||y>vb.max.y+mg) continue;
        const ang=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
        if(postas.some(q=>Math.abs(q[0]-x)<30&&Math.abs(q[1]-y)<30&&Math.abs(((q[2]-ang+540)%360)-180)<70)) continue;
        postas.push([x,y,ang]);
        g.addLayer(L.marker(context.state.map.unproject([x,y],z),{icon:L.divIcon({className:'arw-ic',html:'<div class="arw" style="transform:rotate('+ang.toFixed(0)+'deg);--c:'+cor+'"><i></i></div>',iconSize:[20,20],iconAnchor:[10,10]}),interactive:false,keyboard:false,zIndexOffset:-600}));
      }
      acc+=d; }
  });
  context.state.arrowLayer=g.addTo(context.state.map); rtFrente();
}
// enquadra o trajeto na área visível do mapa, com folga para os rótulos de saída/chegada e para os botões
function ajusta(b,topo){ if(!context.state.map) return; context.state.map.invalidateSize({animate:false}); if(b){ const m=isMob(); context.state.map.fitBounds(b,{paddingTopLeft:[m?48:60,topo||(m?58:64)],paddingBottomRight:[m?48:70,m?46:56],maxZoom:16.5}); } }
function escurecer(hex,f){ const n=parseInt(hex.replace('#',''),16); const c=v=>Math.round(v*(1-f)).toString(16).padStart(2,'0'); return '#'+c(n>>16&255)+c(n>>8&255)+c(n&255); }

// Quando a página está embutida noutra (WordPress), oferece "Tela cheia"
let FE=null; try{ FE=window.frameElement; }catch(e){}

  return {
    PontoBus, pontoBus, initMap, escuro, setTiles, MT_KEY, getBase: () => base,
    nextBase() { const keys = Object.keys(BASES); base = keys[(keys.indexOf(base) + 1) % keys.length]; try { localStorage.setItem('mapa_base', base); } catch (error) {} },
    chip, rotSent, popupStop, pontosDaLinha, popupPoi, dirInfo, ocultaLinhas, estilo, setas, ajusta, escurecer
  };
};
