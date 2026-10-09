// ── de onde vêm os dados ──
// 1) cópia embutida nesta página; 2) cópia guardada no navegador; 3) endereço externo (pasta do Drive via Apps Script).
// Quando há endereço externo, ele manda: a página usa a cópia já guardada no navegador (rápido) e confere em segundo plano
// se há versão nova para a próxima visita. A cópia embutida só entra se o endereço não responder.
(function(){
  const emb=window.__MAPA__; let url=window.__DADOS_URL__||'';
  try{ const fe=window.frameElement; if(fe&&fe.parentElement&&fe.parentElement.dataset.dados) url=fe.parentElement.dataset.dados; }catch(e){}
  const valido=d=>!!(d&&d.linhas&&d.linhas.length&&d.poi&&d.stops);
  const guarda=txt=>{ try{ localStorage.setItem('mapa_dados',txt); }catch(e){} };
  if(!/^https:\/\//.test(url)) return app(emb);
  let cache=null; try{ const c=localStorage.getItem('mapa_dados'); if(c){ const j=JSON.parse(c); if(valido(j)) cache=j; } }catch(e){}
  const baixar=()=>fetch(url).then(r=>r.text()).then(txt=>{ const d=JSON.parse(txt); if(!valido(d)) throw new Error('dados'); return [d,txt]; });
  if(cache){
    const v=cache.versao; cache._fonte='drive'; app(cache);
    fetch(url+(url.indexOf('?')<0?'?':'&')+'v=1').then(r=>r.json()).then(j=>{ if(j&&j.versao&&j.versao!==v) return baixar().then(x=>guarda(x[1])); }).catch(()=>{});
    return;
  }
  let feito=false; const usar=d=>{ if(!feito){ feito=true; clearTimeout(tm); app(d); } };
  const tm=setTimeout(()=>usar(emb),6000);
  baixar().then(x=>{ guarda(x[1]); x[0]._fonte='drive'; usar(x[0]); }).catch(()=>usar(emb));
})();
// aplicativo: guarda a página no aparelho (abre mais rápido e mostra os horários mesmo sem internet) e se atualiza sozinho
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){ window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); }); }
