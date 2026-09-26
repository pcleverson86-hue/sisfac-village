const http = require('http');

function request(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- TEST 1: GET /api/clientes ---');
  const res1 = await request('http://localhost:3000/api/clientes');
  console.log('Status:', res1.status);
  console.log('Total de clientes:', res1.body?.length);
  const cli = res1.body[0];
  console.log(`Cliente escolhido: [ID ${cli.id}] ${cli.nome_razao_social || cli.nome_fantasia}`);

  console.log(`\n--- TEST 2: PUT /api/clientes/${cli.id} (Atualizando dados) ---`);
  const payloadUpdate = {
    nome_razao_social: cli.nome_razao_social || 'Razão Social Teste',
    nome_fantasia: cli.nome_fantasia || 'Nome Fantasia Teste',
    cnpj: cli.cnpj || '00.660.903/0001-07',
    contato_responsavel: 'Gestor Atualizado Teste',
    telefone: '(11) 98888-9999',
    email: 'teste.gestor@empresa.com.br',
    cota_mensal_insumos: 8500.00,
    observacoes: 'Observação editada com sucesso no teste automatizado',
    ativo: 1
  };

  const res2 = await request(`http://localhost:3000/api/clientes/${cli.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, payloadUpdate);
  console.log('Status PUT:', res2.status);
  console.log('Resposta PUT:', res2.body);

  console.log('\n--- TEST 3: Verificação dos dados persistidos ---');
  const res3 = await request('http://localhost:3000/api/clientes');
  const cliAtualizado = res3.body.find(c => c.id === cli.id);
  console.log('Novo Contato:', cliAtualizado.contato_responsavel);
  console.log('Novo Telefone:', cliAtualizado.telefone);
  console.log('Novo E-mail:', cliAtualizado.email);
  console.log('Nova Cota:', cliAtualizado.cota_mensal_insumos);
  console.log('Novas Obs:', cliAtualizado.observacoes);

  if (cliAtualizado.contato_responsavel !== payloadUpdate.contato_responsavel ||
      cliAtualizado.telefone !== payloadUpdate.telefone ||
      cliAtualizado.email !== payloadUpdate.email) {
    throw new Error('Falha na persistência da edição do cliente!');
  }

  console.log('\nTESTE DE EDIÇÃO DE CLIENTES PASSOU COM SUCESSO! 🎉');
}

runTests().catch(err => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
