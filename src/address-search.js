window.createAddressSearch = function (context) {
  const { D, T, MT_KEY, metros } = context;
const PHOTON='https://photon.komoot.io/api/';
const FOZ_BBOX='-54.66,-25.72,-54.40,-25.36';
const _geo={}; let geoT=null, geoAmplo=false;
const nzq=t=>(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
function buscaPhoton(q){
  return fetch(PHOTON+'?q='+encodeURIComponent(q)+'&limit=12&bbox='+FOZ_BBOX+'&lat=-25.53&lon=-54.57').then(r=>{ if(!r.ok) throw new Error('http'); return r.json(); }).then(j=>{
    const vistos={}, out=[]; (j.features||[]).forEach(f=>{ const P=f.properties||{}, c=f.geometry&&f.geometry.coordinates; if(!c||(P.countrycode&&P.countrycode!=='BR')||P.osm_value==='bus_stop') return;
      const rua=P.street?P.street+(P.housenumber?', '+P.housenumber:''):'', nome=P.name||rua; if(!nome) return;
      const sub=[P.name&&rua?rua:'',P.district||P.locality||P.suburb||'',P.city&&P.city!=='Foz do Iguaçu'?P.city:''].filter(Boolean).join(' · ');
      const k=nzq(nome+'|'+sub); if(vistos[k]) return; vistos[k]=1; out.push({nome,sub,lat:c[1],lon:c[0]}); });
    return out.slice(0,6); }); }
function buscaMapTiler(q){
  return fetch('https://api.maptiler.com/geocoding/'+encodeURIComponent(q)+'.json?key='+MT_KEY+'&bbox='+FOZ_BBOX+'&proximity=-54.57,-25.53&country=br&limit=6&language='+lang).then(r=>{ if(!r.ok) throw new Error('http'); return r.json(); }).then(j=>
    (j.features||[]).map(f=>{ const c=f.center||(f.geometry&&f.geometry.type==='Point'?f.geometry.coordinates:null); if(!c) return null;
      const t=(f.place_name||f.text||q).replace(/, (Paraná|Região Sul|Brasil|Brazil).*$/,''), k=t.indexOf(', '); return {nome:k>0?t.slice(0,k):t,sub:k>0?t.slice(k+2):'',lat:c[1],lon:c[0]}; }).filter(Boolean)); }
// ── endereço com número ("Rua Tal, 350") ──
// A busca de endereços (Photon/MapTiler) usa o OpenStreetMap, que em Foz quase não tem numeração predial. Para rua + número a página
// consulta o índice do IBGE (CNEFE, Censo 2022) guardado no Drive do mapa: o Apps Script entrega a lista de ruas (?enderecos=1, uma vez,
// fica guardada no aparelho) e os números de cada rua (?rua=12,340). Sem o índice no Drive, tudo segue como antes.
const END_LS='fz_ruas_1', END_TIPOS={R:'RUA',RUA:'RUA',AV:'AVENIDA',AVE:'AVENIDA',AVENIDA:'AVENIDA',AL:'ALAMEDA',ALAMEDA:'ALAMEDA',TV:'TRAVESSA',TRAV:'TRAVESSA',TRAVESSA:'TRAVESSA',BECO:'BECO',VIELA:'VIELA',ESTRADA:'ESTRADA',EST:'ESTRADA',ROD:'RODOVIA',RODOVIA:'RODOVIA',PC:'PRACA',PCA:'PRACA',PRACA:'PRACA',CHACARA:'CHACARA'};
const END_ABREV={DR:['DOUTOR'],DRA:['DOUTORA'],PE:['PADRE'],STA:['SANTA'],STO:['SANTO'],MAL:['MARECHAL'],CEL:['CORONEL'],CAP:['CAPITAO'],SGT:['SARGENTO'],TEN:['TENENTE'],VER:['VEREADOR'],JK:['JUSCELINO','KUBITSCHEK'],NS:['NOSSA','SENHORA']};
const END_SOLTAS={DE:1,DA:1,DO:1,DOS:1,DAS:1,E:1}, END_NAO={LINHA:1,LINHAS:1,LINEA:1,LINE:1,ONIBUS:1,BUS:1}, END_PERTO=100; // END_PERTO: diferença máxima de numeração para aceitar o número vizinho
let END=null, endP=null; const _endN={};
const endTok=t=>(t||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9 ]+/g,' ').split(/\s+/).filter(Boolean);
function endPrep(j){ j.R=j.ruas.map((nome,i)=>{ const t=endTok(nome), tipo=END_TIPOS[t[0]]?t[0]:''; return {i,nome,tipo,tk:(tipo?t.slice(1):t).filter(x=>!END_SOLTAS[x])}; }); return j; }
let endSem=false; // o Apps Script respondeu sem índice (arquivo ainda não está no Drive ou implantação antiga): não pergunta de novo nesta visita
function endRuas(){ if(END) return Promise.resolve(END); if(endP) return endP; const u=window.__DADOS_URL__||''; if(!u||endSem) return Promise.resolve(null);
  try{ const j=JSON.parse(localStorage.getItem(END_LS)||'null'); if(j&&j.ruas&&j.ruas.length&&Date.now()-j.em<7*864e5){ END=endPrep(j); return Promise.resolve(END); } }catch(e){}
  endP=fetch(u+(u.indexOf('?')<0?'?':'&')+'enderecos=1').then(r=>r.json()).then(j=>{ if(!j||!j.ruas||!j.ruas.length){ endSem=true; return null; } j.em=Date.now(); try{ localStorage.setItem(END_LS,JSON.stringify({v:j.v,fonte:j.fonte,bairros:j.bairros,ruas:j.ruas,em:j.em})); }catch(e){} return (END=endPrep(j)); })
    .catch(()=>null).then(x=>{ endP=null; return x; }); return endP; }
// distância de edição até 1 (uma letra trocada, a mais ou a menos): tolera erro de digitação em palavras de 5 letras ou mais
function endQuase(a,b){ if(a===b) return true; const la=a.length, lb=b.length; if(Math.abs(la-lb)>1||Math.min(la,lb)<5) return false; let i=0; while(i<la&&i<lb&&a[i]===b[i]) i++; let x=la-1, y=lb-1; while(x>=i&&y>=i&&a[x]===b[y]){ x--; y--; } return Math.max(x-i,y-i)<1||(x-i===1&&y-i===1&&a[i]===b[y]&&a[x]===b[i]); }
// ruas do índice que casam com o texto: todas as palavras digitadas têm de aparecer no nome (início da palavra ou quase igual)
function endCasa(txt){ let t=endTok(txt), tipo=''; if(t.length&&END_TIPOS[t[0]]){ tipo=END_TIPOS[t[0]]; t=t.slice(1); }
  if(t.length&&END_NAO[t[0]]) return [];                                   // "linha 120", "ônibus 250": é busca de linha, não de endereço
  let q=[]; t.forEach(x=>{ if(END_SOLTAS[x]) return; (END_ABREV[x]||[x]).forEach(y=>q.push(y)); }); if(!q.length||(!tipo&&q.join('').length<3)) return [];
  const out=[]; END.R.forEach(r=>{ let qual=0; const usado={};
    for(const x of q){ let k=r.tk.findIndex((y,j)=>!usado[j]&&y===x), custo=0;
      if(k<0&&x.length>=3&&tipo){ k=r.tk.findIndex((y,j)=>!usado[j]&&y.indexOf(x)===0); custo=1; }   // começo de palavra: só com "rua", "avenida"… na frente
      if(k<0){ k=r.tk.findIndex((y,j)=>!usado[j]&&endQuase(x,y)); custo=2; } if(k<0) return; usado[k]=1; qual+=custo; }
    out.push([qual,(r.tk.length-q.length)*1.5+(tipo&&r.tipo&&tipo!==r.tipo?2:0),r]); });
  if(!out.length) return [];
  // ficam só as ruas que casaram tão bem quanto a melhor (palavra inteira ganha de começo de palavra; nome sem palavras sobrando ganha de nome maior)
  const q0=Math.min.apply(null,out.map(x=>x[0])), bons=out.filter(x=>x[0]===q0), s0=Math.min.apply(null,bons.map(x=>x[1]));
  return bons.filter(x=>x[1]<=s0+0.5).sort((a,b)=>a[1]-b[1]||a[2].nome.length-b[2].nome.length).slice(0,4).map(x=>x[2]); }
// nomes do IBGE vêm em maiúsculas e sem acento: volta para "Rua Sérgio Gaspareto" usando as palavras acentuadas que já existem nos pontos de parada
let endAc=null;
function endNome(t){ if(!endAc){ endAc={}; D.stops.forEach(s=>[s[2],s[4]].forEach(x=>{ (x||'').split(/[^A-Za-zÀ-ÿ]+/).forEach(w=>{ if(w.length>2&&/[À-ÿ]/.test(w)){ const k=nzq(w); if(!endAc[k]) endAc[k]=w.charAt(0).toUpperCase()+w.slice(1).toLowerCase(); } }); })); }
  return t.toLowerCase().split(' ').map((w,i)=>(i&&END_SOLTAS[w.toUpperCase()])?w:(endAc[w]||w.charAt(0).toUpperCase()+w.slice(1))).join(' '); }
function endNumeros(ids){ const falta=ids.filter(i=>!_endN[i]); if(!falta.length) return Promise.resolve();
  const u=window.__DADOS_URL__; return fetch(u+(u.indexOf('?')<0?'?':'&')+'rua='+falta.join(',')).then(r=>r.json()).then(j=>{ Object.keys((j&&j.r)||{}).forEach(i=>{ _endN[i]=j.r[i]; }); }); }
// resultados para um texto com número no fim; [] se o texto não tem número, se a rua não está no índice ou se o índice não existe
function buscaNumero(q){ const m=/^(.*?[a-zà-ú].*?)[\s,;.-]+(?:n[ºo°.]?\s*)?(\d{1,6})\s*[a-z]?\s*$/i.exec((q||'').trim()); if(!m) return Promise.resolve([]);
  const num=+m[2]; if(!num) return Promise.resolve([]);
  return endRuas().then(E=>{ if(!E) return []; const ruas=endCasa(m[1]); if(!ruas.length) return [];
    return endNumeros(ruas.map(r=>r.i)).then(()=>{ const exatos=[], perto=[];
      ruas.forEach(r=>{ const e=_endN[r.i]; if(!e) return; const la0=e[0], lo0=e[1]; let melhor=null, achou=false;
        for(let k=2;k<e.length;k+=4){ const n=e[k], o={nome:endNome(r.nome)+', '+n,lat:(la0+e[k+1])/1e5,lon:(lo0+e[k+2])/1e5,b:E.bairros[e[k+3]]||'',ibge:1};
          if(n===num){ o.sub=endNome(o.b); exatos.push(o); achou=true; }
          else { const d=Math.abs(n-num)+((n-num)%2?0.5:0); if(!melhor||d<melhor[0]) melhor=[d,o,n]; } } // mesmo lado da rua (par/ímpar) vale mais
        if(!achou&&melhor&&Math.abs(melhor[2]-num)<=END_PERTO){ const o=melhor[1]; o.nome=endNome(r.nome)+', '+num; o.sub=T('endAprox').replace('{n}',melhor[2])+(o.b?' · '+endNome(o.b):''); o.aprox=1; perto.push(o); } });
      return (exatos.length?exatos:perto.slice(0,2)).slice(0,4); }); }).catch(()=>[]); }
// junta os resultados com número (primeiro) aos da busca comum, sem repetir o mesmo lugar
function endJunta(pn,r){ return pn.then(n=>n.concat((r||[]).filter(x=>!n.some(y=>metros(x.lat,x.lon,y.lat,y.lon)<40))).slice(0,7),()=>r||[]); }
// amplo = a pessoa pediu para procurar de novo (resultado vazio): vai direto ao MapTiler

  return { PHOTON, nzq, buscaPhoton, buscaMapTiler, buscaNumero, endJunta };
};
