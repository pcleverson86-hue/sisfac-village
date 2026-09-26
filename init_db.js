// init_db.js - Inicialização e Migração Completa do Banco de Dados SQLite (SISFAC 2.0)
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

function resolverDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.RENDER) {
    try { fs.accessSync('/var/data', fs.constants.W_OK); return '/var/data/banco_dados.sqlite'; } catch (e) {}
    return '/tmp/banco_dados.sqlite';
  }
  return path.join(__dirname, 'banco_dados.sqlite');
}

const dbPath = resolverDbPath();
const db = new DatabaseSync(dbPath);

console.log('Atualizando e inicializando estrutura de tabelas no SQLite...');
console.log('[DB] Caminho do banco:', dbPath);

// Desabilitar foreign keys durante a criação das tabelas e inserção de dados iniciais
// Isso evita erros de constraint em bancos vazios (ex: Render, primeiro deploy)
db.exec('PRAGMA foreign_keys = OFF;');
db.exec('PRAGMA journal_mode = WAL;');

// 1. Tabela de Usuários do Sistema (Login & Senha)
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    setor TEXT NOT NULL, -- 'admin', 'rh', 'faturamento', 'compras', 'beneficios', 'diretoria'
    email TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 2. Permissões Granulares por Usuário (Checkboxes de Módulos & Ações)
db.exec(`
  CREATE TABLE IF NOT EXISTS permissoes_usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    modulo TEXT NOT NULL, -- 'faltas', 'faturamento', 'freelancers', 'diretoria', 'compras', 'beneficios', 'cadastros', 'postos', 'ferias', 'usuarios'
    pode_visualizar INTEGER DEFAULT 1,
    pode_criar INTEGER DEFAULT 1,
    pode_editar INTEGER DEFAULT 1,
    pode_excluir INTEGER DEFAULT 1,
    pode_aprovar INTEGER DEFAULT 0,
    UNIQUE(usuario_id, modulo),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );
`);

// 3. Tabela de Clientes
db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT,
    contato_responsavel TEXT,
    telefone TEXT,
    email TEXT,
    cota_mensal_insumos REAL DEFAULT 0,
    observacoes TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 4. Tabela de Unidades / Locais
db.exec(`
  CREATE TABLE IF NOT EXISTS unidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    nome_unidade TEXT NOT NULL,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    cep TEXT,
    responsavel_local TEXT,
    telefone_local TEXT,
    cota_limite_insumos REAL DEFAULT 0,
    observacoes TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
  );
`);

// 5. Tabela de Cargos / Funções
db.exec(`
  CREATE TABLE IF NOT EXISTS cargos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_cargo TEXT NOT NULL UNIQUE,
    descricao TEXT,
    valor_diaria_referencia REAL DEFAULT 0,
    ativo INTEGER DEFAULT 1
  );
`);

// 6. Tabela de Postos de Trabalho com Trava de Lotação Contratada
db.exec(`
  CREATE TABLE IF NOT EXISTS postos_trabalho (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    unidade_id INTEGER,
    nome_posto TEXT NOT NULL,
    cargo_id INTEGER NOT NULL,
    quantidade_vagas_limite INTEGER NOT NULL DEFAULT 1, -- Limite contratual rígido
    escala TEXT DEFAULT '5x2', -- '5x2', '6x1', '12x36'
    turno TEXT DEFAULT 'Diurno',
    observacoes TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (unidade_id) REFERENCES unidades(id),
    FOREIGN KEY (cargo_id) REFERENCES cargos(id)
  );
`);

