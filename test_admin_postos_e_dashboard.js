const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
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
  console.log('=== INICIANDO TESTES: POSTOS ADMIN MASTER & DASHBOARD EXPLORER ===\n');

  // 1. Obter lista de postos existentes
  const resPostos = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/postos',
    method: 'GET'
  });
  console.log(`[1] Listagem de postos: HTTP ${resPostos.status}, encontrados: ${resPostos.data.length}`);
  if (!resPostos.data || resPostos.data.length === 0) {
    throw new Error('Nenhum posto encontrado para teste.');
  }

  const testPosto = resPostos.data[0];
  console.log(`Posto de teste selecionado: ID #${testPosto.id}, Nome: "${testPosto.nome_posto}", Vagas atuais: ${testPosto.quantidade_vagas_limite}, Ocupadas: ${testPosto.total_ocupados}`);

  // 2. Testar GET /api/postos/:id
  const resGetPosto = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/postos/${testPosto.id}`,
    method: 'GET'
  });
  console.log(`[2] GET /api/postos/${testPosto.id}: HTTP ${resGetPosto.status}`);
  if (resGetPosto.status !== 200 || !resGetPosto.data.id) {
    throw new Error('Falha ao obter dados do posto específico.');
  }
  console.log(`    Dados recebidos: Cliente: "${resGetPosto.data.cliente_nome}", Vagas: ${resGetPosto.data.quantidade_vagas_limite}, Total Ocupados: ${resGetPosto.data.total_ocupados}`);

  // 3. Testar PUT /api/postos/:id com usuário NÃO-ADMIN (ex: setor RH)
  const resPutNonAdmin = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/postos/${testPosto.id}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario-Login': 'ana.rh',
      'X-Usuario-Setor': 'rh'
    }
  }, {
    nome_posto: testPosto.nome_posto + ' Modificado',
    quantidade_vagas_limite: testPosto.quantidade_vagas_limite + 1,
    cargo_id: testPosto.cargo_id,
    usuario_login: 'ana.rh',
    usuario_setor: 'rh'
  });

  console.log(`[3] PUT /api/postos/${testPosto.id} com setor 'rh': HTTP ${resPutNonAdmin.status}`);
  if (resPutNonAdmin.status === 403) {
    console.log(`    SUCESSO: Bloqueado com HTTP 403 - "${resPutNonAdmin.data.error}"`);
  } else {
    throw new Error(`Esperava HTTP 403 para não-admin, mas recebeu HTTP ${resPutNonAdmin.status}`);
  }

  // 4. Testar PUT /api/postos/:id com ADMIN MASTER tentando reduzir abaixo dos ocupados
  if (testPosto.total_ocupados > 0) {
    const resPutAbaixoOcupados = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/postos/${testPosto.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario-Login': 'admin',
        'X-Usuario-Setor': 'admin'
      }
    }, {
      nome_posto: testPosto.nome_posto,
      quantidade_vagas_limite: 0, // Abaixo dos ocupados
      cargo_id: testPosto.cargo_id,
      usuario_login: 'admin',
      usuario_setor: 'admin'
    });

    console.log(`[4] PUT com vagas < ocupados: HTTP ${resPutAbaixoOcupados.status}`);
    if (resPutAbaixoOcupados.status === 400) {
      console.log(`    SUCESSO: Bloqueado com HTTP 400 - "${resPutAbaixoOcupados.data.error}"`);
    } else {
      throw new Error(`Esperava HTTP 400 para redução indevida de vagas, recebeu HTTP ${resPutAbaixoOcupados.status}`);
    }
  } else {
    console.log('[4] Posto de teste sem ocupantes, pulando validação de redução de vagas abaixo de ocupados.');
  }

  // 5. Testar PUT /api/postos/:id com ADMIN MASTER (Aditivo Contratual / aumento de quadro)
  const novoLimiteVagas = Math.max(testPosto.quantidade_vagas_limite, (testPosto.total_ocupados || 0)) + 1;
  const resPutAdminOk = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/postos/${testPosto.id}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario-Login': 'admin',
      'X-Usuario-Setor': 'admin'
    }
  }, {
    nome_posto: testPosto.nome_posto,
    quantidade_vagas_limite: novoLimiteVagas,
    cargo_id: testPosto.cargo_id,
    escala: testPosto.escala || '5x2',
    turno: testPosto.turno || 'Comercial',
    observacoes: 'Aditivo Contratual nº 01/2026 - Aumento de quadro autorizado',
    ativo: 1,
    usuario_login: 'admin',
    usuario_setor: 'admin'
  });

  console.log(`[5] PUT com Admin Master: HTTP ${resPutAdminOk.status}`);
  if (resPutAdminOk.status === 200 && resPutAdminOk.data.success) {
    console.log(`    SUCESSO: Posto atualizado com sucesso! Mensagem: "${resPutAdminOk.data.message}"`);
  } else {
    throw new Error(`Falha ao atualizar posto com Admin Master: HTTP ${resPutAdminOk.status} - ${JSON.stringify(resPutAdminOk.data)}`);
  }

  // 6. Testar /api/dashboard/executivo e verificar 'undefined'
  const resDash = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/dashboard/executivo',
    method: 'GET'
  });
  console.log(`[6] Dashboard Executivo: HTTP ${resDash.status}`);
  if (resDash.status !== 200 || !resDash.data.topFaltasClientes) {
    throw new Error('Falha ao obter dados do Dashboard Executivo');
  }

  console.log(`    Clientes com faltas no dashboard: ${resDash.data.topFaltasClientes.length}`);
  resDash.data.topFaltasClientes.forEach((item, idx) => {
    console.log(`    Ranking #${idx + 1}: ID=${item.cliente_id}, cliente_nome="${item.cliente_nome}", nome_fantasia="${item.nome_fantasia}", Faltas=${item.total_faltas}, Glosas=${item.faltas_glosa}`);
    if (item.cliente_nome === undefined || item.cliente_nome === null || item.cliente_nome === 'undefined') {
      throw new Error(`Erro: cliente_nome é inválido/undefined no ranking de faltas (item #${idx + 1})`);
    }
    if (item.nome_fantasia === undefined || item.nome_fantasia === null || item.nome_fantasia === 'undefined') {
      throw new Error(`Erro: nome_fantasia é inválido/undefined no ranking de faltas (item #${idx + 1})`);
    }
  });
  console.log('    SUCESSO: Nenhum cliente retornado como undefined no Dashboard!');

  // 7. Testar /api/faltas para o Explorador do Dashboard
  const resFaltasExplorar = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/faltas',
    method: 'GET'
  });
  console.log(`[7] Explorador /api/faltas: HTTP ${resFaltasExplorar.status}, total registros: ${resFaltasExplorar.data.length}`);
  if (resFaltasExplorar.status !== 200 || !Array.isArray(resFaltasExplorar.data)) {
    throw new Error('Falha ao consultar ocorrências para o explorador.');
  }

  if (resFaltasExplorar.data.length > 0) {
    const amostra = resFaltasExplorar.data[0];
    console.log(`    Amostra de ocorrência no Explorador:`);
    console.log(`    Data: ${amostra.data_falta}, Cliente: "${amostra.cliente_nome}", Posto: "${amostra.nome_posto || amostra.nome_cargo}", Colab: "${amostra.colaborador_nome}"`);
    console.log(`    Houve Cobertura: ${amostra.houve_cobertura}, Tipo: "${amostra.tipo_cobertura}", Quem cobriu: "${amostra.cobertor_efetivo_nome || amostra.freelancer_nome || 'N/A'}"`);
    console.log(`    Glosa: R$ ${amostra.valor_desconto_sugerido}, Custo Freelance: R$ ${amostra.valor_pago_freelance}, Criado Por: "${amostra.criado_por || amostra.supervisor_exibicao}"`);
  }

  // 8. Testar filtro por tipo_cobertura no explorador
  const resFaltasDescoberto = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/faltas?tipo_cobertura=descoberto',
    method: 'GET'
  });
  console.log(`[8] Filtro tipo_cobertura=descoberto: HTTP ${resFaltasDescoberto.status}, registros: ${resFaltasDescoberto.data.length}`);
  resFaltasDescoberto.data.forEach(item => {
    if (item.houve_cobertura !== 0) {
      throw new Error(`Esperava houve_cobertura === 0 para filtro 'descoberto', mas obteve: ${item.houve_cobertura}`);
    }
  });
  console.log('    SUCESSO: Filtro de postos descobertos / glosas funcionando perfeitamente!');

  console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! 100% OPERACIONAL ===');
}

runTests().catch(err => {
  console.error('\n❌ ERRO NO TESTE:', err);
  process.exit(1);
});
