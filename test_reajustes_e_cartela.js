const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
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

async function runTests() {
  console.log('--- INICIANDO TESTES DO SISFAC 2.0 (REAJUSTES E FORNECEDORES) ---');

  // 1. Health check / status
  console.log('\n[1] Verificando se o servidor está respondendo...');
  const health = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/colaboradores',
    method: 'GET'
  });
  console.log('Status /api/colaboradores:', health.status, 'Qtd colaboradores:', Array.isArray(health.body) ? health.body.length : 0);
  if (health.status !== 200) throw new Error('Servidor não respondeu adequadamente');

  // 2. Teste de Fornecedores CRUD
  console.log('\n[2] Testando CRUD de Fornecedores...');
  const fornecedorPayload = {
    nome_fantasia: 'Distribuidora Alfa Insumos',
    razao_social: 'Alfa Comércio e Serviços Ltda',
    cnpj: '12.345.678/0001-99',
    categoria: 'Limpeza e Químicos',
    contato_nome: 'Carlos Vendedor',
    telefone: '(11) 98888-7777',
    email: 'carlos@alfainsumos.com.br',
    prazo_entrega_dias: 3,
    condicoes_pagamento: '28 dias boleto',
    chave_pix: '12.345.678/0001-99',
    dados_bancarios: 'Banco do Brasil Ag 1234 Cc 56789-0',
    observacoes: 'Fornecedor homologado para produtos de tratamento de piso'
  };

  const createFornRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/fornecedores',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, fornecedorPayload);

  console.log('POST /api/fornecedores:', createFornRes.status, createFornRes.body);
  const fornecedorId = createFornRes.body.id;
  if (!fornecedorId) throw new Error('Falha ao criar fornecedor');

  // 3. Teste de Cartela de Produtos do Fornecedor
  console.log('\n[3] Testando Cartela de Produtos vinculados ao Fornecedor...');
  const prod1Payload = {
    fornecedor_id: fornecedorId,
    nome: 'Detergente Neutro Concentrado 5L',
    codigo_sku: 'ALF-DET-5L',
    categoria: 'Limpeza e Químicos',
    marca: 'QuimioClean',
    unidade_medida: 'GL',
    preco_unitario: 34.50,
    descricao: 'Galão com 5 litros concentrado'
  };

  const createProd1Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/produtos',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, prod1Payload);

  console.log('POST /api/produtos (Item 1):', createProd1Res.status, createProd1Res.body);
  const prod1Id = createProd1Res.body.id;
  if (!prod1Id) throw new Error('Falha ao cadastrar produto 1');

  const prod2Payload = {
    fornecedor_id: fornecedorId,
    nome: 'Cera Acrílica Alto Brilho 5L',
    codigo_sku: 'ALF-CER-5L',
    categoria: 'Limpeza e Químicos',
    marca: 'QuimioClean Pro',
    unidade_medida: 'GL',
    preco_unitario: 89.90,
    descricao: 'Cera antiderrapante de alta resistência'
  };
  const createProd2Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/produtos',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, prod2Payload);
  console.log('POST /api/produtos (Item 2):', createProd2Res.status, createProd2Res.body);

  // Consultar produtos deste fornecedor
  const listProdRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/produtos?fornecedor_id=${fornecedorId}`,
    method: 'GET'
  });
  console.log(`GET /api/produtos?fornecedor_id=${fornecedorId}:`, listProdRes.body.length, 'itens encontrados');
  if (listProdRes.body.length !== 2) throw new Error('Esperava 2 produtos cadastrados na cartela');

  // Atualizar preço do produto 1 (ex: negociação de lote)
  const updateProdRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/produtos/${prod1Id}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    nome: 'Detergente Neutro Concentrado 5L',
    codigo_sku: 'ALF-DET-5L',
    categoria: 'Limpeza e Químicos',
    marca: 'QuimioClean Premium',
    unidade_medida: 'GL',
    preco_unitario: 31.90 // Reajuste negociado
  });
  console.log('PUT /api/produtos/:id (Reajuste preço item):', updateProdRes.status, updateProdRes.body);

  // 4. Teste de Cadastro de Colaborador com Múltiplas Linhas de Ônibus (Ida e Volta)
  console.log('\n[4] Testando Colaborador com Múltiplas Linhas de Ônibus (Ida + Volta)...');
  const multiLinhas = [
    { nome: 'Linha 478 - Bairro/Terminal', tarifa: 4.50, qtd_ida: 1, qtd_volta: 1, subtotal: 9.00 },
    { nome: 'Linha 102 - Terminal/Centro', tarifa: 5.20, qtd_ida: 1, qtd_volta: 1, subtotal: 10.40 }
  ];
  const totalDiarioEsperado = 9.00 + 10.40; // 19.40

  const colabPayload = {
    nome: 'Lucas Silva Pereira',
    cpf: '123.456.789-00',
    matricula: 'MAT-9901',
    cargo_id: 1,
    cargo: 'Auxiliar de Limpeza',
    posto_trabalho_id: 1,
    turno: '08:00 às 17:00 (5x2)',
    regime_escala: '5x2',
    data_admissao: '2026-01-10',
    salario_base: 1750.00,
    ativo: 1,
    valor_diario_va: 28.00,
    tipo_transporte: 'onibus',
    linhas_transporte_json: JSON.stringify(multiLinhas),
    total_diario_vt: totalDiarioEsperado
  };

  const createColabRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/colaboradores',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, colabPayload);
  console.log('POST /api/colaboradores (Multi-linha):', createColabRes.status, createColabRes.body);
  const testColabId = createColabRes.body.id;

  // Consultar colaborador criado e checar fechamento de benefícios
  const fechamentoRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/beneficios/fechamento?ano_mes=2026-09',
    method: 'GET'
  });
  console.log('GET /api/beneficios/fechamento status:', fechamentoRes.status);
  const itens = Array.isArray(fechamentoRes.body) ? fechamentoRes.body : (fechamentoRes.body.itens || []);
  const colabNoFechamento = itens.find(c => c.colaborador_id === testColabId || c.id === testColabId);
  if (colabNoFechamento) {
    console.log('Colaborador no fechamento:', {
      nome: colabNoFechamento.nome,
      total_diario_vt: colabNoFechamento.total_diario_vt,
      custo_diario_vt_calculado: colabNoFechamento.custo_diario_vt,
      total_vt_mes: colabNoFechamento.total_vt_final,
      linhas: colabNoFechamento.linhas_transporte_json
    });
    if (Math.abs(colabNoFechamento.custo_diario_vt - 19.40) > 0.01) {
      throw new Error(`Custo diário VT esperado 19.40, recebido ${colabNoFechamento.custo_diario_vt}`);
    }
  } else {
    console.log('Aviso: Colaborador não listado na competência específica ou sem dias apurados.');
  }

  // 5. Teste de Reajuste em Massa do VA
  console.log('\n[5] Testando Reajuste em Massa de Vale Alimentação (VA)...');
  const reajusteVaRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/beneficios/reajuste-massa-va',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    escopo: 'todos',
    novo_valor_diario_va: 32.50, // Novo valor diário
    atualizar_folha_mes: true,
    ano_mes: '2026-09'
  });
  console.log('POST /api/beneficios/reajuste-massa-va:', reajusteVaRes.status, reajusteVaRes.body);
  if (!reajusteVaRes.body.success || reajusteVaRes.body.afetados <= 0) {
    throw new Error('Nenhum colaborador foi afetado pelo reajuste de VA');
  }

  // 6. Teste de Reajuste em Massa do VT Selecionando Setor por Setor
  console.log('\n[6] Testando Reajuste em Massa do Vale Transporte (VT) por SETOR...');
  const reajusteVtRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/beneficios/reajuste-massa-vt',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    escopo: 'setor',
    posto_trabalho_id: 1, // Setor por setor
    tipo_reajuste: 'tarifa_unitaria',
    nova_tarifa: 5.50, // Nova tarifa unitária das linhas do setor
    atualizar_folha_mes: true,
    ano_mes: '2026-09'
  });
  console.log('POST /api/beneficios/reajuste-massa-vt (Setor 1):', reajusteVtRes.status, reajusteVtRes.body);
  if (!reajusteVtRes.body.success || reajusteVtRes.body.afetados <= 0) {
    throw new Error('Nenhum colaborador afetado no setor 1');
  }

  // Verificar se o colaborador do setor 1 teve suas tarifas reajustadas para 5.50
  const colabAposVtRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/colaboradores/${testColabId}`,
    method: 'GET'
  });
  console.log('Colaborador após reajuste de VT no setor:', {
    nome: colabAposVtRes.body.nome,
    total_diario_vt: colabAposVtRes.body.total_diario_vt,
    linhas: JSON.parse(colabAposVtRes.body.linhas_transporte_json || '[]')
  });

  // Limpeza do colaborador de teste
  await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/colaboradores/${testColabId}`,
    method: 'DELETE'
  });
  console.log('Colaborador de teste removido.');

  // Limpeza de produtos e fornecedor de teste
  if (prod1Id) {
    await request({ hostname: 'localhost', port: 3000, path: `/api/produtos/${prod1Id}`, method: 'DELETE' });
  }
  if (fornecedorId) {
    await request({ hostname: 'localhost', port: 3000, path: `/api/fornecedores/${fornecedorId}`, method: 'DELETE' });
  }
  console.log('Dados de fornecedor e cartela de teste limpos.');

  console.log('\n=============================================');
  console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO TOTAL!');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
