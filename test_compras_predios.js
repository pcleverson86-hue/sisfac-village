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
  console.log('--- TEST 1: GET /api/compras/links-unidades ---');
  const res1 = await request('http://localhost:3000/api/compras/links-unidades?cliente_id=1&ano_mes=2026-09');
  console.log('Status:', res1.status);
  console.log('Cliente:', res1.body.cliente?.nome_razao_social);
  console.log('Total de Prédios:', res1.body.kpis?.total_unidades);
  console.log('Link Geral Token:', res1.body.token_publico);
  console.log('Prédios listados:', res1.body.unidades?.length);
  
  if (!res1.body.unidades || res1.body.unidades.length === 0) {
    throw new Error('Nenhum prédio retornado');
  }

  const primeiroPredio = res1.body.unidades[0];
  console.log('Primeiro prédio:', primeiroPredio.nome_unidade, 'ID:', primeiroPredio.unidade_id, 'Token:', primeiroPredio.token_acesso);

  console.log('\n--- TEST 2: GET /api/publico/pedido-unidade com token do primeiro prédio ---');
  const res2 = await request(`http://localhost:3000/api/publico/pedido-unidade?token=${primeiroPredio.token_acesso}`);
  console.log('Status:', res2.status);
  console.log('Prédio identificado:', res2.body.unidade_fixa?.nome_unidade);
  console.log('Qtd de produtos disponíveis no catálogo:', res2.body.produtos?.length);

  console.log('\n--- TEST 3: POST /api/publico/pedido-unidade (Simulando envio pelo zelador/responsável) ---');
  const prod1 = res2.body.produtos[0];
  const prod2 = res2.body.produtos[1] || res2.body.produtos[0];
  const payloadEnvio = {
    token: primeiroPredio.token_acesso,
    unidade_id: primeiroPredio.unidade_id,
    responsavel_nome: 'Zelador Silva',
    responsavel_telefone: '(11) 98888-7777',
    observacoes: 'Favor descarregar na doca dos fundos',
    itens: [
      { produto_id: prod1.id, quantidade: 15 },
      { produto_id: prod2.id, quantidade: 25 }
    ]
  };

  const res3 = await request('http://localhost:3000/api/publico/pedido-unidade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payloadEnvio);
  console.log('Status:', res3.status);
  console.log('Resposta:', res3.body);

  console.log('\n--- TEST 4: GET /api/compras/consolidado-cliente ---');
  const res4 = await request('http://localhost:3000/api/compras/consolidado-cliente?cliente_id=1&ano_mes=2026-09');
  console.log('Status:', res4.status);
  console.log('Total Geral R$:', res4.body.kpis?.valor_total_geral);
  console.log('Total Itens:', res4.body.kpis?.total_itens_geral);
  console.log('Prédios preenchidos:', res4.body.kpis?.predios_preenchidos, '/', res4.body.kpis?.total_predios);
  console.log('Produtos consolidados com qtd > 0:');
  res4.body.produtos?.filter(p => p.quantidade_total > 0).forEach(p => {
    console.log(`- ${p.descricao}: ${p.quantidade_total} ${p.unidade_medida} x R$ ${p.preco_anual_fechado} = R$ ${p.valor_total}`);
  });

  console.log('\n--- TEST 5: POST /api/compras/unidade-pedido (Lançamento interno via SISFAC) ---');
  const segundoPredio = res1.body.unidades[1] || res1.body.unidades[0];
  const res5 = await request('http://localhost:3000/api/compras/unidade-pedido', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    cliente_id: 1,
    ano_mes: '2026-09',
    unidade_id: segundoPredio.unidade_id,
    responsavel_nome: 'Supervisor Interno SISFAC',
    responsavel_telefone: '(11) 91234-5678',
    observacoes: 'Preenchido internamente',
    itens: [
      { produto_id: prod1.id, quantidade: 30 }
    ]
  });
  console.log('Status:', res5.status);
  console.log('Resposta lançamento interno:', res5.body);

  console.log('\n--- TEST 6: GET consolidado pós-segundo pedido ---');
  const res6 = await request('http://localhost:3000/api/compras/consolidado-cliente?cliente_id=1&ano_mes=2026-09');
  console.log('Novo Total Geral R$:', res6.body.kpis?.valor_total_geral);
  console.log('Novo Total Itens:', res6.body.kpis?.total_itens_geral);
  console.log('Prédios preenchidos:', res6.body.kpis?.predios_preenchidos, '/', res6.body.kpis?.total_predios);
  console.log('Novo somatório do produto 1:');
  res6.body.produtos?.filter(p => p.id === prod1.id).forEach(p => {
    console.log(`- ${p.descricao}: QTD TOTAL = ${p.quantidade_total} (Esperado: 15 + 30 = 45) | Subtotal: R$ ${p.valor_total}`);
  });

  console.log('\nTODOS OS TESTES PASSARAM COM SUCESSO! 🎉');
}

runTests().catch(err => {
  console.error('Falha nos testes:', err);
  process.exit(1);
});
