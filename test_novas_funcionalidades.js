// test_novas_funcionalidades.js - Teste automatizado das 4 novas implementações
const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('>>> INICIANDO TESTES DAS 4 NOVAS IMPLEMENTAÇÕES <<<\n');
  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // TESTE 1: Elementos de Interface no index.html e app.js
  // -------------------------------------------------------------
  console.log('--- TESTE 1: Verificação de UI e Elementos HTML/JS ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');

  const requiredHtml = [
    'postoBuscaCargo',
    'filtrarCargosModalPosto',
    'filtroColabBuscaCliente',
    'filtrarClientesAbaColab',
    'modalHistoricoColaborador',
    'areaTimelineEventos',
    'modalConcessaoColetivaBeneficios',
    'listaColabsLoteContainer'
  ];

  requiredHtml.forEach(tag => {
    if (indexHtml.includes(tag)) {
      console.log(`  ✅ HTML contém: ${tag}`);
      passed++;
    } else {
      console.error(`  ❌ Faltando no HTML: ${tag}`);
      failed++;
    }
  });

  const requiredJs = [
    'function filtrarCargosModalPosto',
    'function filtrarClientesAbaColab',
    'function abrirModalHistoricoColaborador',
    'function renderizarLinhaDoTempoHistorico',
    'function salvarNovaAnotacaoHistorico',
    'function abrirModalConcessaoLoteBeneficios',
    'function selecionarColabsLotePorEscala',
    'function salvarConcessaoLoteBeneficios'
  ];

  requiredJs.forEach(fn => {
    if (appJs.includes(fn)) {
      console.log(`  ✅ JS contém: ${fn}`);
      passed++;
    } else {
      console.error(`  ❌ Faltando no JS: ${fn}`);
      failed++;
    }
  });

  // -------------------------------------------------------------
  // TESTE 2: API de Histórico 360° do Colaborador (GET & POST)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: API de Histórico 360° do Colaborador ---');
  try {
    const resColabs = await request({ host: '127.0.0.1', port: 3000, path: '/api/colaboradores', method: 'GET' });
    const colab1 = resColabs.data[0];
    if (!colab1) throw new Error('Nenhum colaborador encontrado para testar histórico');

    console.log(`  Testando histórico com colaborador ID: ${colab1.id} (${colab1.nome})`);

    // Inserir anotação teste no histórico
    const postHist = await request(
      {
        host: '127.0.0.1',
        port: 3000,
        path: `/api/colaboradores/${colab1.id}/historico`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        tipo_evento: 'TREINAMENTO',
        titulo: 'Certificação de Procedimentos e Segurança',
        descricao: 'Treinamento concluído com aproveitamento 100%.',
        data_evento: '2026-09-22',
        usuario_responsavel: 'Instrutor Roberto'
      }
    );

    if (postHist.status === 200 && postHist.data.success) {
      console.log('  ✅ POST /api/colaboradores/:id/historico funcionou com sucesso!');
      passed++;
    } else {
      console.error('  ❌ Falha no POST histórico:', postHist);
      failed++;
    }

    // Consultar histórico unificado
    const getHist = await request({ host: '127.0.0.1', port: 3000, path: `/api/colaboradores/${colab1.id}/historico`, method: 'GET' });
    if (getHist.status === 200 && getHist.data.colaborador && Array.isArray(getHist.data.timeline)) {
      console.log(`  ✅ GET /api/colaboradores/:id/historico retornou ${getHist.data.timeline.length} eventos na linha do tempo!`);
      console.log(`     Tempo de empresa: ${getHist.data.estatisticas.tempo_empresa}`);
      console.log(`     Total de férias: ${getHist.data.estatisticas.total_ferias}, Faltas: ${getHist.data.estatisticas.total_faltas}`);
      
      const temTreinamento = getHist.data.timeline.some(t => t.titulo.includes('Certificação de Procedimentos'));
      if (temTreinamento) {
        console.log('  ✅ Evento inserido foi recuperado e ordenado com sucesso na timeline!');
        passed++;
      } else {
        console.error('  ❌ Evento inserido não apareceu na timeline.');
        failed++;
      }
      passed++;
    } else {
      console.error('  ❌ Resposta inesperada no GET histórico:', getHist);
      failed++;
    }
  } catch (err) {
    console.error('  ❌ Erro no teste de histórico:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TESTE 3: API de Concessão Coletiva de Benefícios em Lote
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: Concessão Coletiva de Benefícios em Lote ---');
  try {
    const resColabs = await request({ host: '127.0.0.1', port: 3000, path: '/api/colaboradores', method: 'GET' });
    const colabIds = resColabs.data.slice(0, 3).map(c => c.id);

    console.log(`  Concedendo benefícios em lote para ${colabIds.length} colaboradores (IDs: ${colabIds.join(', ')})...`);

    const payloadLote = {
      ano_mes: '2026-09',
      colaborador_ids: colabIds,
      data_inicio: '2026-09-01',
      data_fim: '2026-09-30',
      dias_modo: 'calendario',
      espelhar_valores_cadastrados: true,
      descontar_faltas: true,
      observacoes: 'Concessão Coletiva Teste - Período Integral Setembro'
    };

    const resLote = await request(
      {
        host: '127.0.0.1',
        port: 3000,
        path: '/api/beneficios/concessao-lote',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      payloadLote
    );

    if (resLote.status === 200 && resLote.data.success && resLote.data.count === colabIds.length) {
      console.log(`  ✅ POST /api/beneficios/concessao-lote concedeu benefícios para ${resLote.data.count} colaboradores!`);
      console.log(`     Total VT: R$ ${resLote.data.total_vt.toFixed(2)} | Total VA: R$ ${resLote.data.total_va.toFixed(2)}`);
      passed++;
    } else {
      console.error('  ❌ Falha no endpoint de concessão em lote:', resLote);
      failed++;
    }

    // Conferir fechamento de benefícios para a competência
    const resFech = await request({ host: '127.0.0.1', port: 3000, path: '/api/beneficios/fechamento?ano_mes=2026-09', method: 'GET' });
    if (resFech.status === 200 && Array.isArray(resFech.data.colaboradores)) {
      const customizados = resFech.data.colaboradores.filter(c => colabIds.includes(c.colaborador_id) && c.customizado);
      if (customizados.length === colabIds.length) {
        console.log(`  ✅ Todos os ${colabIds.length} colaboradores aparecem atualizados e customizados na folha mensal!`);
        passed++;
      } else {
        console.error(`  ❌ Apenas ${customizados.length} de ${colabIds.length} foram encontrados customizados.`);
        failed++;
      }
    }
  } catch (err) {
    console.error('  ❌ Erro no teste de concessão coletiva:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // RESUMO FINAL
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`RESULTADO DOS TESTES: ${passed} PASSARAM | ${failed} FALHARAM`);
  console.log('=============================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
