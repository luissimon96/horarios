window.createVariantLabels = function ({ D, T, TTU, metros }) {
  const ORDEM_VILAC = ['DI', 'PTE', 'GL', 'CMP', 'CTO', 'MAC'];
  const SIG_LINHA = {
    '101': { ns: 1, ordem: ORDEM_VILAC, sep: ' ' },
    '102': { ns: 1, ordem: ORDEM_VILAC, sep: ' ' },
    '10': {
      ordem: ['DI', 'AL', 'MAC', 'CMP', 'ATE', 'DOT'], sep: '-',
      rot: { CMP: 'CMP UNI', ATE: 'ATÉ TTU', DOT: 'DO TTU' },
      txt: { DI: 'sg10_DI', MAC: 'sg10_MAC', CMP: 'sg10_CMP' },
      passa: 1, ini: 'fromC', ast: /5\s*MIN/i, astTxt: 'sg10_ast'
    }
  };
  const LINHAS_SIGLA = Object.keys(SIG_LINHA);
  const INI_T = { '10': 'fromC', '380': 'fromC' };
  const SIGLA = {
    PTE: 'PTE', PONTE: 'PTE', GL: 'GL', CMP: 'CMP', CAMP: 'CMP', CAMPUS: 'CMP',
    UNI: 'CMP', UNIOESTE: 'CMP', CTO: 'CTO', CTRO: 'CTO', CENTRO: 'CTO', CETRO: 'CTO',
    DI: 'DI', DIR: 'DI', DIRETO: 'DI', DIREITO: 'DI', DIRT: 'DI', MAC: 'MAC', AL: 'AL', ALMADA: 'AL'
  };
  const INTERNAS = ['ESP', 'PRIM', 'PRIMEIRA', 'ULTIMA', 'VIAGEM', 'VIAJEM', 'VIJ', 'V', 'REC', 'RC', 'RECOLHIMENTO', 'SOLTURA', 'RENDICAO', 'PARTE', '5MIN', 'T10', 'T6', 'F', 'SABADO'];
  const semAcento = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  function codigosVar(linha, indiceShape) {
    const cfg = SIG_LINHA[linha.id];
    const shape = linha.shapes[indiceShape] || {};
    const value = String(shape.v || '');
    const match = /^\s*\[([^\]]*)\]\s*(.*)$/.exec(value);
    const nome = (match ? match[2] : value).replace(/VILA\s+C(\s+(NORTE|SUL))?/i, ' ');
    const tokens = text => semAcento(text).split(/[^A-Z0-9]+/).filter(Boolean);
    const nameTokens = tokens(nome);
    const codeTokens = tokens(match ? match[1] : '');
    const directions = items => items.map(item => item === 'N' || item === 'NORTE' ? 'N' : item === 'S' || item === 'SUL' ? 'S' : '')
      .filter((item, index, all) => item && all.indexOf(item) === index);
    let orientation = [];
    if (cfg.ns) {
      orientation = directions(nameTokens);
      const codeOrientation = directions(codeTokens);
      if (codeOrientation.length > orientation.length) orientation = codeOrientation;
      if (!orientation.length) {
        const vila = /VILA\s+C\s+(NORTE|SUL)/i.exec(match ? match[2] : value);
        if (vila) orientation = [vila[1].charAt(0).toUpperCase()];
      }
    }
    const present = {};
    nameTokens.concat(codeTokens).forEach(token => { if (SIGLA[token]) present[SIGLA[token]] = 1; });
    if (cfg.passa && TTU && shape.p && shape.p.length) {
      const start = shape.p[0], end = shape.p[shape.p.length - 1];
      const startDistance = metros(start[0], start[1], TTU.lat, TTU.lon);
      const endDistance = metros(end[0], end[1], TTU.lat, TTU.lon);
      if (endDistance < 350 && startDistance >= 350) present.ATE = 1;
      if (startDistance < 350 && endDistance >= 350) present.DOT = 1;
    }
    return (orientation.length ? [orientation.join('-')] : []).concat(cfg.ordem.filter(code => present[code]));
  }

  const rotSigla = (linha, code) => (SIG_LINHA[linha.id].rot || {})[code] || code;
  const txtSigla = (linha, code) => T((SIG_LINHA[linha.id].txt || {})[code] || 'sg_' + code.replace('-', ''));
  function nomeVar(linha, indiceShape) {
    let value = String((linha.shapes[indiceShape] || {}).v || '').replace(/^\s*\[[^\]]*\]\s*/, '').replace(/\(\s*[^)]*\)/g, ' ');
    value = value.split(/(\s+|[-–>\/.*]+)/).map(part => INTERNAS.indexOf(semAcento(part)) >= 0 ? '' : part).join('');
    return value.replace(/(\s*[-–>\/.*]+\s*){2,}/g, ' - ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–>\/.*]+|[\s\-–>\/.*]+$/g, '').trim();
  }
  function marcasVar(linha, dia, sentido) {
    const trips = ((linha.depV[dia] || {})[sentido]) || [];
    const counts = {};
    trips.forEach(index => { counts[index] = (counts[index] || 0) + 1; });
    const order = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || a - b);
    const marks = {}, legend = [];
    if (SIG_LINHA[linha.id]) {
      const cfg = SIG_LINHA[linha.id], used = {}, ast = {};
      let hasAst = false;
      order.forEach(index => {
        const codes = codigosVar(linha, index);
        marks[index] = codes.map(code => rotSigla(linha, code)).join(cfg.sep);
        codes.forEach(code => { used[code] = 1; });
        if (cfg.ast && cfg.ast.test(String((linha.shapes[index] || {}).v || ''))) { ast[index] = 1; hasAst = true; }
      });
      ['N-S', 'S-N', 'N', 'S'].concat(cfg.ordem).forEach(code => { if (used[code]) legend.push([rotSigla(linha, code), txtSigla(linha, code)]); });
      if (hasAst) legend.push(['*', T(cfg.astTxt)]);
      return { m: marks, leg: legend, sig: true, ast };
    }
    const key = value => semAcento(value).replace(/[^A-Z0-9]/g, '');
    const base = order.length ? key(nomeVar(linha, order[0])) : '';
    const letters = {};
    let nextLetter = 0;
    order.slice(1).forEach(index => {
      const name = nomeVar(linha, index), id = key(name);
      if (!id || id === base) return;
      if (!letters[id]) { letters[id] = String.fromCharCode(65 + (nextLetter++) % 26); legend.push([letters[id], name]); }
      marks[index] = letters[id];
    });
    if (legend.length) legend.unshift([T('semLetra'), order.length && nomeVar(linha, order[0]) || linha.nome]);
    return { m: marks, leg: legend, sig: false, ast: {} };
  }
  function trajetoVar(linha, indiceShape) {
    if (SIG_LINHA[linha.id]) {
      const descriptions = codigosVar(linha, indiceShape).map(code => txtSigla(linha, code));
      return descriptions.length ? descriptions.join(' · ') : linha.nome;
    }
    return nomeVar(linha, indiceShape) || linha.nome;
  }
  return { SIG_LINHA, LINHAS_SIGLA, INI_T, codigosVar, rotSigla, txtSigla, nomeVar, marcasVar, trajetoVar };
};
