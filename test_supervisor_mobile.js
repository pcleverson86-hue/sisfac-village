// test_supervisor_mobile.js - Teste Automatizado de Integração do Portal do Supervisor Mobile
const http = require('node:http');

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3000' + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('TESTES AUTOMATIZADOS: PORTAL DO SUPERVISOR MOBILE & SISFAC 2.0');
  console.log('===============================================================\n');

  // TEST 1: Verificar se os 5 supervisores estão cadastrados
  console.log('--- TESTE 1: GET /api/supervisores ---');
  const resSups = await apiRequest('GET', '/api/supervisores');
  console.log('Status:', resSups.status);
  console.log('Total de supervisores cadastrados:', resSups.body.length);
  if (resSups.body.length !== 5) {
    throw new Error(`Esperado 5 supervisores, mas obteve: ${resSups.body.length}`);
  }
  const sup1 = resSups.body[0];
  const sup2 = resSups.body[1];
  console.log(`Supervisor 1: ID ${sup1.id} - ${sup1.nome} (PIN: ${sup1.pin})`);
  console.log(`Supervisor 2: ID ${sup2.id} - ${sup2.nome} (PIN: ${sup2.pin})\n`);

  // TEST 2: Login do supervisor por PIN e por Token
  console.log('--- TESTE 2: POST /api/supervisor/login ---');
  const resLoginPin = await apiRequest('POST', '/api/supervisor/login', {
    supervisor_id: sup1.id,
    pin: sup1.pin
  });
  console.log('Login por PIN status:', resLoginPin.status, 'Sucesso:', resLoginPin.body.success);
  if (!resLoginPin.body.success) throw new Error('Falha no login por PIN do supervisor 1');

  const resLoginToken = await apiRequest('POST', '/api/supervisor/login', {
    token: sup2.token_acesso
  });
  console.log('Login por Token status:', resLoginToken.status, 'Sucesso:', resLoginToken.body.success);
  if (!resLoginToken.body.success) throw new Error('Falha no login por Token do supervisor 2\n');

  // TEST 3: Dados iniciais para o celular do supervisor
  console.log('\n--- TESTE 3: GET /api/supervisor/dados-iniciais ---');
  const resDados = await apiRequest('GET', `/api/supervisor/dados-iniciais?token=${sup1.token_acesso}`);
  console.log('Status dados iniciais:', resDados.status);
  console.log('Supervisor identificado:', resDados.body.supervisor?.nome);
  console.log('Clientes ativos:', resDados.body.clientes?.length);
  console.log('Colaboradores ativos:', resDados.body.colaboradores?.length);
  console.log('Turnos disponíveis:', resDados.body.turnos_padrao?.length);

  const clienteTeste = resDados.body.clientes[0];
  const unidadeTeste = resDados.body.unidades.find(u => u.cliente_id === clienteTeste.id) || { id: 1 };
  const colabFaltante = resDados.body.colaboradores[0];
  const colabCobertor = resDados.body.colaboradores[1];

  console.log(`\nCenário de Teste:`);
  console.log(`Cliente: [${clienteTeste.id}] ${clienteTeste.nome_fantasia || clienteTeste.nome_razao_social}`);
  console.log(`Colaborador Ausente: [${colabFaltante.id}] ${colabFaltante.nome}`);
  console.log(`Colaborador Substituto: [${colabCobertor.id}] ${colabCobertor.nome}`);

  // TEST 4: Lançar falta COM COBERTURA via Mobile
  console.log('\n--- TESTE 4: POST /api/supervisor/lancar-falta (COM COBERTURA) ---');
  const hojeStr = new Date().toISOString().slice(0, 10);
  const resLancamentoComCob = await apiRequest('POST', '/api/supervisor/lancar-falta', {
    supervisor_id: sup1.id,
    data_falta: hojeStr,
    cliente_id: clienteTeste.id,
    unidade_id: unidadeTeste.id,
    colaborador_id: colabFaltante.id,
    turno: '12x36 Diurno (07h às 19h)',
    motivo_falta: 'Falta Injustificada',
    dias_afastamento: 1,
    houve_cobertura: 1,
    tipo_cobertura: 'efetivo',
    cobertor_colaborador_id: colabCobertor.id,
    observacoes_operacao: 'Cobertura confirmada pelo Supervisor Carlos Silva no plantão diurno.'
  });
  console.log('Status lançamento com cobertura:', resLancamentoComCob.status);
  console.log('Resposta:', resLancamentoComCob.body);
  if (!resLancamentoComCob.body.success) throw new Error('Falha ao lançar falta com cobertura');

  // TEST 5: Lançar falta SEM COBERTURA (POSTO DESCOBERTO) via Mobile
  console.log('\n--- TESTE 5: POST /api/supervisor/lancar-falta (SEM COBERTURA / POSTO DESCOBERTO) ---');
  const resLancamentoSemCob = await apiRequest('POST', '/api/supervisor/lancar-falta', {
    supervisor_id: sup2.id,
    data_falta: hojeStr,
    cliente_id: clienteTeste.id,
    unidade_id: unidadeTeste.id,
    colaborador_id: colabCobertor.id,
    turno: 'Comercial 5x2 (08h às 17h)',
    motivo_falta: 'Atestado Médico / Licença',
    dias_afastamento: 1,
    cid_atestado: 'J06',
    houve_cobertura: 0,
    motivo_nao_cobertura: 'Reserva Técnica 100% alocada em outros postos',
    observacoes_operacao: 'Aviso recebido às 07:15. Posto ficou descoberto gerando apontamento de glosa.'
  });
  console.log('Status lançamento sem cobertura:', resLancamentoSemCob.status);
  console.log('Resposta:', resLancamentoSemCob.body);
  if (!resLancamentoSemCob.body.success) throw new Error('Falha ao lançar falta sem cobertura');

  // TEST 6: Feed do supervisor no celular
  console.log('\n--- TESTE 6: GET /api/supervisor/minhas-faltas ---');
  const resFeedSup1 = await apiRequest('GET', `/api/supervisor/minhas-faltas?supervisor_id=${sup1.id}`);
  console.log('Status feed:', resFeedSup1.status);
  console.log('Total de lançamentos recentes do supervisor 1:', resFeedSup1.body.length);
  const primeiroLancamento = resFeedSup1.body[0];
  console.log(`Primeiro do feed: ${primeiroLancamento.colaborador_nome} - Houve Cobertura: ${primeiroLancamento.houve_cobertura === 1 ? 'SIM' : 'NÃO'}`);

  // TEST 7: Visão do Sistema Central (SISFAC) na API de Faltas
  console.log('\n--- TESTE 7: GET /api/faltas (Sistema Central com tags de supervisor) ---');
  const resFaltasCentral = await apiRequest('GET', `/api/faltas?mes=${hojeStr.slice(0, 7)}&origem=mobile_supervisor`);
  console.log('Status faltas central:', resFaltasCentral.status);
  console.log('Total de ocorrências mobile recebidas no sistema central:', resFaltasCentral.body.length);
  const fCadastrada = resFaltasCentral.body.find(f => f.id === resLancamentoComCob.body.id);
  console.log('Ocorrência #1 no sistema central:');
  console.log(`- Colaborador: ${fCadastrada?.colaborador_nome}`);
  console.log(`- Apontado Por: ${fCadastrada?.supervisor_exibicao}`);
  console.log(`- Origem: ${fCadastrada?.origem_lancamento}`);
  console.log(`- Cobertura: ${fCadastrada?.houve_cobertura === 1 ? 'Coberto por ' + fCadastrada?.cobertor_efetivo_nome : 'Descoberto'}`);

  // TEST 8: Edição cadastral do supervisor
  console.log('\n--- TESTE 8: PUT /api/supervisores/:id ---');
  const resEdicao = await apiRequest('PUT', `/api/supervisores/${sup1.id}`, {
    nome: 'Carlos Silva (Supervisor 1 - Zona Sul)',
    telefone: '(11) 99999-1111',
    pin: '7788',
    ativo: 1
  });
  console.log('Status edição supervisor:', resEdicao.status, 'Resposta:', resEdicao.body);

  const resSupsPosEdicao = await apiRequest('GET', '/api/supervisores');
  const sup1Atualizado = resSupsPosEdicao.body.find(s => s.id === sup1.id);
  console.log(`Supervisor atualizado: ${sup1Atualizado.nome} | Telefone: ${sup1Atualizado.telefone} | PIN: ${sup1Atualizado.pin}`);

  console.log('\n===============================================================');
  console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! 🎉');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