// 7. Tabela de Colaboradores Efetivos (com Férias e Benefícios)
db.exec(`
  CREATE TABLE IF NOT EXISTS colaboradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT,
    cargo_id INTEGER NOT NULL,
    cliente_id INTEGER,
    unidade_id INTEGER,
    posto_trabalho_id INTEGER,
    escala TEXT DEFAULT '5x2',
    data_admissao DATE,
    limite_ferias_vencimento DATE,
    telefone TEXT,
    email TEXT,
    linhas_onibus TEXT,
    quantidade_passagens_dia INTEGER DEFAULT 2,
    valor_passagem_unitaria REAL DEFAULT 4.40,
    valor_diario_va REAL DEFAULT 28.00,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (unidade_id) REFERENCES unidades(id),
    FOREIGN KEY (posto_trabalho_id) REFERENCES postos_trabalho(id)
  );

  CREATE TABLE IF NOT EXISTS escalas_trabalho (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    tipo TEXT DEFAULT 'Semanal',
    carga_horaria_semanal REAL DEFAULT 44,
    carga_horaria_diaria REAL DEFAULT 8.8,
    dias_semana_json TEXT DEFAULT '["seg","ter","qua","qui","sex"]',
    horario_entrada TEXT DEFAULT '08:00',
    horario_saida TEXT DEFAULT '17:48',
    intervalo_minutos INTEGER DEFAULT 60,
    descricao TEXT,
    cor TEXT DEFAULT 'blue',
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS roteiros_multi_clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_roteiro TEXT NOT NULL,
    colaborador_id INTEGER,
    clientes_ids_json TEXT NOT NULL,
    postos_ids_json TEXT,
    detalhes_dias_json TEXT,
    carga_total_semanal TEXT DEFAULT '44h',
    escala_nome TEXT,
    observacoes TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS colaborador_clientes_compartilhados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roteiro_id INTEGER,
    colaborador_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    posto_trabalho_id INTEGER,
    dias_semana TEXT,
    carga_horaria_semanal TEXT,
    horario_entrada TEXT,
    horario_saida TEXT,
    observacoes TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (roteiro_id) REFERENCES roteiros_multi_clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (posto_trabalho_id) REFERENCES postos_trabalho(id) ON DELETE SET NULL
  );
`);

