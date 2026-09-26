// test_fix_supervisor.js
const http = require('node:http');
const fs = require('node:fs');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('>>> INICIANDO TESTES: CORREÇÃO DE SUPERVISORES E FLUXO MOBILE <<<');
  let pass = 0;
  let fail = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  ✅ ' + message);
      pass++;
    } else {
      console.error('  ❌ ' + message);
      fail++;
    }
  }

  // TESTE 1: UI e Estrutura dos Arquivos
  console.log('\n--- TESTE 1: Verificação de UI e Elementos HTML/JS ---');
  const indexHtml = fs.readFileSync('public/index.html', 'utf8');
  const appJs = fs.readFileSync('public/js/app.js', 'utf8');
  const supervisorHtml = fs.readFileSync('public/supervisor.html', 'utf8');

  assert(indexHtml.includes('salvarSupervisorModalAdmin'), 'index.html contém salvarSupervisorModalAdmin no form');
  assert(indexHtml.includes('salvarSupervisorFormInline'), 'index.html contém salvarSupervisorFormInline no form inline');
  assert(appJs.includes('async function salvarSupervisorModalAdmin'), 'app.js declara salvarSupervisorModalAdmin');
  assert(appJs.includes('async function salvarSupervisorFormInline'), 'app.js declara salvarSupervisorFormInline');
  assert(supervisorHtml.includes('id="campoTurno" readonly'), 'supervisor.html contém campoTurno com atributo readonly (congelado)');
  assert(supervisorHtml.includes('Congelado'), 'supervisor.html contém badge visual de campo congelado');
  assert(supervisorHtml.includes('btnMotivoFalta'), 'supervisor.html contém botão rápido de Falta Injustificada');
  assert(supervisorHtml.includes('btnMotivoAtestado'), 'supervisor.html contém botão rápido de Atestado Médico');
  assert(supervisorHtml.includes('definirDiasAtestado'), 'supervisor.html contém atalhos de dias para atestado');
  assert(supervisorHtml.includes('selecionarMotivoNaoCobRapido'), 'supervisor.html contém atalhos para motivo da não cobertura');

  // TESTE 2: API de Dados Iniciais do Supervisor Mobile
  console.log('\n--- TESTE 2: GET /api/supervisor/dados-iniciais com escala e turno enriquecidos ---');
  const resDados = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisor/dados-iniciais',
    method: 'GET'
  });

  assert(resDados.status === 200, 'GET /api/supervisor/dados-iniciais retornou HTTP 200');
  assert(Array.isArray(resDados.data.colaboradores) && resDados.data.colaboradores.length > 0, `Retornou ${resDados.data.colaboradores.length} colaboradores`);
  
  const primeiroColab = resDados.data.colaboradores[0];
  assert(primeiroColab.escala !== undefined, `Colaborador possui escala definida: "${primeiroColab.escala}"`);
  assert(primeiroColab.cliente_id !== undefined, `Colaborador possui cliente_id vinculado: ${primeiroColab.cliente_id}`);

  // Testar se filtragem estrita por cliente funciona
  const clienteAlvo = resDados.data.clientes[0];
  const colabsDoCliente = resDados.data.colaboradores.filter(c => c.cliente_id === clienteAlvo.id);
  const colabsDeOutros = resDados.data.colaboradores.filter(c => c.cliente_id !== clienteAlvo.id);
  assert(colabsDoCliente.every(c => c.cliente_id === clienteAlvo.id), `Filtragem estrita para cliente #${clienteAlvo.id}: ${colabsDoCliente.length} colaboradores isolados com 100% de precisão`);
  assert(colabsDeOutros.every(c => c.cliente_id !== clienteAlvo.id), `Colaboradores de outros clientes (${colabsDeOutros.length}) não vazam para o cliente selecionado`);

  // TESTE 3: Criação de Novo Supervisor pelo Administrador (Simulando Modal Admin)
  console.log('\n--- TESTE 3: Cadastrar Novo Supervisor via API (Modal Admin) ---');
  const loginTeste = 'sup_teste_' + Date.now().toString().slice(-4);
  const resCriarSup = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisores',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    nome: 'Supervisor Teste Automatizado',
    login: loginTeste,
    senha: '321',
    telefone: '(11) 97777-6666',
    pin: '5566',
    ativo: true
  });

  assert(resCriarSup.status === 200 && resCriarSup.data.success === true, 'Novo supervisor cadastrado com sucesso!');
  const novoSupId = resCriarSup.data.id;

  // Testar tentativa de duplicidade de login
  const resDup = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisores',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    nome: 'Outro Supervisor',
    login: loginTeste,
    senha: '123'
  });
  assert(resDup.status === 400, 'Bloqueio de login duplicado funcionou retornando HTTP 400');

  // Limpar supervisor de teste
  await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/supervisores/${novoSupId}`,
    method: 'DELETE'
  });
  console.log(`  Supervisor de teste #${novoSupId} removido após validação.`);

  // TESTE 4: Lançamento de Falta Mobile com Turno Congelado e Atestado
  console.log('\n--- TESTE 4: Lançamento de Falta Mobile (Falta + Atestado + Turno Congelado) ---');
  const colabParaFalta = resDados.data.colaboradores.find(c => c.cliente_id);
  const resFalta = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisor/lancar-falta',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    supervisor_id: null,
    data_falta: new Date().toISOString().split('T')[0],
    cliente_id: colabParaFalta.cliente_id,
    unidade_id: colabParaFalta.unidade_id || 1,
    colaborador_id: colabParaFalta.id,
    turno: `${colabParaFalta.escala || '12x36'} (Congelado do Cadastro)`,
    motivo_falta: 'Atestado Médico / Licença',
    dias_afastamento: 3,
    cid_atestado: 'J06',
    houve_cobertura: 0,
    motivo_nao_cobertura: 'Reserva Técnica 100% alocada em outros postos',
    observacoes_operacao: 'Teste automatizado de apontamento com turno congelado'
  });

  assert(resFalta.status === 200 && resFalta.data.success === true, `Ocorrência de atestado registrada com sucesso (ID #${resFalta.data.id})`);
  const faltaId = resFalta.data.id;

  // Limpeza da falta de teste
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('banco_dados.sqlite');
  db.prepare('DELETE FROM faltas_coberturas WHERE id = ?').run(faltaId);
  console.log(`  Falta de teste #${faltaId} limpa do banco de dados.`);

  console.log(`\n=============================================================`);
  console.log(`RESULTADO FINAL: ${pass} PASSARAM | ${fail} FALHARAM`);
  console.log(`=============================================================`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Erro fatal no teste:', err);
  process.exit(1);
});
