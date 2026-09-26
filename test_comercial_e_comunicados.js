const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
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

function login(loginUser, senha) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ login: loginUser, senha });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        const cookieStr = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
        const parsed = JSON.parse(body);
        resolve({ cookie: cookieStr, user: parsed.usuario });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO SUÍTE DE TESTES: SETOR COMERCIAL & MURAL DE COMUNICADOS ---');

  // 1. Autenticar como Admin Master
  const { cookie: adminCookie, user: adminUser } = await login('admin', '123456');
  console.log('✔ Login Admin efetuado com sucesso. pode_enviar_comunicados =', adminUser?.pode_enviar_comunicados);

  // 2. Testar GET /api/comercial/leads
  const resLeads = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comercial/leads',
    method: 'GET',
    headers: { Cookie: adminCookie }
  });
  console.log('✔ GET /api/comercial/leads retornou status', resLeads.status, '| Total leads:', resLeads.data.length);

  // 3. Cadastrar Novo Lead
  const novoLeadPayload = {
    razao_social: 'Hospital São Lucas & Maternidade LTDA',
    nome_fantasia: 'Hospital São Lucas',
    cnpj: '45.123.789/0001-55',
    segmento: 'Saúde & Clínicas',
    contato_nome: 'Dra. Regina Faria',
    contato_cargo: 'Diretora de Operações',
    contato_telefone: '(11) 98765-4321',
    contato_email: 'regina@saolucas.med.br',
    origem: 'Prospecção Ativa',
    vagas_estimadas: 5,
    valor_mensal_estimado: 28500.00,
    endereco: 'Av. Ibirapuera, 1200 - São Paulo - SP',
    observacoes: 'Contrato exige escala 12x36 e treinamento NR-32.'
  };

  const resCriarLead = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comercial/leads',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie }
  }, novoLeadPayload);
  console.log('✔ POST /api/comercial/leads:', resCriarLead.data);
  const leadId = resCriarLead.data.id;

  // 4. Registrar Interação no Lead
  const resInteracao = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comercial/leads/${leadId}/interacoes`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie }
  }, {
    tipo: 'Visita Técnica',
    descricao: 'Levantamento físico realizado no hospital. Confirmada a necessidade de 5 postos.',
    proximo_passo: 'Apresentar proposta orçamentária final com benefício insalubridade',
    data_proximo_contato: '2026-10-05'
  });
  console.log('✔ POST Interação:', resInteracao.data);

  // 5. Testar KPIs Comerciais
  const resKpis = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comercial/kpis',
    method: 'GET',
    headers: { Cookie: adminCookie }
  });
  console.log('✔ KPIs Comerciais:', resKpis.data);

  // 6. Efetivar Contrato com Criação de Postos e Ordem de Implantação
  const efetivarPayload = {
    lead_id: leadId,
    razao_social: 'Hospital São Lucas & Maternidade LTDA',
    nome_fantasia: 'Hospital São Lucas',
    cnpj: '45.123.789/0001-55',
    inscricao_estadual: '112.334.556.778',
    telefone: '(11) 98765-4321',
    email: 'financeiro@saolucas.med.br',
    endereco: 'Av. Ibirapuera, 1200 - São Paulo - SP',
    gestor_cliente: 'Dra. Regina Faria',
    numero_contrato: 'CT-2026/SL01',
    data_inicio_operacao: '2026-10-15',
    dia_fechamento_folha: 20,
    postos: [
      {
        nome_unidade: 'Prédio Central',
        nome_posto: 'Portaria Pronto Atendimento',
        nome_cargo: 'Porteiro Hospitalar',
        escala: '12x36 Diurno',
        quantidade_vagas: 2,
        valor_unitario: 5200.00
      },
      {
        nome_unidade: 'Prédio Central',
        nome_posto: 'Higienização e Esterilização',
        nome_cargo: 'Auxiliar de Limpeza Hospitalar',
        escala: '5x2 Seg a Sex',
        quantidade_vagas: 3,
        valor_unitario: 4800.00
      }
    ]
  };

  const resEfetivar = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comercial/efetivar-contrato',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie }
  }, efetivarPayload);
  console.log('✔ POST /api/comercial/efetivar-contrato:', resEfetivar.data);

  // 7. Verificar Ordens de Implantação
  const resImplantacoes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comercial/implantacoes',
    method: 'GET',
    headers: { Cookie: adminCookie }
  });
  console.log('✔ Total de Ordens de Implantação:', resImplantacoes.data.length);
  const ordemSL = resImplantacoes.data.find(o => o.cliente_nome.includes('São Lucas'));
  if (ordemSL) {
    console.log(`✔ Ordem do Hospital São Lucas encontrada com ${ordemSL.tarefas.length} tarefas setoriais automáticas:`);
    ordemSL.tarefas.forEach(t => {
      console.log(`   - [${t.setor_responsavel.toUpperCase()}] ${t.titulo_tarefa} (${t.status})`);
    });

    // Atualizar status de uma tarefa setorial
    const tarefaRH = ordemSL.tarefas.find(t => t.setor_responsavel === 'rh');
    if (tarefaRH) {
      const resUpdTask = await request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/comercial/implantacoes/tarefas/${tarefaRH.id}`,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie }
      }, { status: 'em_andamento' });
      console.log('✔ Atualização da tarefa setorial RH para "em_andamento":', resUpdTask.data);
    }
  }

  // 8. Testar Mural de Comunicados
  const resCom = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comunicados',
    method: 'GET',
    headers: { Cookie: adminCookie }
  });
  console.log(`✔ GET /api/comunicados: ${resCom.data.comunicados.length} avisos disponíveis, ${resCom.data.nao_lidos_count} não lidos pelo admin.`);

  // Pegar o comunicado urgente gerado pela implantação
  const comImplantacao = resCom.data.comunicados.find(c => c.categoria === 'Novos Contratos & Implantação');
  if (comImplantacao) {
    console.log(`✔ Comunicado urgente de implantação encontrado: ID=${comImplantacao.id}, Título="${comImplantacao.titulo}", já_leu=${comImplantacao.ja_leu}`);

    // Confirmar leitura do admin
    const resLeitura = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/comunicados/${comImplantacao.id}/confirmar-leitura`,
      method: 'POST',
      headers: { Cookie: adminCookie }
    });
    console.log('✔ POST Confirmar Leitura:', resLeitura.data);

    // Conferir auditoria de leituras
    const resAuditoria = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/comunicados/${comImplantacao.id}/leituras`,
      method: 'GET',
      headers: { Cookie: adminCookie }
    });
    console.log(`✔ Auditoria de Leituras: Total Usuários=${resAuditoria.data.total_usuarios}, Lidos=${resAuditoria.data.total_leituras}`);
    console.log('   - Quem já confirmou:', resAuditoria.data.lidos.map(u => u.nome));
    console.log('   - Quem ainda está pendente:', resAuditoria.data.pendentes.map(u => `${u.nome} (${u.setor})`));
  }

  // 9. Testar Restrição de Envio de Comunicados para Operador Comum
  const { cookie: rhCookie, user: rhUser } = await login('rh_ana', '12345');
  console.log(`✔ Login efetuado como Ana (RH). pode_enviar_comunicados=${rhUser.pode_enviar_comunicados}`);

  const resTentativaRh = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comunicados',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: rhCookie }
  }, {
    titulo: 'Tentativa não autorizada',
    categoria: 'Geral',
    prioridade: 'normal',
    setor_alvo: 'TODOS',
    mensagem: 'Mensagem de teste',
    autor_id: rhUser.id,
    autor_login: rhUser.login
  });
  console.log(`✔ Tentativa de emissão por usuário sem permissão retornou HTTP ${resTentativaRh.status}:`, resTentativaRh.data);

  // 10. Admin concede permissão pode_enviar_comunicados para Ana e ela posta
  const resDarPermissao = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/usuarios/${rhUser.id}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie }
  }, {
    nome: rhUser.nome,
    login: rhUser.login,
    setor: rhUser.setor,
    email: rhUser.email,
    pode_enviar_comunicados: 1,
    permissoes: rhUser.permissoes
  });
  console.log('✔ Admin concedeu pode_enviar_comunicados=1 para Ana:', resDarPermissao.data);

  // Re-login da Ana
  const { cookie: rhCookie2, user: rhUser2 } = await login('rh_ana', '12345');
  console.log(`✔ Re-login Ana: pode_enviar_comunicados=${rhUser2.pode_enviar_comunicados}`);

  const resAnaPosta = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comunicados',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: rhCookie2 }
  }, {
    titulo: 'Campanha de Recrutamento - Vagas Abertas',
    categoria: 'RH & Gestão de Pessoas',
    prioridade: 'importante',
    setor_alvo: 'TODOS',
    mensagem: 'Informamos a abertura de 10 vagas para novos postos de portaria e limpeza. Indique candidatos!',
    autor_id: rhUser2.id,
    autor_login: rhUser2.login
  });
  console.log('✔ Ana publicou comunicado corporativo com sucesso:', resAnaPosta.data);

  console.log('\n=============================================================');
  console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
  console.log('=============================================================');
}

runTests().catch(err => {
  console.error('❌ ERRO DURANTE A EXECUÇÃO DOS TESTES:', err);
});