// Migrações automáticas de colunas se tabela já existia
try { db.exec('ALTER TABLE colaboradores ADD COLUMN posto_trabalho_id INTEGER REFERENCES postos_trabalho(id);'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN data_admissao DATE;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN limite_ferias_vencimento DATE;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN linhas_onibus TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN quantidade_passagens_dia INTEGER DEFAULT 2;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN valor_passagem_unitaria REAL DEFAULT 4.40;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN valor_diario_va REAL DEFAULT 28.00;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN data_demissao DATE;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN motivo_demissao TEXT;'); } catch (e) {}
try { db.exec("ALTER TABLE colaboradores ADD COLUMN status_colaborador TEXT DEFAULT 'Ativo';"); } catch (e) {}
try { db.exec("ALTER TABLE colaboradores ADD COLUMN status_ferias_atual TEXT DEFAULT 'Trabalhando';"); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN ultima_ferias_inicio DATE;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN ultima_ferias_fim DATE;'); } catch (e) {}
try { db.exec('ALTER TABLE fornecedores ADD COLUMN tipo_fornecedor TEXT DEFAULT "Limpeza & Químicos";'); } catch (e) {}
try { db.exec("ALTER TABLE colaboradores ADD COLUMN linhas_transporte_json TEXT DEFAULT '[]';"); } catch (e) {}
try { db.exec("ALTER TABLE colaboradores ADD COLUMN total_diario_vt REAL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE fornecedores ADD COLUMN condicoes_pagamento TEXT DEFAULT '30 dias';"); } catch (e) {}
try { db.exec("ALTER TABLE fornecedores ADD COLUMN chave_pix TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE fornecedores ADD COLUMN dados_bancarios TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE fornecedores ADD COLUMN observacoes TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE produtos_insumos ADD COLUMN marca TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE produtos_insumos ADD COLUMN updated_at DATETIME;"); } catch (e) {}
try {
  db.exec(`
    UPDATE colaboradores 
    SET total_diario_vt = ROUND(COALESCE(quantidade_passagens_dia, 2) * COALESCE(valor_passagem_unitaria, 4.40), 2)
    WHERE (total_diario_vt IS NULL OR total_diario_vt = 0) AND quantidade_passagens_dia > 0;
  `);
} catch (e) {}

// Tabela de Histórico de Férias Concedidas aos Colaboradores
db.exec(`
  CREATE TABLE IF NOT EXISTS historico_ferias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    posto_trabalho_id INTEGER,
    cliente_id INTEGER,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias_ferias INTEGER DEFAULT 30,
    tipo_ferias TEXT DEFAULT 'Férias Integrais (30 dias)',
    havera_cobertura INTEGER DEFAULT 0,
    tipo_cobertura TEXT, -- 'freelancer', 'remanejamento', 'sem_cobertura'
    freelancer_id INTEGER,
    valor_cobertura REAL DEFAULT 0,
    observacoes TEXT,
    etapa_processo TEXT DEFAULT 'Férias solicitada ao Departamento Pessoal',
    data_aviso_entregue DATE,
    data_recibo_entregue DATE,
    colaborador_substituto_id INTEGER,
    nome_substituto_avulso TEXT,
    status_ferias TEXT DEFAULT 'Programada',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
    FOREIGN KEY (freelancer_id) REFERENCES freelancers(id)
  );
`);

try { db.exec("ALTER TABLE historico_ferias ADD COLUMN etapa_processo TEXT DEFAULT 'Férias solicitada ao Departamento Pessoal';"); } catch(e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN data_aviso_entregue DATE;"); } catch(e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN data_recibo_entregue DATE;"); } catch(e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN colaborador_substituto_id INTEGER;"); } catch(e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN nome_substituto_avulso TEXT;"); } catch(e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN status_ferias TEXT DEFAULT 'Programada';"); } catch(e) {}

db.exec(`
  -- Tabela de Histórico da Vida do Colaborador (Linha do Tempo 360°)
  CREATE TABLE IF NOT EXISTS historico_eventos_colaborador (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    tipo_evento TEXT NOT NULL, -- 'ADMISSAO', 'FERIAS', 'FALTA', 'ATESTADO', 'TRANSFERENCIA', 'ALTERACAO_BENEFICIO', 'DEMISSAO', 'ANOTACAO'
    titulo TEXT NOT NULL,
    descricao TEXT,
    data_evento DATE NOT NULL,
    dados_adicionais_json TEXT,
    usuario_responsavel TEXT DEFAULT 'Sistema',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );
`);


// 8. Tabela de Freelancers (Diaristas)
db.exec(`
  CREATE TABLE IF NOT EXISTS freelancers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT,
    cargo_preferencial_id INTEGER,
    telefone TEXT,
    tipo_chave_pix TEXT,
    chave_pix TEXT,
    banco TEXT,
    valor_diaria_padrao REAL DEFAULT 140.00,
    observacoes TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cargo_preferencial_id) REFERENCES cargos(id)
  );
`);

// 9. Tabela de Coberturas de Férias e Mês Inteiro por Freelancers
db.exec(`
  CREATE TABLE IF NOT EXISTS coberturas_ferias_mensal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_titular_id INTEGER NOT NULL,
    posto_trabalho_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    freelancer_id INTEGER NOT NULL,
    ano_mes TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    tipo_cobertura TEXT DEFAULT 'Férias (30 dias)',
    valor_acordado_mensal REAL NOT NULL,
    status_pagamento TEXT DEFAULT 'Pendente',
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_titular_id) REFERENCES colaboradores(id),
    FOREIGN KEY (posto_trabalho_id) REFERENCES postos_trabalho(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (freelancer_id) REFERENCES freelancers(id)
  );
`);

// 10. Tabela de Fornecedores Multicategoria
db.exec(`
  CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_empresa TEXT NOT NULL,
    cnpj TEXT,
    tipo_fornecedor TEXT DEFAULT 'Limpeza & Químicos', -- 'Limpeza & Químicos', 'Uniformes', 'Calçados / Sapatos', 'EPIs', 'Descartáveis', 'Demais / Outros'
    contato TEXT,
    telefone TEXT,
    email TEXT,
    prazo_entrega_dias INTEGER DEFAULT 3,
    ativo INTEGER DEFAULT 1
  );
`);

// 11. Tabela de Produtos / Insumos de Limpeza, EPIs, Uniformes
db.exec(`
  CREATE TABLE IF NOT EXISTS produtos_insumos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fornecedor_id INTEGER,
    codigo_referencia TEXT,
    descricao TEXT NOT NULL,
    unidade_medida TEXT DEFAULT 'UN',
    preco_anual_fechado REAL NOT NULL,
    categoria TEXT DEFAULT 'Limpeza Geral',
    ativo INTEGER DEFAULT 1,
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
  );
`);

// 12. Tabela de Faltas e Coberturas (Operação / RH)
db.exec(`
  CREATE TABLE IF NOT EXISTS faltas_coberturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_falta DATE NOT NULL,
    cliente_id INTEGER NOT NULL,
    unidade_id INTEGER NOT NULL,
    cargo_id INTEGER NOT NULL,
    colaborador_id INTEGER NOT NULL,
    motivo_falta TEXT NOT NULL,
    dias_afastamento INTEGER DEFAULT 1,
    cid_atestado TEXT,
    houve_cobertura INTEGER NOT NULL DEFAULT 0,
    tipo_cobertura TEXT,
    cobertor_colaborador_id INTEGER,
    freelancer_id INTEGER,
    valor_pago_freelance REAL DEFAULT 0,
    status_pagamento_freelance TEXT DEFAULT 'Pendente',
    data_pagamento_freelance DATE,
    status_faturamento TEXT DEFAULT 'Pendente',
    numero_fatura_desconto TEXT,
    valor_desconto_sugerido REAL DEFAULT 0,
    data_desconto_faturamento DATE,
    observacao_faturamento TEXT,
    observacoes_operacao TEXT,
    supervisor_id INTEGER,
    supervisor_nome TEXT,
    origem_lancamento TEXT DEFAULT 'web',
    turno TEXT,
    motivo_nao_cobertura TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (unidade_id) REFERENCES unidades(id),
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
    FOREIGN KEY (cobertor_colaborador_id) REFERENCES colaboradores(id),
    FOREIGN KEY (freelancer_id) REFERENCES freelancers(id),
    FOREIGN KEY (supervisor_id) REFERENCES supervisores(id)
  );

  CREATE TABLE IF NOT EXISTS supervisores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT,
    pin TEXT DEFAULT '1001',
    token_acesso TEXT UNIQUE,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN criado_por TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN atualizado_por TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN atualizado_em DATETIME;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN excluido INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN excluido_por TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN excluido_em DATETIME;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN motivo_exclusao TEXT;'); } catch (e) {}

// 13. Tabela de Pedidos Mensais de Compras Matriz
db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos_compras_mensal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano_mes TEXT NOT NULL,
    cliente_id INTEGER NOT NULL,
    status TEXT DEFAULT 'Rascunho',
    data_fechamento DATE,
    observacoes TEXT,
    token_publico TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ano_mes, cliente_id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS pedido_unidade_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    unidade_id INTEGER NOT NULL,
    status TEXT DEFAULT 'Pendente',
    responsavel_nome TEXT,
    responsavel_telefone TEXT,
    data_envio DATETIME,
    observacoes TEXT,
    token_acesso TEXT UNIQUE,
    UNIQUE(pedido_id, unidade_id),
    FOREIGN KEY (pedido_id) REFERENCES pedidos_compras_mensal(id) ON DELETE CASCADE,
    FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE
  );
`);

// 14. Tabela de Itens da Matriz
db.exec(`
  CREATE TABLE IF NOT EXISTS pedido_itens_unidade (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    unidade_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    preco_unitario_aplicado REAL NOT NULL,
    status_entrega_unidade TEXT DEFAULT 'Pendente',
    recebedor_nome TEXT,
    data_entrega DATE,
    observacoes_entrega TEXT,
    FOREIGN KEY (pedido_id) REFERENCES pedidos_compras_mensal(id) ON DELETE CASCADE,
    FOREIGN KEY (unidade_id) REFERENCES unidades(id),
    FOREIGN KEY (produto_id) REFERENCES produtos_insumos(id),
    UNIQUE(pedido_id, unidade_id, produto_id)
  );
`);

// 15. Tabela de Orçamentos e Fluxo de Autorização de Compras (Diretoria & Admin)
db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos_orcamentos_compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano_mes TEXT NOT NULL,
    categoria_compra TEXT NOT NULL, -- 'Insumos de Limpeza', 'Uniformes', 'Calçados / Sapatos', 'EPIs', 'Demais / Outros'
    fornecedor_id INTEGER,
    cliente_id INTEGER,
    titulo_orcamento TEXT NOT NULL,
    valor_total REAL NOT NULL DEFAULT 0,
    status_aprovacao TEXT DEFAULT 'Aguardando Aprovação Diretoria/Admin', -- 'Em Elaboração', 'Aguardando Aprovação Diretoria/Admin', 'Aprovado', 'Rejeitado'
    autorizado_por_usuario_id INTEGER,
    autorizado_por_nome TEXT,
    data_autorizacao DATETIME,
    motivo_rejeicao TEXT,
    detalhes_itens TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (autorizado_por_usuario_id) REFERENCES usuarios(id)
  );
`);

// 16. Tabela de Configurações de Dias Úteis do Mês para Benefícios
db.exec(`
  CREATE TABLE IF NOT EXISTS beneficios_config_mes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano_mes TEXT NOT NULL UNIQUE,
    dias_uteis_5x2 INTEGER DEFAULT 22,
    dias_uteis_6x1 INTEGER DEFAULT 26,
    dias_uteis_12x36 INTEGER DEFAULT 15,
    observacoes TEXT
  );

  CREATE TABLE IF NOT EXISTS sst_modelos_ordens_servico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cargo_id INTEGER,
    nome_funcao TEXT NOT NULL,
    descricao_atividades TEXT NOT NULL,
    riscos_ocupacionais_json TEXT NOT NULL,
    epis_obrigatorios_json TEXT NOT NULL,
    medidas_preventivas TEXT NOT NULL,
    normas_proibicoes TEXT NOT NULL,
    termo_compromisso TEXT NOT NULL,
    ativo INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sst_documentos_colaborador (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    tipo_documento TEXT NOT NULL,
    titulo TEXT NOT NULL,
    status_assinatura TEXT DEFAULT 'Pendente',
    conteudo_json TEXT NOT NULL,
    data_geracao DATE NOT NULL,
    data_assinatura DATE,
    arquivo_status TEXT DEFAULT 'Nao_Solicitado',
    arquivo_registro_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS setor_arquivos_documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    documento_sst_id INTEGER,
    tipo_documento TEXT NOT NULL,
    descricao TEXT NOT NULL,
    solicitado_por_usuario_id INTEGER,
    solicitado_por_nome TEXT,
    data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Aguardando_Arquivamento',
    localizacao_caixa TEXT,
    localizacao_pasta TEXT,
    localizacao_estante TEXT,
    arquivado_por_usuario_id INTEGER,
    arquivado_por_nome TEXT,
    data_arquivamento DATETIME,
    observacoes TEXT,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contas_pagar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origem_tipo TEXT DEFAULT 'compra',
    origem_id INTEGER,
    fornecedor_id INTEGER,
    fornecedor_nome TEXT NOT NULL,
    descricao TEXT NOT NULL,
    categoria TEXT DEFAULT 'Compras & Insumos',
    parcela_numero INTEGER DEFAULT 1,
    total_parcelas INTEGER DEFAULT 1,
    tipo_parcela TEXT DEFAULT 'Parcela',
    valor REAL NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    forma_pagamento TEXT NOT NULL DEFAULT 'PIX',
    dados_pagamento TEXT,
    status TEXT DEFAULT 'Pendente',
    data_pagamento DATETIME,
    pago_por_nome TEXT,
    pago_por_id INTEGER,
    comprovante_ref TEXT,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (origem_id) REFERENCES pedidos_orcamentos_compras(id) ON DELETE CASCADE,
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
  );
