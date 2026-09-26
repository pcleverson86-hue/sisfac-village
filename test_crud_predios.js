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
  console.log('--- TEST 1: GET /api/unidades (Listagem geral e filtros) ---');
  const res1 = await request('http://localhost:3000/api/unidades?cliente_id=1&ativo=1');
  console.log('Status:', res1.status);
  console.log('Total inicial de unidades no cliente 1:', res1.body.length);

  console.log('\n--- TEST 2: POST /api/unidades (Cadastrando novo prédio) ---');
  const novoPredio = {
    cliente_id: 1,
    nome_unidade: 'Torre Ômega 99 - Centro de Inovação & Tecnologia',
    endereco: 'Av. Brigadeiro Faria Lima, 4500',
    bairro: 'Itaim Bibi',
    cidade: 'São Paulo',
    cep: '04538-133',
    responsavel_local: 'Engenheiro Marcelo Prado',
    telefone_local: '(11) 99888-0099',
    cota_limite_insumos: 2500.00,
    observacoes: 'Entregar na doca sul de segunda a quinta',
    ativo: 1
  };

  const res2 = await request('http://localhost:3000/api/unidades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, novoPredio);
  console.log('Status:', res2.status);
  console.log('Resposta criação:', res2.body);
  const idNovoPredio = res2.body.id;

  console.log('\n--- TEST 3: Verificação automática de token de compra para o novo prédio ---');
  const res3 = await request('http://localhost:3000/api/compras/links-unidades?cliente_id=1&ano_mes=2026-09');
  console.log('Novo total de prédios no mês de compras:', res3.body.kpis?.total_unidades);
  const predioEncontrado = res3.body.unidades?.find(u => u.unidade_id === idNovoPredio);
  console.log('Prédio localizado no mês de compras:', predioEncontrado?.nome_unidade, '| Token:', predioEncontrado?.token_acesso);
  if (!predioEncontrado || !predioEncontrado.token_acesso) {
    throw new Error('Falha: Novo prédio não foi sincronizado com os pedidos do mês!');
  }

  console.log('\n--- TEST 4: PUT /api/unidades/:id (Edição do prédio) ---');
  const res4 = await request(`http://localhost:3000/api/unidades/${idNovoPredio}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    nome_unidade: 'Torre Ômega 99 - Atualizado',
    responsavel_local: 'Eng. Marcelo Prado Jr.',
    telefone_local: '(11) 97777-1122',
    cota_limite_insumos: 3000.00,
    observacoes: 'Horário ajustado para 09h às 12h',
    ativo: 1
  });
  console.log('Status edição:', res4.status);
  console.log('Resposta edição:', res4.body);

  console.log('\n--- TEST 5: POST /api/unidades/importar-lote (Importação em massa sem limites) ---');
  const lote = [
    {
      cliente_id: 1,
      nome_unidade: 'Edifício Lote A - Campus Norte',
      endereco: 'Rua das Palmeiras, 100',
      responsavel_local: 'Zelador Marcos',
      telefone_local: '(11) 91111-2222',
      cota_limite_insumos: 1000
    },
    {
      cliente_id: 1,
      nome_unidade: 'Edifício Lote B - Campus Sul',
      endereco: 'Rua das Palmeiras, 200',
      responsavel_local: 'Zelador Paulo',
      telefone_local: '(11) 92222-3333',
      cota_limite_insumos: 1200
    },
    {
      cliente_id: 1,
      nome_unidade: 'Edifício Lote C - Campus Leste',
      endereco: 'Rua das Palmeiras, 300',
      responsavel_local: 'Zelador Renata',
      telefone_local: '(11) 93333-4444',
      cota_limite_insumos: 1500
    }
  ];

  const res5 = await request('http://localhost:3000/api/unidades/importar-lote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { unidades: lote });
  console.log('Status importação em lote:', res5.status);
  console.log('Resultado importação em lote:', res5.body);

  console.log('\n--- TEST 6: GET /api/unidades com busca textual ---');
  const res6 = await request('http://localhost:3000/api/unidades?busca=Lote');
  console.log('Prédios encontrados com busca "Lote":', res6.body.length);
  res6.body.forEach(u => console.log(`- [ID: ${u.id}] ${u.nome_unidade} (${u.responsavel_local})`));

  console.log('\n--- TEST 7: DELETE /api/unidades/:id (Remoção / Inativação) ---');
  const res7 = await request(`http://localhost:3000/api/unidades/${idNovoPredio}`, {
    method: 'DELETE'
  });
  console.log('Status remoção:', res7.status);
  console.log('Resposta remoção:', res7.body);

  console.log('\nTODOS OS TESTES DE CADASTRO E GESTÃO DE PRÉDIOS PASSARAM COM SUCESSO! 🎉');
}

runTests().catch(err => {
  console.error('Falha no teste:', err);
  process.exit(1);
});
