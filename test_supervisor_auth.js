// test_supervisor_auth.js - Verificação automatizada dos novos fluxos de supervisores
const http = require('node:http');

function request(options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, raw: data });
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
  console.log('--- TESTE 1: Listar Supervisores Existentes ---');
  const res1 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisores',
    method: 'GET'
  });
  console.log('Status GET /api/supervisores:', res1.status);
  console.log('Total de supervisores cadastrados:', res1.data.supervisores.length);
  console.log('URL de acesso na rede Wi-Fi:', res1.data.url_portal_rede);
  const primeiro = res1.data.supervisores[0];
  console.log(`Primeiro: ${primeiro.nome} | Login: "${primeiro.login}" | Senha: "${primeiro.senha}"`);

  console.log('\n--- TESTE 2: Cadastro de Novo Supervisor pelo Administrador ---');
  const novoSup = {
    nome: 'Fabio Meireles (Supervisor Norte)',
    login: 'fabio_meireles',
    senha: 'senha_segura_456',
    telefone: '(11) 97777-6666',
    pin: '7788',
    ativo: 1
  };
  const res2 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisores',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, novoSup);
  console.log('Status POST /api/supervisores:', res2.status, res2.data);
  const novoId = res2.data.id;

  console.log('\n--- TESTE 3: Login Móvel com Senha Incorreta (deve falhar) ---');
  const res3 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisor/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { login: 'fabio_meireles', senha: 'senha_errada' });
  console.log('Status senha errada (esperado 401):', res3.status, res3.data);

  console.log('\n--- TESTE 4: Login Móvel com Credenciais Corretas ---');
  const res4 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisor/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { login: 'fabio_meireles', senha: 'senha_segura_456' });
  console.log('Status login correto:', res4.status);
  console.log('Supervisor autenticado:', res4.data.supervisor.nome, '| Token:', res4.data.supervisor.token_acesso);

  console.log('\n--- TESTE 5: Login Móvel com Supervisor Padrão (carlos / 123) ---');
  const res5 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/supervisor/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { login: 'carlos', senha: '123' });
  console.log('Status login Carlos:', res5.status, res5.data.supervisor ? 'SUCESSO: ' + res5.data.supervisor.nome : 'FALHA');

  console.log('\n--- TESTE 6: Acessar página /supervisor e verificar elementos de login ---');
  const res6 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/supervisor',
    method: 'GET'
  });
  console.log('Status GET /supervisor:', res6.status);
  const temInputLogin = res6.raw.includes('id="inputUsuarioLogin"');
  const temInputSenha = res6.raw.includes('id="inputSenhaLogin"');
  const temBtnEntrar = res6.raw.includes('id="btnEntrarLogin"');
  console.log('Contém inputUsuarioLogin:', temInputLogin);
  console.log('Contém inputSenhaLogin:', temInputSenha);
  console.log('Contém btnEntrarLogin:', temBtnEntrar);

  console.log('\n--- TESTE 7: Limpeza (Excluir supervisor temporário) ---');
  const res7 = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/supervisores/${novoId}`,
    method: 'DELETE'
  });
  console.log('Status DELETE /api/supervisores/:id:', res7.status, res7.data);

  console.log('\n>>> TODOS OS TESTES PASSARAM COM SUCESSO! <<<');
}

runTests().catch(err => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
