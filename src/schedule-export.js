window.createScheduleExport = function ({ BYID, LINHAS_SIGLA, SIG_LINHA, INI_T, T, D, css, sentidos, hm, marcasVar, trajetoVar, isMob, anuncia }) {
  function desenhaHorario(lid, dk) {
    const linha = BYID[lid], width = 1080, margin = 44;
    const usesCodes = LINHAS_SIGLA.indexOf(linha.id) >= 0;
    const columns = usesCodes ? 5 : 6;
    const columnWidth = (width - 2 * margin) / columns;
    const lineHeight = usesCodes ? 86 : 62;
    const legendHeight = 40;
    const label = sentido => linha.ttu
      ? T(sentido === 'T' ? INI_T[linha.id] || 'fromT' : 'fromB')
      : T(sentido === 'T' ? 'fromA' : 'fromV');
    const blocks = sentidos(linha, dk).map(sentido => {
      const times = (linha.dep[dk] || {})[sentido] || [];
      const variants = (linha.depV[dk] || {})[sentido] || [];
      const marks = marcasVar(linha, dk, sentido);
      return { title: label(sentido), count: times.length, times: times.map((time, index) => [hm(time) + (marks.ast[variants[index]] ? '*' : ''), marks.m[variants[index]] || '']), legend: marks.leg };
    });
    const legendColumns = usesCodes && !(SIG_LINHA[linha.id] || {}).txt ? 3 : 1;
    const blockHeight = block => Math.ceil(block.times.length / columns) * lineHeight + (block.legend.length ? Math.ceil(block.legend.length / legendColumns) * legendHeight + 18 : 0);
    const headerHeight = 212, titleHeight = 84, footerHeight = 128;
    const height = headerHeight + blocks.reduce((total, block) => total + titleHeight + blockHeight(block) + 26, 0) + footerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const display = css('--display') || 'Arial Narrow, Arial, sans-serif';
    const body = css('--body') || 'Arial, sans-serif';
    const brand = '#12325b', ink = '#14212b', muted = '#5b6770';
    const roundedRect = (x, y, w, h, radius) => {
      context.beginPath();
      if (context.roundRect) context.roundRect(x, y, w, h, radius);
      else context.rect(x, y, w, h);
    };
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = brand;
    context.fillRect(0, 0, width, headerHeight);
    context.textBaseline = 'alphabetic';
    context.font = '700 62px ' + display;
    const badgeWidth = Math.max(150, context.measureText(linha.id).width + 56);
    context.fillStyle = linha.bgc;
    roundedRect(margin, 40, badgeWidth, 92, 14);
    context.fill();
    context.fillStyle = linha.ink;
    context.textAlign = 'center';
    context.fillText(linha.id, margin + badgeWidth / 2, 108);
    context.textAlign = 'left';
    context.fillStyle = '#ffffff';
    let fontSize = 54;
    context.font = '700 ' + fontSize + 'px ' + display;
    while (context.measureText(linha.nome).width > width - 2 * margin - badgeWidth - 28 && fontSize > 30) {
      fontSize -= 2;
      context.font = '700 ' + fontSize + 'px ' + display;
    }
    context.fillText(linha.nome, margin + badgeWidth + 28, 104);
    context.font = '600 32px ' + body;
    context.fillText(T(dk.toLowerCase()) + ' · ' + T('expSub'), margin, 178);
    let y = headerHeight;
    blocks.forEach(block => {
      y += titleHeight;
      context.fillStyle = ink;
      context.font = '700 40px ' + display;
      context.textAlign = 'left';
      context.fillText(block.title, margin, y - 24);
      context.fillStyle = muted;
      context.font = '500 26px ' + body;
      context.textAlign = 'right';
      context.fillText(block.count + ' ' + T('trips'), width - margin, y - 26);
      const rows = Math.ceil(block.times.length / columns);
      for (let row = 0; row < rows; row += 1) {
        context.fillStyle = row % 2 ? '#f1f4f7' : '#ffffff';
        context.fillRect(margin, y + row * lineHeight, width - 2 * margin, lineHeight);
      }
      context.textAlign = 'left';
      block.times.forEach((item, index) => {
        const x = margin + (index % columns) * columnWidth + 22;
        const baseline = y + Math.floor(index / columns) * lineHeight + 43;
        context.fillStyle = ink;
        context.font = '600 36px ' + body;
        context.fillText(item[0], x, baseline);
        if (item[1] && usesCodes) {
          context.fillStyle = muted;
          let size = 22;
          context.font = '600 ' + size + 'px ' + body;
          while (context.measureText(item[1]).width > columnWidth - 30 && size > 14) {
            size -= 1;
            context.font = '600 ' + size + 'px ' + body;
          }
          context.fillText(item[1], x, baseline + 28);
        } else if (item[1]) {
          context.fillStyle = linha.bgc;
          context.font = '700 24px ' + body;
          context.fillText(item[1], x + context.measureText(item[0]).width + 5, baseline - 14);
        }
      });
      context.strokeStyle = '#c9d2da';
      context.lineWidth = 2;
      context.strokeRect(margin, y, width - 2 * margin, rows * lineHeight);
      y += rows * lineHeight;
      if (block.legend.length) {
        y += 18;
        const rows = Math.ceil(block.legend.length / legendColumns);
        const legendWidth = (width - 2 * margin) / legendColumns;
        block.legend.forEach((item, index) => {
          const x = margin + Math.floor(index / rows) * legendWidth;
          const baseline = y + (index % rows) * legendHeight + 28;
          context.font = '700 26px ' + body;
          context.fillStyle = usesCodes || item[0].length > 1 ? ink : linha.bgc;
          context.fillText(item[0], x, baseline);
          const labelWidth = context.measureText(item[0]).width;
          let size = 26;
          context.font = '500 ' + size + 'px ' + body;
          while (context.measureText(item[1]).width > legendWidth - labelWidth - 16 && size > 17) {
            size -= 1;
            context.font = '500 ' + size + 'px ' + body;
          }
          context.fillStyle = muted;
          context.fillText(item[1], x + labelWidth + 12, baseline);
        });
        y += rows * legendHeight;
      }
      y += 26;
    });
    context.textAlign = 'left';
    context.fillStyle = muted;
    context.font = '500 25px ' + body;
    context.fillText(T('expNota'), margin, y + 44);
    context.fillText('FOZTRANS' + (D.versao ? ' · ' + T('upd') + ' ' + D.versao.slice(8, 10) + '/' + D.versao.slice(5, 7) + '/' + D.versao.slice(0, 4) : ''), margin, y + 84);
    return canvas;
  }

  function exportaHorario(button, lineId, day) {
    const linha = BYID[lineId];
    if (!linha) return;
    const originalText = button.textContent;
    button.textContent = T('expBusy');
    button.disabled = true;
    const finish = () => { button.textContent = originalText; button.disabled = false; };
    const create = () => {
      let canvas;
      const fileName = 'horario-linha-' + linha.id + '-' + day.toLowerCase() + '.png';
      try { canvas = desenhaHorario(lineId, day); } catch (error) { finish(); return; }
      canvas.toBlob(blob => {
        finish();
        if (!blob) return;
        let file = null;
        try { file = new File([blob], fileName, { type: 'image/png' }); } catch (error) {}
        const download = () => {
          const url = URL.createObjectURL(blob), anchor = document.createElement('a');
          anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          anuncia(T('expOk'));
        };
        if (file && isMob() && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: linha.id + ' · ' + linha.nome }).catch(error => { if (!error || error.name !== 'AbortError') download(); });
        } else download();
      }, 'image/png');
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(create, create);
  }

  return { desenhaHorario, exportaHorario };
};
