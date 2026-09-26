const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('🧪 Iniciando teste de restauração de Admin & Usuários...');

  // 1. Login com admin
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { login: 'admin', senha: '123456' });

  console.log('1. Login status:', loginRes.status);
  console.log('   Usuário:', loginRes.body.usuario?.nome, '| Setor:', loginRes.body.usuario?.setor, '| Comunicados:', loginRes.body.usuario?.pode_enviar_comunicados);
  const temModUsuarios = (loginRes.body.permissoes || []).some(p => p.modulo === 'usuarios');
  console.log('   Tem permissão modulo usuarios na DB:', temModUsuarios);

  if (loginRes.status !== 200) throw new Error('Falha no login do admin');

  // 2. Buscar lista de usuários
  const usersRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/usuarios',
    method: 'GET'
  });
  console.log('2. GET /api/usuarios status:', usersRes.status, '| Total operadores:', usersRes.body?.length);
  if (usersRes.status !== 200 || !Array.isArray(usersRes.body)) throw new Error('Falha ao listar usuários');

  // 3. Buscar supervisores
  const supRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/supervisores',
    method: 'GET'
  });
  const supervisoresList = Array.isArray(supRes.body) ? supRes.body : supRes.body.supervisores;
  console.log('3. GET /api/supervisores status:', supRes.status, '| Total supervisores:', supervisoresList?.length);
  if (supRes.status !== 200 || !Array.isArray(supervisoresList)) throw new Error('Falha ao listar supervisores');

  // 4. Buscar setores
  const setRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/setores',
    method: 'GET'
  });
  console.log('4. GET /api/setores status:', setRes.status, '| Total setores:', setRes.body?.length);
  if (setRes.status !== 200 || !Array.isArray(setRes.body)) throw new Error('Falha ao listar setores');

  console.log('\n✅ TODOS OS TESTES PASSARAM COM SUCESSO! O módulo Admin & Usuários está 100% operacional.');
}

run().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
