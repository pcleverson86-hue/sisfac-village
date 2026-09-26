// test_freelancers_dossie_lixeira.js
// Valida o conjunto de funcionalidades: Edição de Freelancers, Dossiê com quem lançou,
// Edição de Diárias, Soft-Delete com quem excluiu e Permissão exclusiva do Admin Master para purgar.

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('=== INICIANDO BATERIA DE TESTES: FREELANCERS, DOSSIÊ & LIXEIRA DE AUDITORIA ===\n');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch(e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  let allOk = true;

  // 1. VERIFICAÇÃO ESTÁTICA DO FRONTEND
  console.log('--- 1. Verificando Elementos no HTML e Funções no JS ---');
  const htmlContent = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const jsContent = fs.readFileSync(path.join(__dirname, 'public', 'js', 'app.js'), 'utf8');

  const requiredHtml = [
    'modalEditarFreelancer',
    'modalDossieFreelancer',
    'modalEditarDiariaFreelancer',
    'tabelaLixeiraGlobalFreelancersCorpo',
    'badgeQtdLixeiraGlobal',
    'dossieTabelaServicosCorpo',
    'dossieTabelaExcluidosCorpo',
    'editFreeTelefone',
    'editFreeValor'
  ];

  requiredHtml.forEach(el => {
    if (htmlContent.includes(el)) {
      console.log(`✅ [HTML] Encontrado: ${el}`);
    } else {
      console.error(`❌ [HTML] Faltando: ${el}`);
      allOk = false;
    }
  });

  const requiredJs = [
    'function abrirModalEditarFreelancer',
    'function salvarEdicaoFreelancer',
    'function abrirDossieFreelancer',
    'function carregarDossieFreelancer',
    'function abrirModalEditarDiaria',
    'function salvarEdicaoDiaria',
    'function excluirDiariaSoft',
    'function restaurarDiaria',
    'function purgarDiariaDefinitivo',
    'function carregarLixeiraGlobalFreelancers'
  ];

  requiredJs.forEach(fn => {
    if (jsContent.includes(fn)) {
      console.log(`✅ [JS] Encontrada: ${fn}`);
    } else {
      console.error(`❌ [JS] Faltando: ${fn}`);
      allOk = false;
    }
  });

  // 2. TESTE DE EDIÇÃO DE FREELANCER (PUT /api/freelancers/:id)
  console.log('\n--- 2. Testando Edição de Cadastro de Freelancer (PUT /api/freelancers/:id) ---');
  const resFrees = await request({ hostname: '127.0.0.1', port: 3000, path: '/api/freelancers', method: 'GET' });
  if (resFrees.status !== 200 || !Array.isArray(resFrees.data) || resFrees.data.length === 0) {
    console.error('❌ Falha ao buscar lista de freelancers');
    allOk = false;
    return;
  }

  const freeTeste = resFrees.data[0];
  console.log(`Testando com Freelancer: "${freeTeste.nome}" (ID: ${freeTeste.id})`);

  const novoTelefone = '(11) 98888-7766';
  const novoValorDiaria = 175.50;

  const resEditFree = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/freelancers/${freeTeste.id}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    nome: freeTeste.nome,
    cpf: freeTeste.cpf || '123.456.789-00',
    cargo_preferencial_id: freeTeste.cargo_preferencial_id,
    telefone: novoTelefone,
    tipo_chave_pix: freeTeste.tipo_chave_pix || 'Telefone',
    chave_pix: '11988887766',
    banco: 'Banco Inter',
    valor_diaria_padrao: novoValorDiaria,
    observacoes: 'Atualizado via teste automatizado'
  });

  if (resEditFree.status === 200 && resEditFree.data.success) {
    console.log(`✅ Freelancer atualizado com sucesso! (Telefone: ${novoTelefone}, Valor: R$ ${novoValorDiaria})`);
  } else {
    console.error('❌ Falha ao atualizar freelancer:', resEditFree);
    allOk = false;
  }

  // 3. TESTE DE CRIAÇÃO DE DIÁRIA COM RASTREIO DE QUEM LANÇOU
  console.log('\n--- 3. Testando Criação de Diária com Identificação de Quem Lançou ---');
  const resColabs = await request({ hostname: '127.0.0.1', port: 3000, path: '/api/colaboradores', method: 'GET' });
  const colabValido = (Array.isArray(resColabs.data) && resColabs.data.length > 0) ? resColabs.data[0] : { id: 7, cliente_id: 1, unidade_id: 1, cargo_id: 4 };

  const resPostFalta = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/faltas',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    data_falta: '2026-09-22',
    cliente_id: colabValido.cliente_id || 1,
    unidade_id: colabValido.unidade_id || 1,
    cargo_id: colabValido.cargo_id || 1,
    colaborador_id: colabValido.id,
    motivo_falta: 'Falta Justificada',
    houve_cobertura: 1,
    tipo_cobertura: 'freelancer',
    freelancer_id: freeTeste.id,
    valor_pago_freelance: 175.50,
    turno: '12x36 Diurno',
    supervisor_nome: 'Marcos Oliveira (Supervisor Campo)',
    criado_por: 'Marcos Oliveira (Supervisor Campo)',
    origem_lancamento: 'mobile_supervisor'
  });

  if (resPostFalta.status !== 200 || !resPostFalta.data.id) {
    console.error('❌ Falha ao criar diária de teste:', resPostFalta);
    allOk = false;
    return;
  }

  const faltaId = resPostFalta.data.id;
  console.log(`✅ Diária de teste criada com ID: ${faltaId}`);

  // 4. TESTE DE CONSULTA DO DOSSIÊ DO FREELANCER (GET /api/freelancers/:id/dossie)
  console.log('\n--- 4. Testando Consulta do Dossiê Completo (GET /api/freelancers/:id/dossie) ---');
  const resDossie = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/freelancers/${freeTeste.id}/dossie`,
    method: 'GET'
  });

  if (resDossie.status === 200 && resDossie.data.freelancer) {
    const servico = resDossie.data.servicos.find(s => s.id === faltaId);
    if (servico && servico.quem_lancou.includes('Marcos Oliveira')) {
      console.log(`✅ Dossiê retornou diária corretamente com "quem_lancou": "${servico.quem_lancou}"`);
    } else {
      console.error('❌ Diária não encontrada no dossiê ou campo "quem_lancou" incorreto:', servico);
      allOk = false;
    }
  } else {
    console.error('❌ Falha ao carregar dossiê do freelancer:', resDossie);
    allOk = false;
  }

  // 5. TESTE DE EDIÇÃO DA DIÁRIA (PUT /api/faltas/:id)
  console.log('\n--- 5. Testando Edição de Diária (PUT /api/faltas/:id) ---');
  const resEditDiaria = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/faltas/${faltaId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    valor_pago_freelance: 190.00,
    turno: 'Noturno',
    observacoes_operacao: 'Adicional noturno aplicado pelo RH',
    atualizado_por: 'Mariana (RH)'
  });

  if (resEditDiaria.status === 200 && resEditDiaria.data.success) {
    console.log('✅ Diária editada com sucesso! Valor ajustado para R$ 190,00 e atualizado_por: "Mariana (RH)"');
  } else {
    console.error('❌ Falha ao editar diária:', resEditDiaria);
    allOk = false;
  }

  // 6. TESTE DE SOFT DELETE (DELETE /api/faltas/:id COM QUEM EXCLUIU)
  console.log('\n--- 6. Testando Soft-Delete (Mover para Lixeira com Rastreio de Quem Excluiu) ---');
  const resDeleteSoft = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/faltas/${faltaId}?usuario_nome=${encodeURIComponent('Carlos Supervisor')}&motivo=${encodeURIComponent('Escala cancelada pelo cliente')}`,
    method: 'DELETE'
  });

  if (resDeleteSoft.status === 200 && resDeleteSoft.data.soft_delete) {
    console.log('✅ Diária movida com sucesso para a lixeira (Soft-Delete)!');
  } else {
    console.error('❌ Falha no soft delete da diária:', resDeleteSoft);
    allOk = false;
  }

  // Verificar se saiu da listagem ativa e foi para os excluídos no dossiê
  const resDossieAposDelete = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/freelancers/${freeTeste.id}/dossie`,
    method: 'GET'
  });

  const estaNosAtivos = resDossieAposDelete.data.servicos.some(s => s.id === faltaId);
  const excluidoObj = resDossieAposDelete.data.excluidos.find(s => s.id === faltaId);

  if (!estaNosAtivos && excluidoObj && excluidoObj.excluido_por === 'Carlos Supervisor') {
    console.log(`✅ Confirmado: Diária saiu dos ativos e consta nos excluídos com excluído_por: "${excluidoObj.excluido_por}" e motivo: "${excluidoObj.motivo_exclusao}"`);
  } else {
    console.error('❌ Diária ainda consta nos ativos ou não está nos excluídos:', { estaNosAtivos, excluidoObj });
    allOk = false;
  }

  // 7. TESTE DA LIXEIRA GLOBAL (GET /api/freelancers/lixeira)
  console.log('\n--- 7. Testando Lixeira Global de Diárias (GET /api/freelancers/lixeira) ---');
  const resLixeira = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/freelancers/lixeira',
    method: 'GET'
  });

  if (resLixeira.status === 200 && Array.isArray(resLixeira.data) && resLixeira.data.some(d => d.id === faltaId)) {
    console.log(`✅ Diária ${faltaId} encontrada na Lixeira Global de Auditoria!`);
  } else {
    console.error('❌ Diária não encontrada na lixeira global');
    allOk = false;
  }

  // 8. TESTE DE RESTAURAÇÃO DA DIÁRIA (POST /api/faltas/:id/restaurar)
  console.log('\n--- 8. Testando Restauração de Diária (POST /api/faltas/:id/restaurar) ---');
  const resRestaurar = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/faltas/${faltaId}/restaurar`,
    method: 'POST'
  });

  if (resRestaurar.status === 200 && resRestaurar.data.success) {
    console.log('✅ Diária restaurada com sucesso!');
  } else {
    console.error('❌ Falha ao restaurar diária:', resRestaurar);
    allOk = false;
  }

  // Colocar novamente na lixeira para testar a purga / exclusão definitiva
  await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/faltas/${faltaId}?usuario_nome=TesteAdmin&motivo=ExcluirDefinitivo`,
    method: 'DELETE'
  });

  // 9. TESTE DE PERMISSÃO PARA EXCLUSÃO DEFINITIVA (ADMIN MASTER)
  console.log('\n--- 9. Testando Permissões de Exclusão Definitiva (Hard Delete / Purgar) ---');
  // Tentativa sem ser Admin Master (deve falhar com HTTP 403)
  const resPurgaNaoAdmin = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/faltas/${faltaId}/purgar`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    usuario_login: 'marcos',
    usuario_setor: 'supervisor'
  });

  if (resPurgaNaoAdmin.status === 403) {
    console.log('✅ Bloqueio correto: Usuário não-admin recebeu HTTP 403 (Acesso Negado)!');
  } else {
    console.error('❌ Falha na segurança: Usuário não-admin não foi bloqueado!', resPurgaNaoAdmin);
    allOk = false;
  }

  // Tentativa como Admin Master (deve permitir com HTTP 200)
  const resPurgaAdmin = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/faltas/${faltaId}/purgar`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    usuario_login: 'admin',
    usuario_setor: 'admin'
  });

  if (resPurgaAdmin.status === 200 && resPurgaAdmin.data.hard_delete) {
    console.log('✅ Autorização de Admin Master confirmada: Registro excluído definitivamente do banco de dados!');
  } else {
    console.error('❌ Falha na exclusão definitiva pelo Admin Master:', resPurgaAdmin);
    allOk = false;
  }

  console.log('\n========================================================================');
  if (allOk) {
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! 🎉');
  } else {
    console.error('⚠️ ALGUNS TESTES FALHARAM!');
  }
  console.log('========================================================================\n');

  process.exit(allOk ? 0 : 1);
}

runTests().catch(err => {
  console.error('Erro fatal no teste:', err);
  process.exit(1);
});
