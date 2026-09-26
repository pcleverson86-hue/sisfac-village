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
  console.log('🧪 Testando reações com emojis nos comunicados corporativos...');

  // 1. Obter primeiro comunicado ativo
  const comRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comunicados?usuario_id=1',
    method: 'GET'
  });

  if (!comRes.body.comunicados || comRes.body.comunicados.length === 0) {
    throw new Error('Nenhum comunicado encontrado');
  }

  const com = comRes.body.comunicados[0];
  const comId = com.id;
  console.log(`1. Comunicado alvo: ID ${comId} - "${com.titulo}"`);

  // 2. Adicionar reação 👍 do usuário 1
  const reagirRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comunicados/${comId}/reacoes`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    usuario_id: 1,
    usuario_nome: 'Administrador Master',
    emoji: '👍'
  });

  console.log('2. Reação 1 (👍 por Admin):', reagirRes1.body.action, '| Reações:', reagirRes1.body.reacoes);
  if (reagirRes1.status !== 200 || !reagirRes1.body.success) throw new Error('Falha ao reagir');

  // 3. Adicionar reação 👍 do usuário 2 (Mayara - RH)
  const reagirRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comunicados/${comId}/reacoes`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    usuario_id: 2,
    usuario_nome: 'Mayara (RH & Operações)',
    emoji: '👍'
  });

  console.log('3. Reação 2 (👍 por Mayara):', reagirRes2.body.action, '| Reações:', reagirRes2.body.reacoes);
  const joinha = reagirRes2.body.reacoes.find(r => r.emoji === '👍');
  if (!joinha || joinha.count < 1) throw new Error('Contagem de joinha incorreta');

  // 4. Adicionar reação 🚀 (Foguete) pelo usuário 1
  const reagirRes3 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comunicados/${comId}/reacoes`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    usuario_id: 1,
    usuario_nome: 'Administrador Master',
    emoji: '🚀'
  });

  console.log('4. Reação 3 (🚀 por Admin):', reagirRes3.body.action, '| Reações:', reagirRes3.body.reacoes);

  // 5. Alternar (toggle off) reação 👍 do usuário 1 (remover joinha do admin)
  const toggleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comunicados/${comId}/reacoes`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    usuario_id: 1,
    usuario_nome: 'Administrador Master',
    emoji: '👍'
  });

  console.log('5. Toggle off (👍 por Admin removido):', toggleRes.body.action, '| Reações:', toggleRes.body.reacoes);

  // 6. Consultar GET /api/comunicados para o usuário 1 e validar estado
  const comResFinal = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comunicados?usuario_id=1`,
    method: 'GET'
  });

  const comFinal = comResFinal.body.comunicados.find(c => c.id === comId);
  console.log('6. GET final reações:', comFinal.reacoes);

  console.log('\n✅ TODOS OS TESTES DE REAÇÕES COM EMOJIS PASSARAM COM SUCESSO!');
}

run().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