`);

try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN condicao_pagamento TEXT DEFAULT 'adiantamento_prazo';"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN prazo_restante_dias INTEGER DEFAULT 30;"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN valor_adiantamento REAL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN data_adiantamento DATE;"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN valor_restante REAL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN data_vencimento_restante DATE;"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN parcelas_json TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN forma_pagamento TEXT DEFAULT 'PIX';"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN dados_pagamento TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE pedidos_orcamentos_compras ADD COLUMN status_financeiro TEXT DEFAULT 'Pendente';"); } catch (e) {}

try { db.exec("ALTER TABLE fornecedores ADD COLUMN chave_pix TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE fornecedores ADD COLUMN dados_bancarios TEXT;"); } catch (e) {}

console.log('Tabelas migradas e criadas com sucesso!');

// Função para popular usuários e dados iniciais
function popularDadosIniciais() {
  // Inserir Usuários Iniciais se não existirem
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count;
  if (countUsers === 0) {
    console.log('Criando usuários e permissões por setor...');
    const stmtUser = db.prepare(`
      INSERT INTO usuarios (nome, login, senha, setor, email)
      VALUES (?, ?, ?, ?, ?)
    `);

    // 1. Admin Master
    const u1 = stmtUser.run('Administrador Master', 'admin', 'admin123', 'admin', 'admin@empresa.com.br');
    // 2. RH - Ana
    const u2 = stmtUser.run('Ana Beatriz (RH & Operações)', 'rh_ana', 'rh123', 'rh', 'ana.rh@empresa.com.br');
    // 3. Faturamento - Marcos
    const u3 = stmtUser.run('Marcos Vinicius (Faturamento)', 'fat_marcos', 'fat123', 'faturamento', 'faturamento@empresa.com.br');
    // 4. Compras - Carlos
    const u4 = stmtUser.run('Carlos Alberto (Suprimentos & Compras)', 'compras_carlos', 'compras123', 'compras', 'compras@empresa.com.br');
    // 5. Benefícios - Lúcia
    const u5 = stmtUser.run('Lúcia Helena (Setor de Benefícios)', 'benef_lucia', 'benef123', 'beneficios', 'beneficios@empresa.com.br');
    // 6. Diretoria - Dr. Roberto
    const u6 = stmtUser.run('Dr. Roberto Martins (Diretoria Executiva)', 'diretoria_dr', 'dir123', 'diretoria', 'diretoria@empresa.com.br');

    // Inserir Permissões Granulares
    const modulos = ['faltas', 'faturamento', 'freelancers', 'diretoria', 'compras', 'beneficios', 'cadastros', 'postos', 'ferias', 'usuarios'];
    const stmtPerm = db.prepare(`
      INSERT INTO permissoes_usuario (usuario_id, modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir, pode_aprovar)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Admin: Tudo Liberado
    for (const m of modulos) {
      stmtPerm.run(u1.lastInsertRowid, m, 1, 1, 1, 1, 1);
    }

    // Ana do RH: Faltas, Freelancers, Postos, Férias, Colaboradores, Dashboard
    stmtPerm.run(u2.lastInsertRowid, 'faltas', 1, 1, 1, 1, 0);
    stmtPerm.run(u2.lastInsertRowid, 'freelancers', 1, 1, 1, 1, 0);
    stmtPerm.run(u2.lastInsertRowid, 'postos', 1, 1, 1, 1, 0);
    stmtPerm.run(u2.lastInsertRowid, 'ferias', 1, 1, 1, 1, 0);
    stmtPerm.run(u2.lastInsertRowid, 'cadastros', 1, 1, 1, 1, 0);
    stmtPerm.run(u2.lastInsertRowid, 'diretoria', 1, 0, 0, 0, 0);

    // Marcos do Faturamento: Faturamento e visualização de clientes
    stmtPerm.run(u3.lastInsertRowid, 'faturamento', 1, 1, 1, 1, 1);
    stmtPerm.run(u3.lastInsertRowid, 'cadastros', 1, 0, 0, 0, 0);

    // Carlos de Compras: Compras e Fornecedores
    stmtPerm.run(u4.lastInsertRowid, 'compras', 1, 1, 1, 1, 0);
    stmtPerm.run(u4.lastInsertRowid, 'cadastros', 1, 1, 1, 0, 0);

    // Lúcia de Benefícios: Benefícios e visualização de faltas/colaboradores
    stmtPerm.run(u5.lastInsertRowid, 'beneficios', 1, 1, 1, 1, 1);
    stmtPerm.run(u5.lastInsertRowid, 'faltas', 1, 0, 0, 0, 0);
    stmtPerm.run(u5.lastInsertRowid, 'cadastros', 1, 0, 0, 0, 0);

    // Diretoria: Relatórios, Dashboards, Aprovação de Compras
    stmtPerm.run(u6.lastInsertRowid, 'diretoria', 1, 1, 1, 1, 1);
    stmtPerm.run(u6.lastInsertRowid, 'compras', 1, 0, 0, 0, 1); // Pode aprovar compras
    stmtPerm.run(u6.lastInsertRowid, 'faturamento', 1, 0, 0, 0, 0);
    stmtPerm.run(u6.lastInsertRowid, 'faltas', 1, 0, 0, 0, 0);
  }

  // Verificar se existem postos de trabalho configurados
  const countPostos = db.prepare('SELECT COUNT(*) as count FROM postos_trabalho').get().count;
  if (countPostos === 0) {
    console.log('Cadastrando postos de trabalho com limites contratados...');
    const stmtPosto = db.prepare(`
      INSERT INTO postos_trabalho (cliente_id, unidade_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Cliente 1 (Rede Educacional Futuro)
    stmtPosto.run(1, 1, 'Portaria Principal 12x36', 2, 2, '12x36', '06:00 às 18:00'); // Limite 2 vagas
    stmtPosto.run(1, 1, 'Limpeza Matriz - Bloco Administrativo', 1, 3, '5x2', '07:00 às 16:48'); // Limite 3 vagas
    stmtPosto.run(1, 2, 'Portaria Campus Pinheiros', 2, 1, '12x36', '06:00 às 18:00'); // Limite 1 vaga
    stmtPosto.run(1, 2, 'Limpeza Campus Pinheiros', 1, 2, '5x2', '07:00 às 16:48'); // Limite 2 vagas
    stmtPosto.run(1, 3, 'Recepção Central Paulista', 3, 1, '5x2', '08:00 às 17:00'); // Limite 1 vaga

    // Cliente 2 (Hospital São Lucas)
    stmtPosto.run(2, 23, 'Higienização Pronto Atendimento', 1, 2, '12x36', '07:00 às 19:00'); // Limite 2 vagas
    stmtPosto.run(2, 24, 'Limpeza Bloco Cirúrgico UTI', 1, 2, '12x36', '19:00 às 07:00'); // Limite 2 vagas

    // Vincular colaboradores existentes aos postos criados e adicionar dados de admissão e benefícios
    console.log('Vinculando colaboradores aos postos de trabalho e configurando benefícios...');
    const updateColab = db.prepare(`
      UPDATE colaboradores SET 
        posto_trabalho_id = ?,
        data_admissao = ?,
        limite_ferias_vencimento = ?,
        linhas_onibus = ?,
        quantidade_passagens_dia = ?,
        valor_passagem_unitaria = ?,
        valor_diario_va = ?
      WHERE id = ?
    `);

    // Atualizar colaboradores de demonstração
    updateColab.run(2, '2024-03-10', '2025-03-10', 'Linha 107T-10 / 175P-10', 2, 4.40, 28.00, 1);
    updateColab.run(2, '2025-08-15', '2026-08-15', 'Linha 477P-10 / 5154-10', 4, 4.40, 28.00, 2);
    updateColab.run(1, '2023-05-02', '2024-05-02', 'Linha 875H-10', 2, 4.40, 32.00, 3);
    updateColab.run(5, '2025-01-20', '2026-01-20', 'Metrô Linha 2 Verde', 2, 5.00, 30.00, 4);
    updateColab.run(4, '2024-11-01', '2025-11-01', 'Linha 695T-10', 2, 4.40, 28.00, 5);
  }

  // Inserir Fornecedores de Uniformes, EPIs e Calçados
  const countFornExtra = db.prepare("SELECT COUNT(*) as count FROM fornecedores WHERE tipo_fornecedor != 'Limpeza & Químicos'").get().count;
  if (countFornExtra === 0) {
    console.log('Cadastrando fornecedores de Uniformes, Calçados e EPIs...');
    const stmtForn = db.prepare(`
      INSERT INTO fornecedores (nome_empresa, cnpj, tipo_fornecedor, contato, telefone, email, prazo_entrega_dias)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmtForn.run('Moda Corporativa & Uniformes Profissionais Ltda', '21.432.543/0001-88', 'Uniformes', 'Juliana Santos', '(11) 97111-2222', 'contato@uniformesmoda.com.br', 10);
    stmtForn.run('Botas Fortex & Calçados de Segurança Industrial', '32.543.654/0001-99', 'Calçados / Sapatos', 'Rodrigo Calçados', '(11) 97222-3333', 'vendas@botasfortex.com.br', 5);
    stmtForn.run('SegurMaster EPIs e Proteção Individual', '43.654.765/0001-00', 'EPIs', 'Eduardo Proteção', '(11) 97333-4444', 'comercial@segurmaster.com.br', 4);
    stmtForn.run('Geral Suprimentos & Utilidades Diversas', '54.765.876/0001-11', 'Demais / Outros', 'Simone Utilidades', '(11) 97444-5555', 'pedidos@geralsuprimentos.com.br', 3);

    // Inserir Produtos dessas novas categorias
    const stmtProd = db.prepare(`
      INSERT INTO produtos_insumos (fornecedor_id, codigo_referencia, descricao, unidade_medida, preco_anual_fechado, categoria)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmtProd.run(3, 'UNI-001', 'Camisa Polo Operacional c/ Logotipo Bordado', 'UN', 38.00, 'Uniformes');
    stmtProd.run(3, 'UNI-002', 'Calça Operacional Brim Pesado Azul Marinho', 'UN', 55.00, 'Uniformes');
    stmtProd.run(3, 'UNI-003', 'Avental Vinílico Impermeável Limpeza', 'UN', 22.00, 'Uniformes');
    stmtProd.run(4, 'CAL-001', 'Sapato Ocupacional Soft Works Antiderrapante Preto', 'PAR', 68.00, 'Calçados / Sapatos');
    stmtProd.run(4, 'CAL-002', 'Bota de Borracha PVC Cano Médio Branca', 'PAR', 45.00, 'Calçados / Sapatos');
    stmtProd.run(5, 'EPI-001', 'Óculos de Proteção Incolor Antirrisco', 'UN', 8.50, 'EPIs');
    stmtProd.run(5, 'EPI-002', 'Protetor Auricular Tipo Plug Silicone (Cordão)', 'PAR', 3.20, 'EPIs');
    stmtProd.run(5, 'EPI-003', 'Máscara PFF2 N95 Hospitalar (Caixa c/ 50)', 'CX', 65.00, 'EPIs');
  }

  // Inserir Orçamento de Compras de Exemplo para Teste de Aprovação
  const countOrc = db.prepare('SELECT COUNT(*) as count FROM pedidos_orcamentos_compras').get().count;
  if (countOrc === 0) {
    console.log('Criando orçamento de compras para fluxo de aprovação...');
    const stmtOrc = db.prepare(`
      INSERT INTO pedidos_orcamentos_compras (ano_mes, categoria_compra, fornecedor_id, cliente_id, titulo_orcamento, valor_total, status_aprovacao, detalhes_itens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmtOrc.run(
      '2026-10',
      'Uniformes',
      3,
      1,
      'Renovação Semestral de Uniformes - 45 Colaboradores Rede Futuro',
      3850.00,
      'Aguardando Aprovação Diretoria/Admin',
      '45x Camisas Polo (R$ 38,00) + 45x Calças Brim (R$ 55,00) com logo bordado'
    );
    stmtOrc.run(
      '2026-10',
      'EPIs',
      5,
      2,
      'Lote Trimestral de EPIs e Máscaras PFF2 - Hospital São Lucas',
      1980.00,
      'Aguardando Aprovação Diretoria/Admin',
      '20x Caixas Máscaras PFF2 + 40x Óculos de Proteção + Luvas especiais'
    );
  }

  // Inserir Cobertura de Férias por Freelancer (Mês Inteiro) de Exemplo
  const countCobFerias = db.prepare('SELECT COUNT(*) as count FROM coberturas_ferias_mensal').get().count;
  if (countCobFerias === 0) {
    console.log('Criando cobertura de férias mensal de exemplo...');
    const stmtCobFerias = db.prepare(`
      INSERT INTO coberturas_ferias_mensal (colaborador_titular_id, posto_trabalho_id, cliente_id, freelancer_id, ano_mes, data_inicio, data_fim, tipo_cobertura, valor_acordado_mensal, status_pagamento, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmtCobFerias.run(
      1, // Antonio Marcos
      2, // Posto Limpeza Matriz
      1, // Rede Educacional Futuro
      1, // Carlos Alberto (Freelancer)
      '2026-10',
      '2026-10-01',
      '2026-10-30',
      'Férias Integrais (30 dias)',
      2800.00,
      'Pendente',
      'Cobertura integral das férias de 30 dias do titular Antonio Marcos na Matriz'
    );
  }

  // Configuração padrão de Benefícios para o mês atual
  const countBenConfig = db.prepare('SELECT COUNT(*) as count FROM beneficios_config_mes').get().count;
  if (countBenConfig === 0) {
    db.prepare(`
      INSERT INTO beneficios_config_mes (ano_mes, dias_uteis_5x2, dias_uteis_6x1, dias_uteis_12x36, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `).run('2026-09', 22, 26, 15, 'Mês com 22 dias úteis na escala 5x2');
    db.prepare(`
      INSERT INTO beneficios_config_mes (ano_mes, dias_uteis_5x2, dias_uteis_6x1, dias_uteis_12x36, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `).run('2026-10', 22, 26, 15, 'Competência Outubro/2026');
  }

  console.log('Migração e carga de dados SISFAC 2.0 concluída com sucesso!');
}

popularDadosIniciais();
