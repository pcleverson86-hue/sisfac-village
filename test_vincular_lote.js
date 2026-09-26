// test_vincular_lote.js - Teste automatizado para vinculação em lote de colaboradores
const http = require('node:http');

function request(options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- TESTE 1: Buscar Clientes e Postos com Vagas Disponíveis ---');
  const resClientes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/clientes?detalhes=1',
    method: 'GET'
  });

  const clientes = resClientes.data;
  let clienteAlvo = null;
  let postoAlvo = null;

  for (const c of clientes) {
    if (c.postos && c.postos.length > 0) {
      for (const p of c.postos) {
        if (p.vagas_disponiveis >= 2) {
          clienteAlvo = c;
          postoAlvo = p;
          break;
        }
      }
    }
    if (postoAlvo) break;
  }

  // Se não encontrar posto com >= 2 vagas livres, procurar um com >= 1 ou criar posto temporário com 5 vagas
  if (!postoAlvo) {
    clienteAlvo = clientes[0];
    console.log('Criando posto com 5 vagas para teste...');
    const resPosto = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/postos',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      cliente_id: clienteAlvo.id,
      nome_posto: 'Posto Teste Vinculação em Lote',
      quantidade_vagas_limite: 5,
      escala: '5x2',
      turno: 'Comercial'
    });
    postoAlvo = { id: resPosto.data.id, nome_posto: 'Posto Teste Vinculação em Lote', quantidade_vagas_limite: 5, vagas_disponiveis: 5 };
  }

  console.log(`Cliente Alvo: "${clienteAlvo.nome_fantasia || clienteAlvo.nome_razao_social}" (ID #${clienteAlvo.id})`);
  console.log(`Posto Alvo: "${postoAlvo.nome_posto}" (ID #${postoAlvo.id}) | Vagas Disponíveis: ${postoAlvo.vagas_disponiveis}`);

  console.log('\n--- TESTE 2: Buscar Colaboradores Disponíveis para Lote ---');
  const resColabs = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/colaboradores',
    method: 'GET'
  });
  const todosColabs = resColabs.data.filter(c => c.ativo === 1 && c.status_colaborador !== 'Demitido' && c.posto_trabalho_id !== postoAlvo.id);
  console.log(`Total de colaboradores elegíveis para vincular: ${todosColabs.length}`);

  if (todosColabs.length < 2) {
    console.error('Menos de 2 colaboradores elegíveis para teste.');
    process.exit(1);
  }

  // Selecionar 2 colaboradores para o teste de lote
  const colab1 = todosColabs[0];
  const colab2 = todosColabs[1];
  const idsLote = [colab1.id, colab2.id];
  console.log(`Colaboradores selecionados para lote: [#${colab1.id}] ${colab1.nome} e [#${colab2.id}] ${colab2.nome}`);

  console.log('\n--- TESTE 3: Vincular 2 Colaboradores Simultaneamente em Lote ---');
  const resLote = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/colaboradores/vincular-lote',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    colaborador_ids: idsLote,
    posto_trabalho_id: postoAlvo.id,
    cliente_id: clienteAlvo.id,
    escala: '5x2'
  });

  console.log('Status POST /api/colaboradores/vincular-lote:', resLote.status);
  console.log('Resposta do Servidor:', resLote.data);
  if (!resLote.data.success) {
    throw new Error('Falha ao vincular em lote: ' + JSON.stringify(resLote.data));
  }

  console.log('\n--- TESTE 4: Validar se Ambos os Colaboradores Estão Alocados no Posto ---');
  const resColabsAfter = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/colaboradores',
    method: 'GET'
  });
  const c1After = resColabsAfter.data.find(c => c.id === colab1.id);
  const c2After = resColabsAfter.data.find(c => c.id === colab2.id);

  console.log(`Colaborador 1 (#${c1After.id}): Posto ID=${c1After.posto_trabalho_id}, Cliente ID=${c1After.cliente_id}`);
  console.log(`Colaborador 2 (#${c2After.id}): Posto ID=${c2After.posto_trabalho_id}, Cliente ID=${c2After.cliente_id}`);

  if (c1After.posto_trabalho_id !== postoAlvo.id || c2After.posto_trabalho_id !== postoAlvo.id) {
    throw new Error('Os colaboradores não foram alocados corretamente no posto alvo!');
  }
  console.log('✅ Ambos os colaboradores foram alocados com sucesso no mesmo posto em lote!');

  console.log('\n--- TESTE 5: Teste de Trava de Lotação Máxima (Exceder Vagas) ---');
  // Tentar vincular mais colaboradores do que o limite permite
  const idsMuitos = todosColabs.map(c => c.id);
  const resExcesso = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/colaboradores/vincular-lote',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    colaborador_ids: idsMuitos,
    posto_trabalho_id: postoAlvo.id,
    cliente_id: clienteAlvo.id
  });

  console.log('Status tentativa de excesso (esperado 400):', resExcesso.status);
  console.log('Mensagem de bloqueio:', resExcesso.data.message);
  if (resExcesso.status !== 400) {
    throw new Error('A trava de lotação máxima deveria ter bloqueado a tentativa!');
  }
  console.log('✅ Trava de lotação máxima em lote funcionou perfeitamente!');

  console.log('\n--- TESTE 6: Restaurar Colaboradores de Teste para Reserva Técnica ---');
  await request({ hostname: '127.0.0.1', port: 3000, path: `/api/colaboradores/${colab1.id}/desvincular-posto`, method: 'POST' });
  await request({ hostname: '127.0.0.1', port: 3000, path: `/api/colaboradores/${colab2.id}/desvincular-posto`, method: 'POST' });
  console.log('✅ Colaboradores de teste retornados à Reserva Técnica.');

  console.log('\n>>> TODOS OS TESTES DE VINCULAÇÃO EM LOTE FORAM APROVADOS! <<<');
}

runTests().catch(err => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
