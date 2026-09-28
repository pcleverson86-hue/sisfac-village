// server.js - Servidor HTTP nativo e API RESTful SISFAC 2.0 (Node.js v22+ + SQLite)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const os = require('node:os');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ResoluÃ§Ã£o do caminho do banco de dados:
// 1. Usa DB_PATH da variÃ¡vel de ambiente se definida (ex: /var/data com disco persistente)
// 2. Se estiver no Render SEM disco, usa /tmp (dados resetam ao reiniciar, mas funciona)
// 3. Em desenvolvimento local, usa a pasta raiz do projeto
function resolverDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.RENDER) {
    // Tenta usar /var/data (disco persistente), senÃ£o usa /tmp
    try {
      fs.accessSync('/var/data', fs.constants.W_OK);
      return '/var/data/banco_dados.sqlite';
    } catch (e) {
      console.log('[DB] /var/data nÃ£o disponÃ­vel â€” usando /tmp (dados temporÃ¡rios)');
      return '/tmp/banco_dados.sqlite';
    }
  }
  return path.join(__dirname, 'banco_dados.sqlite');
}

const DB_PATH = resolverDbPath();
const IS_PRODUCTION = !!(process.env.RENDER || process.env.NODE_ENV === 'production');
console.log(`[DB] Caminho do banco: ${DB_PATH}`);


// FunÃ§Ã£o para identificar o endereÃ§o IP da mÃ¡quina na rede local
function obterIpLocal() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Gerenciamento dinÃ¢mico de tÃºnel Cloudflare para acesso externo
let currentTunnelUrl = 'https://melissa-compile-teenage-sapphire.trycloudflare.com';
let cloudflaredProcess = null;

function obterUrlTunnel() {
  try {
    const fileP = path.join(__dirname, 'tunnel_url.txt');
    if (fs.existsSync(fileP)) {
      const txt = fs.readFileSync(fileP, 'utf8').trim();
      if (txt.startsWith('http')) return txt;
    }
  } catch (e) {}
  return currentTunnelUrl;
}

function salvarUrlTunnel(urlStr) {
  if (!urlStr || !urlStr.startsWith('http')) return;
  currentTunnelUrl = urlStr.trim();
  try {
    fs.writeFileSync(path.join(__dirname, 'tunnel_url.txt'), currentTunnelUrl, 'utf8');

    const desktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\Administrativo', 'Desktop');
    if (fs.existsSync(desktopPath)) {
      const dataFormatada = new Date().toLocaleString('pt-BR');
      const txtContent = `===============================================================================
SISFAC 2.0 - LINKS OFICIAIS DE ACESSO EXTERNO (INTERNET / CELULAR / 4G)
Atualizado em: ${dataFormatada}
===============================================================================

1. PORTAL DO SUPERVISOR DE CAMPO (Celular 4G / LanÃ§amento de Faltas & Coberturas):
   ðŸ‘‰ ${currentTunnelUrl}/supervisor

2. CANAL DE DENÃšNCIAS & OUVIDORIA (100% Sigiloso & Protegido por LGPD):
   ðŸ‘‰ ${currentTunnelUrl}/denuncias

3. PORTAL DE TREINAMENTOS EAD (Cursos Operacionais & Certificados):
   ðŸ‘‰ ${currentTunnelUrl}/treinamentos

4. PAINEL PRINCIPAL SISFAC 2.0 (GestÃ£o Administrativa & Operacional):
   ðŸ‘‰ ${currentTunnelUrl}

5. ACESSO PELA REDE WI-FI LOCAL (Mesmo escritÃ³rio / Celular conectado no Wi-Fi):
   ðŸ‘‰ http://${obterIpLocal()}:${PORT}/supervisor (Supervisor de Campo)
   ðŸ‘‰ http://${obterIpLocal()}:${PORT}/denuncias (Canal de DenÃºncias)
   ðŸ‘‰ http://${obterIpLocal()}:${PORT}/treinamentos (Portal de Treinamentos)
   ðŸ‘‰ http://${obterIpLocal()}:${PORT} (Sistema SISFAC 2.0)

===============================================================================
* Mantenha estes links salvos para acessar de qualquer lugar do mundo.
===============================================================================
`;
      fs.writeFileSync(path.join(desktopPath, 'LINK_ACESSO_EXTERNO.txt'), txtContent, 'utf8');
      fs.writeFileSync(path.join(desktopPath, 'Portal Supervisor (Celular 4G).url'), `[InternetShortcut]\nURL=${currentTunnelUrl}/supervisor\n`, 'utf8');
      fs.writeFileSync(path.join(desktopPath, 'Canal de Denuncias (Ouvidoria).url'), `[InternetShortcut]\nURL=${currentTunnelUrl}/denuncias\n`, 'utf8');
      fs.writeFileSync(path.join(desktopPath, 'Portal de Treinamentos (EAD).url'), `[InternetShortcut]\nURL=${currentTunnelUrl}/treinamentos\n`, 'utf8');
      fs.writeFileSync(path.join(desktopPath, 'SISFAC 2.0 (Internet Externa).url'), `[InternetShortcut]\nURL=${currentTunnelUrl}\n`, 'utf8');
    }
  } catch (err) {
    console.error('[Tunnel] Erro ao gravar arquivos de atalho:', err.message);
  }
}

function iniciarOuVerificarTunnel() {
  // Em produÃ§Ã£o no Render, nÃ£o precisamos de tunnel cloudflare
  if (IS_PRODUCTION) {
    console.log('[Tunnel] Ambiente de produÃ§Ã£o detectado â€” tunnel Cloudflare desativado.');
    return;
  }

  const cloudflaredExe = path.join(__dirname, 'cloudflared.exe');

  if (!fs.existsSync(cloudflaredExe)) {
    console.log('[Tunnel] cloudflared.exe nÃ£o encontrado na pasta raiz.');
    return;
  }

  const urlSalva = obterUrlTunnel();
  if (urlSalva) {
    salvarUrlTunnel(urlSalva);
  }

  const req = http.get('http://127.0.0.1:20241/metrics', () => {
    console.log('[Tunnel] cloudflared jÃ¡ estÃ¡ em execuÃ§Ã£o no sistema.');
  });

  req.on('error', () => {
    console.log('[Tunnel] Iniciando cloudflared.exe automaticamente...');
    try {
      const { spawn } = require('node:child_process');
      cloudflaredProcess = spawn(cloudflaredExe, ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
        cwd: __dirname,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const capturarLink = (chunk) => {
        const text = chunk.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          const novoUrl = match[0];
          console.log(`[Tunnel] ðŸŒ Novo link pÃºblico gerado: ${novoUrl}`);
          salvarUrlTunnel(novoUrl);
        }
      };

      if (cloudflaredProcess.stdout) cloudflaredProcess.stdout.on('data', capturarLink);
      if (cloudflaredProcess.stderr) cloudflaredProcess.stderr.on('data', capturarLink);

      cloudflaredProcess.on('exit', (code) => {
        console.log(`[Tunnel] cloudflared finalizado (cÃ³digo ${code}).`);
        cloudflaredProcess = null;
      });
    } catch (e) {
      console.error('[Tunnel] Falha ao iniciar cloudflared:', e.message);
    }
  });
}

// ConexÃ£o com SQLite
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// MigraÃ§Ãµes seguras de inicializaÃ§Ã£o
try { db.exec('ALTER TABLE colaboradores ADD COLUMN status_colaborador TEXT DEFAULT "Ativo";'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN data_demissao DATE;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN motivo_demissao TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN status_ferias_atual TEXT DEFAULT "Trabalhando";'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN ultima_ferias_inicio DATE;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN ultima_ferias_fim DATE;'); } catch (e) {}
try {
  db.exec("UPDATE cargos SET nome_cargo = 'Porteiro 12x36' WHERE id = 2 OR LOWER(nome_cargo) = 'porteiro';");
  db.exec("UPDATE postos_trabalho SET escala = '12x36' WHERE escala IN ('12x36 Diurno', '12x36 Noturno') OR cargo_id = 2;");
  db.exec("UPDATE colaboradores SET escala = '12x36' WHERE escala IN ('12x36 Diurno', '12x36 Noturno') OR cargo_id = 2;");
  db.exec("UPDATE faltas_coberturas SET turno = '12x36' WHERE turno LIKE '12x36%';");
} catch (e) {}
db.exec(`
  CREATE TABLE IF NOT EXISTS historico_ferias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    posto_trabalho_id INTEGER,
    cliente_id INTEGER,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias_ferias INTEGER DEFAULT 30,
    tipo_ferias TEXT DEFAULT 'FÃ©rias Integrais (30 dias)',
    havera_cobertura INTEGER DEFAULT 0,
    tipo_cobertura TEXT,
    freelancer_id INTEGER,
    valor_cobertura REAL DEFAULT 0,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id),
    FOREIGN KEY (freelancer_id) REFERENCES freelancers(id)
  );

  CREATE TABLE IF NOT EXISTS beneficios_colaborador_mes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano_mes TEXT NOT NULL,
    colaborador_id INTEGER NOT NULL,
    data_inicio_beneficio DATE,
    data_fim_beneficio DATE,
    dias_vt INTEGER,
    dias_va INTEGER,
    tarifa_vt REAL,
    passagens_dia INTEGER,
    diaria_va REAL,
    faltas_descontadas INTEGER DEFAULT 0,
    dias_selecionados_json TEXT,
    observacoes TEXT,
    customizado INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ano_mes, colaborador_id),
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );

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

try { db.exec('ALTER TABLE pedidos_compras_mensal ADD COLUMN token_publico TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE unidades ADD COLUMN observacoes TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE unidades ADD COLUMN fornecedores_permitidos_json TEXT DEFAULT "[]";'); } catch (e) {}
db.exec(`
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

// MigraÃ§Ãµes seguras para Supervisores e Faltas Mobile
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN supervisor_id INTEGER;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN supervisor_nome TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN origem_lancamento TEXT DEFAULT "web";'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN turno TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN motivo_nao_cobertura TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN criado_por TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN atualizado_por TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN atualizado_em DATETIME;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN excluido INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN excluido_por TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN excluido_em DATETIME;'); } catch (e) {}
try { db.exec('ALTER TABLE faltas_coberturas ADD COLUMN motivo_exclusao TEXT;'); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS supervisores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    login TEXT UNIQUE,
    senha TEXT NOT NULL DEFAULT '1234',
    telefone TEXT,
    pin TEXT DEFAULT '1001',
    token_acesso TEXT UNIQUE,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// MigraÃ§Ãµes seguras para login e senha em bases existentes
try { db.exec('ALTER TABLE supervisores ADD COLUMN login TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE supervisores ADD COLUMN senha TEXT DEFAULT "1234";'); } catch (e) {}

// InicializaÃ§Ã£o ou atualizaÃ§Ã£o de supervisores com logins e senhas individuais
try {
  const countSup = db.prepare('SELECT COUNT(*) as total FROM supervisores').get();
  if (countSup.total === 0) {
    const defaultSup = [
      { nome: 'Carlos Silva (Supervisor 1)', login: 'carlos', senha: '123', telefone: '(11) 98111-0001', pin: '1001' },
      { nome: 'Marcos Oliveira (Supervisor 2)', login: 'marcos', senha: '123', telefone: '(11) 98111-0002', pin: '1002' },
      { nome: 'Roberto Souza (Supervisor 3)', login: 'roberto', senha: '123', telefone: '(11) 98111-0003', pin: '1003' },
      { nome: 'Juliana Castro (Supervisora 4)', login: 'juliana', senha: '123', telefone: '(11) 98111-0004', pin: '1004' },
      { nome: 'AndrÃ© Santos (Supervisor 5)', login: 'andre', senha: '123', telefone: '(11) 98111-0005', pin: '1005' }
    ];
    const stmt = db.prepare('INSERT INTO supervisores (nome, login, senha, telefone, pin, token_acesso) VALUES (?, ?, ?, ?, ?, ?)');
    for (const s of defaultSup) {
      const token = crypto.randomBytes(12).toString('hex');
      stmt.run(s.nome, s.login, s.senha, s.telefone, s.pin, token);
    }
  } else {
    // Garantir que supervisores jÃ¡ existentes tenham logins e senhas preenchidos
    const loginsPadrao = ['carlos', 'marcos', 'roberto', 'juliana', 'andre'];
    const sups = db.prepare('SELECT id, nome, login, senha FROM supervisores ORDER BY id ASC').all();
    sups.forEach((s, idx) => {
      let loginDefinido = s.login;
      let senhaDefinida = s.senha || '123';
      if (!loginDefinido) {
        loginDefinido = loginsPadrao[idx] || s.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_').slice(0, 15);
      }
      db.prepare('UPDATE supervisores SET login = ?, senha = ? WHERE id = ?').run(loginDefinido, senhaDefinida, s.id);
    });
  }
} catch (errSup) {
  console.error('Erro ao inicializar/atualizar supervisores com credenciais:', errSup);
}

// Tabela de Setores da Empresa
db.exec(`
  CREATE TABLE IF NOT EXISTS setores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_setor TEXT NOT NULL UNIQUE,
    sigla TEXT,
    descricao TEXT,
    cor_badge TEXT DEFAULT 'blue',
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  const countSet = db.prepare('SELECT COUNT(*) as total FROM setores').get();
  if (countSet.total === 0) {
    const defaultSetores = [
      { nome: 'Recursos Humanos & OperaÃ§Ãµes', sigla: 'RH', descricao: 'GestÃ£o de Colaboradores, Faltas, FÃ©rias e Postos', cor: 'blue' },
      { nome: 'Faturamento & Glosas', sigla: 'FAT', descricao: 'Controle de Faturamento, Glosas e Descontos', cor: 'emerald' },
      { nome: 'Suprimentos & Compras', sigla: 'COM', descricao: 'AquisiÃ§Ã£o de Materiais, Pedidos Mensais e CotaÃ§Ãµes', cor: 'amber' },
      { nome: 'Setor de BenefÃ­cios', sigla: 'BEN', descricao: 'ApuraÃ§Ã£o e Pedidos de VT e VA com Abatimento de Faltas', cor: 'indigo' },
      { nome: 'SupervisÃ£o de Campo', sigla: 'SUP', descricao: 'Acompanhamento em Campo, Faltas Mobile e Coberturas', cor: 'sky' },
      { nome: 'Diretoria Executiva', sigla: 'DIR', descricao: 'VisÃ£o EstratÃ©gica, Dashboards e Auditoria', cor: 'purple' },
      { nome: 'Administrador Master', sigla: 'ADM', descricao: 'Acesso Irrestrito e ConfiguraÃ§Ãµes Gerais', cor: 'red' }
    ];
    const stmtSet = db.prepare('INSERT INTO setores (nome_setor, sigla, descricao, cor_badge) VALUES (?, ?, ?, ?)');
    for (const st of defaultSetores) {
      stmtSet.run(st.nome, st.sigla, st.descricao, st.cor);
    }
  }
} catch (errSet) {
  console.error('Erro ao inicializar setores da empresa:', errSet);
}

// =============================================================
// MÃ“DULO COMERCIAL, IMPLANTAÃ‡ÃƒO DE CONTRATOS & COMUNICADOS DA EMPRESA
// =============================================================

// 1. Flag de permissÃ£o para envio de comunicados em usuÃ¡rios
try { db.exec('ALTER TABLE usuarios ADD COLUMN pode_enviar_comunicados INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec("UPDATE usuarios SET pode_enviar_comunicados = 1 WHERE setor = 'admin' OR login = 'admin';"); } catch (e) {}

// 2. Setor Comercial padrÃ£o na tabela de setores
try {
  const existeComercial = db.prepare("SELECT id FROM setores WHERE sigla = 'COMER' OR nome_setor LIKE '%Comercial%'").get();
  if (!existeComercial) {
    db.prepare(`
      INSERT INTO setores (nome_setor, sigla, descricao, cor_badge)
      VALUES ('Setor Comercial & Novos Contratos', 'COMER', 'ProspecÃ§Ã£o de Clientes, NegociaÃ§Ã£o e EfetivaÃ§Ã£o de Contratos', 'amber')
    `).run();
  }
} catch (e) {}

// 3. Tabela de Leads Comerciais (CRM de Facilities e TerceirizaÃ§Ã£o)
db.exec(`
  CREATE TABLE IF NOT EXISTS leads_comercial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_lead TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT,
    segmento TEXT DEFAULT 'CondomÃ­nio Residencial',
    contato_nome TEXT,
    contato_cargo TEXT,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    cidade TEXT,
    bairro TEXT,
    endereco TEXT,
    origem_lead TEXT DEFAULT 'IndicaÃ§Ã£o',
    etapa TEXT DEFAULT 'prospeccao', -- 'prospeccao', 'visita_tecnica', 'proposta', 'negociacao', 'ganho', 'perdido'
    probabilidade INTEGER DEFAULT 20,
    valor_estimado_mensal REAL DEFAULT 0,
    quantidade_postos_estimada INTEGER DEFAULT 1,
    previsao_fechamento DATE,
    data_inicio_prevista DATE,
    responsavel_usuario_id INTEGER,
    responsavel_nome TEXT,
    motivo_perda TEXT,
    observacoes TEXT,
    cliente_id_convertido INTEGER,
    data_conversao DATETIME,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 4. Tabela de HistÃ³rico / InteraÃ§Ãµes do Lead
db.exec(`
  CREATE TABLE IF NOT EXISTS leads_interacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    tipo TEXT DEFAULT 'anotacao', -- 'reuniao', 'ligacao', 'whatsapp', 'visita_tecnica', 'envio_proposta', 'followup', 'anotacao'
    descricao TEXT NOT NULL,
    data_interacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_nome TEXT,
    FOREIGN KEY (lead_id) REFERENCES leads_comercial(id) ON DELETE CASCADE
  );
`);

// 5. Tabela de Ordens de ImplantaÃ§Ã£o
db.exec(`
  CREATE TABLE IF NOT EXISTS ordens_implantacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_implantacao TEXT UNIQUE,
    cliente_id INTEGER NOT NULL,
    lead_id INTEGER,
    data_ativacao_contrato DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_inicio_operacao DATE NOT NULL,
    valor_mensal_contratado REAL DEFAULT 0,
    total_postos INTEGER DEFAULT 1,
    total_vagas INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Em ImplantaÃ§Ã£o', -- 'Em ImplantaÃ§Ã£o', 'ConcluÃ­da'
    criado_por TEXT,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );
`);

// 6. Tarefas Setoriais da Ordem de ImplantaÃ§Ã£o
db.exec(`
  CREATE TABLE IF NOT EXISTS ordens_implantacao_tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordem_id INTEGER NOT NULL,
    setor_responsavel TEXT NOT NULL, -- 'rh', 'beneficios', 'compras', 'operacional', 'faturamento'
    titulo TEXT NOT NULL,
    descricao TEXT,
    prazo_limite DATE,
    status TEXT DEFAULT 'Pendente', -- 'Pendente', 'Em Andamento', 'ConcluÃ­da'
    concluido_por TEXT,
    concluido_em DATETIME,
    observacoes_conclusao TEXT,
    FOREIGN KEY (ordem_id) REFERENCES ordens_implantacao(id) ON DELETE CASCADE
  );
`);

// 7. Mural de Comunicados da Empresa
db.exec(`
  CREATE TABLE IF NOT EXISTS comunicados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    categoria TEXT DEFAULT 'geral', -- 'geral', 'importante', 'urgente', 'novo_cliente'
    prioridade TEXT DEFAULT 'normal', -- 'normal', 'importante', 'urgente'
    setor_destino TEXT DEFAULT 'todos',
    autor_id INTEGER,
    autor_nome TEXT NOT NULL,
    autor_setor TEXT,
    ordem_implantacao_id INTEGER,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.exec("ALTER TABLE comunicados ADD COLUMN prioridade TEXT DEFAULT 'normal';"); } catch (e) {}
try { db.exec("ALTER TABLE comunicados ADD COLUMN destinatarios_tipo TEXT DEFAULT 'todos';"); } catch (e) {}
try { db.exec("ALTER TABLE comunicados ADD COLUMN destinatarios_alvo_json TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE comunicados ADD COLUMN editado_em DATETIME;"); } catch (e) {}
try { db.exec("ALTER TABLE ordens_implantacao_tarefas ADD COLUMN responsavel_nome TEXT;"); } catch (e) {}


try { db.exec("ALTER TABLE sst_modelos_ordens_servico ADD COLUMN titulo_modelo TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE colaboradores ADD COLUMN modelo_os_id INTEGER;"); } catch (e) {}
try { db.exec("UPDATE sst_modelos_ordens_servico SET titulo_modelo = nome_funcao WHERE titulo_modelo IS NULL OR titulo_modelo = '';"); } catch (e) {}

// Tabela de Modelos de Ordem de ServiÃ§o (NR-01) por FunÃ§Ã£o
db.exec(`
  CREATE TABLE IF NOT EXISTS sst_modelos_ordens_servico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cargo_id INTEGER,
    titulo_modelo TEXT,
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
    tipo_documento TEXT NOT NULL, -- 'TREINAMENTO_INTRODUTORIO', 'ORDEM_SERVICO'
    titulo TEXT NOT NULL,
    status_assinatura TEXT DEFAULT 'Pendente', -- 'Pendente', 'Assinado', 'Disponivel_Para_Arquivo', 'Arquivado'
    conteudo_json TEXT NOT NULL,
    data_geracao DATE NOT NULL,
    data_assinatura DATE,
    arquivo_status TEXT DEFAULT 'Nao_Solicitado', -- 'Nao_Solicitado', 'Solicitado', 'Arquivado'
    arquivo_registro_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sst_config_treinamento_padrao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    carga_horaria_total TEXT NOT NULL,
    local_treinamento TEXT NOT NULL,
    instrutor_nome TEXT NOT NULL,
    instrutor_registro TEXT NOT NULL,
    observacoes TEXT,
    modulos_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS setor_arquivos_documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    documento_sst_id INTEGER,
    tipo_documento TEXT NOT NULL, -- 'ORDEM_SERVICO', 'TREINAMENTO_INTRODUTORIO', 'CONTRATO_TRABALHO', 'FICHA_REGISTRO', 'ASO', 'OUTROS'
    descricao TEXT NOT NULL,
    solicitado_por_usuario_id INTEGER,
    solicitado_por_nome TEXT,
    data_solicitacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Aguardando_Arquivamento', -- 'Aguardando_Arquivamento', 'Arquivado'
    localizacao_caixa TEXT,
    localizacao_pasta TEXT,
    localizacao_estante TEXT,
    arquivado_por_usuario_id INTEGER,
    arquivado_por_nome TEXT,
    data_arquivamento DATETIME,
    observacoes TEXT,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS escalas_trabalho (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    tipo TEXT DEFAULT 'Semanal', -- 'Semanal', 'Plantao', 'Part-time', 'Multi-Cliente'
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

// InicializaÃ§Ã£o de Escalas PadrÃ£o
try {
  const totEsc = db.prepare('SELECT COUNT(*) as c FROM escalas_trabalho').get().c;
  if (totEsc === 0) {
    const escalasPadrao = [
      { nome: '5x2 Comercial (44h)', tipo: 'Semanal', carga_horaria_semanal: 44, carga_horaria_diaria: 8.8, dias_semana_json: JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex']), horario_entrada: '08:00', horario_saida: '17:48', intervalo_minutos: 60, descricao: 'Jornada comercial de segunda a sexta-feira (44h semanais)', cor: 'blue' },
      { nome: '6x1 PadrÃ£o (44h)', tipo: 'Semanal', carga_horaria_semanal: 44, carga_horaria_diaria: 7.33, dias_semana_json: JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']), horario_entrada: '08:00', horario_saida: '16:20', intervalo_minutos: 60, descricao: 'Jornada de 6 dias de trabalho por 1 de folga (44h semanais)', cor: 'emerald' },
      { nome: '12x36 Diurno', tipo: 'Plantao', carga_horaria_semanal: 36, carga_horaria_diaria: 12, dias_semana_json: JSON.stringify(['revezamento']), horario_entrada: '07:00', horario_saida: '19:00', intervalo_minutos: 60, descricao: 'PlantÃ£o diurno 12h de trabalho por 36h de descanso', cor: 'indigo' },
      { nome: '12x36 Noturno', tipo: 'Plantao', carga_horaria_semanal: 36, carga_horaria_diaria: 12, dias_semana_json: JSON.stringify(['revezamento']), horario_entrada: '19:00', horario_saida: '07:00', intervalo_minutos: 60, descricao: 'PlantÃ£o noturno 12h de trabalho por 36h de descanso', cor: 'purple' },
      { nome: '2x na Semana (Seg/Qua - 10h)', tipo: 'Part-time', carga_horaria_semanal: 10, carga_horaria_diaria: 5, dias_semana_json: JSON.stringify(['seg', 'qua']), horario_entrada: '08:00', horario_saida: '13:00', intervalo_minutos: 0, descricao: 'Escala parcial para atendimento multi-cliente (10h semanais)', cor: 'amber' },
      { nome: '2x na Semana (Ter/Qui - 16h)', tipo: 'Part-time', carga_horaria_semanal: 16, carga_horaria_diaria: 8, dias_semana_json: JSON.stringify(['ter', 'qui']), horario_entrada: '08:00', horario_saida: '17:00', intervalo_minutos: 60, descricao: 'Escala parcial para atendimento multi-cliente (16h semanais)', cor: 'orange' },
      { nome: '3x na Semana (Seg/Qua/Sex - 24h)', tipo: 'Part-time', carga_horaria_semanal: 24, carga_horaria_diaria: 8, dias_semana_json: JSON.stringify(['seg', 'qua', 'sex']), horario_entrada: '08:00', horario_saida: '17:00', intervalo_minutos: 60, descricao: 'Escala parcial para atendimento multi-cliente (24h semanais)', cor: 'rose' },
      { nome: '40h Semanal FlexÃ­vel (Multi-Postos)', tipo: 'Multi-Cliente', carga_horaria_semanal: 40, carga_horaria_diaria: 8, dias_semana_json: JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex']), horario_entrada: '08:00', horario_saida: '17:00', intervalo_minutos: 60, descricao: 'Carga integral de 40h dividida entre mÃºltiplos clientes', cor: 'teal' },
      { nome: '44h Semanal FlexÃ­vel (Multi-Postos)', tipo: 'Multi-Cliente', carga_horaria_semanal: 44, carga_horaria_diaria: 8.8, dias_semana_json: JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex']), horario_entrada: '08:00', horario_saida: '17:48', intervalo_minutos: 60, descricao: 'Carga integral de 44h dividida entre atÃ© 5 clientes', cor: 'sky' }
    ];
    const ins = db.prepare('INSERT OR IGNORE INTO escalas_trabalho (nome, tipo, carga_horaria_semanal, carga_horaria_diaria, dias_semana_json, horario_entrada, horario_saida, intervalo_minutos, descricao, cor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const esc of escalasPadrao) {
      ins.run(esc.nome, esc.tipo, esc.carga_horaria_semanal, esc.carga_horaria_diaria, esc.dias_semana_json, esc.horario_entrada, esc.horario_saida, esc.intervalo_minutos, esc.descricao, esc.cor);
    }
  }
} catch (e) {}

// 7.1 InicializaÃ§Ã£o do Cronograma PadrÃ£o de Treinamento Admissional de SST
try {
  const cfgTreinExistente = db.prepare('SELECT id FROM sst_config_treinamento_padrao LIMIT 1').get();
  if (!cfgTreinExistente) {
    const modulosPadrao = [
      {
        modulo: 'MÃ³dulo 01',
        carga_horaria: '1h30',
        tema: 'NR-01: DisposiÃ§Ãµes Gerais, Direitos e Deveres',
        modalidade: 'TeÃ³rico',
        descricao: 'Conceitos fundamentais de seguranÃ§a, responsabilidades da empresa e do colaborador, direito de recusa em risco grave e iminente, postura comportamental e cumprimento de normas operacionais.',
        instrutor: 'Cleverson Almeida (TST)'
      },
      {
        modulo: 'MÃ³dulo 02',
        carga_horaria: '1h30',
        tema: 'NR-06: Equipamentos de ProteÃ§Ã£o Individual (EPI)',
        modalidade: 'PrÃ¡tico / Demonstrativo',
        descricao: 'Obrigatoriedade de uso durante toda a jornada, importÃ¢ncia do Certificado de AprovaÃ§Ã£o (CA), higienizaÃ§Ã£o, guarda e conservaÃ§Ã£o correta, e procedimentos de substituiÃ§Ã£o imediata de EPI danificado.',
        instrutor: 'Cleverson Almeida (TST)'
      },
      {
        modulo: 'MÃ³dulo 03',
        carga_horaria: '1h00',
        tema: 'Reconhecimento de Riscos no Posto e Medidas Preventivas',
        modalidade: 'TeÃ³rico-PrÃ¡tico',
        descricao: 'IdentificaÃ§Ã£o dos perigos fÃ­sicos, quÃ­micos, biolÃ³gicos, ergonÃ´micos e mecÃ¢nicos pertinentes Ã  funÃ§Ã£o especÃ­fica, sinalizaÃ§Ã£o de piso molhado, ergonomia NR-17 e prevenÃ§Ã£o de quedas.',
        instrutor: 'Cleverson Almeida / Supervisor Operacional'
      },
      {
        modulo: 'MÃ³dulo 04',
        carga_horaria: '1h00',
        tema: 'PrevenÃ§Ã£o e PrincÃ­pios de Combate a IncÃªndio & Rotas de Fuga',
        modalidade: 'TeÃ³rico',
        descricao: 'Classes de fogo (A, B, C), tipos de extintores portÃ¡teis (Ãgua, PÃ³ QuÃ­mico e CO2), rotas de fuga, saÃ­das de emergÃªncia e desobstruÃ§Ã£o de corredores no cliente.',
        instrutor: 'Cleverson Almeida (TST)'
      },
      {
        modulo: 'MÃ³dulo 05',
        carga_horaria: '1h00',
        tema: 'NoÃ§Ãµes de Primeiros Socorros & ComunicaÃ§Ã£o de Incidentes (CAT)',
        modalidade: 'TeÃ³rico',
        descricao: 'Procedimentos imediatos em casos de mal sÃºbito ou ferimentos leves, acionamento do SAMU/Resgate e fluxo obrigatÃ³rio de comunicaÃ§Ã£o Ã  supervisÃ£o para emissÃ£o de CAT em atÃ© 24h.',
        instrutor: 'Cleverson Almeida (TST)'
      }
    ];

    db.prepare(`
      INSERT INTO sst_config_treinamento_padrao (
        titulo, carga_horaria_total, local_treinamento, instrutor_nome, instrutor_registro, observacoes, modulos_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Estrutura do Treinamento IntrodutÃ³rio Admissional de SST (NR-01 & NR-06)',
      '6 Horas',
      'Sede Operacional / Posto de ServiÃ§o',
      'Cleverson Almeida',
      'TST, DRT 0073086 / MG',
      'Treinamento introdutÃ³rio admissional de integraÃ§Ã£o em SeguranÃ§a e SaÃºde no Trabalho realizado com aproveitamento satisfatÃ³rio.',
      JSON.stringify(modulosPadrao)
    );
  }
} catch (e) {
  console.error('Erro ao inicializar sst_config_treinamento_padrao:', e);
}

// Atualizar documentos de treinamento pendentes com o instrutor padrÃ£o Cleverson Almeida
try {
  const docsTreinPendentes = db.prepare(`
    SELECT id, conteudo_json FROM sst_documentos_colaborador
    WHERE tipo_documento = 'TREINAMENTO_INTRODUTORIO' AND status_assinatura = 'Pendente'
  `).all();

  for (const d of docsTreinPendentes) {
    if (d.conteudo_json && d.conteudo_json.includes('Ricardo Silveira')) {
      let c = JSON.parse(d.conteudo_json);
      c.instrutor_nome = 'Cleverson Almeida';
      c.instrutor_registro = 'TST, DRT 0073086 / MG';
      c.instrutor = 'Cleverson Almeida';
      if (Array.isArray(c.cronograma)) {
        c.cronograma = c.cronograma.map(m => {
          if (m.instrutor && m.instrutor.includes('Ricardo')) {
            m.instrutor = 'Cleverson Almeida (TST)';
          }
          return m;
        });
      }
      db.prepare('UPDATE sst_documentos_colaborador SET conteudo_json = ? WHERE id = ?').run(JSON.stringify(c), d.id);
    }
  }
} catch (e) {}

// 8. ConfirmaÃ§Ã£o de Leitura dos Comunicados
db.exec(`
  CREATE TABLE IF NOT EXISTS comunicados_leituras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comunicado_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    usuario_nome TEXT,
    usuario_setor TEXT,
    data_leitura DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comunicado_id, usuario_id),
    FOREIGN KEY (comunicado_id) REFERENCES comunicados(id) ON DELETE CASCADE
  );
`);

// 9. ReaÃ§Ãµes com Emojis nos Comunicados
db.exec(`
  CREATE TABLE IF NOT EXISTS comunicados_reacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comunicado_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    usuario_nome TEXT,
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comunicado_id, usuario_id, emoji),
    FOREIGN KEY (comunicado_id) REFERENCES comunicados(id) ON DELETE CASCADE
  );
`);

// 10. MigraÃ§Ãµes para CondiÃ§Ãµes e Formas de Pagamento em Compras & OrÃ§amentos
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

// MigraÃ§Ãµes na tabela de fornecedores
try { db.exec("ALTER TABLE fornecedores ADD COLUMN chave_pix TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE fornecedores ADD COLUMN dados_bancarios TEXT;"); } catch (e) {}

// 11. Tabela Financeira Central de Contas a Pagar & ProgramaÃ§Ã£o de Vencimentos
db.exec(`
  CREATE TABLE IF NOT EXISTS contas_pagar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origem_tipo TEXT DEFAULT 'compra',         -- 'compra', 'avulso'
    origem_id INTEGER,                         -- ID de pedidos_orcamentos_compras se vinculado
    fornecedor_id INTEGER,                     -- ID do fornecedor
    fornecedor_nome TEXT NOT NULL,
    descricao TEXT NOT NULL,                   -- Ex: "Lote de Uniformes e Botas (Adiantamento 50%)"
    categoria TEXT DEFAULT 'Compras & Insumos',
    parcela_numero INTEGER DEFAULT 1,
    total_parcelas INTEGER DEFAULT 1,
    tipo_parcela TEXT DEFAULT 'Parcela',       -- 'Adiantamento / Entrada', 'Restante', 'Parcela 30d', etc.
    valor REAL NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    forma_pagamento TEXT NOT NULL DEFAULT 'PIX',
    dados_pagamento TEXT,                      -- Chave PIX, cÃ³digo de barras ou dados bancÃ¡rios
    status TEXT DEFAULT 'Pendente',            -- 'Pendente', 'Pago', 'Cancelado'
    data_pagamento DATETIME,
    pago_por_nome TEXT,
    pago_por_id INTEGER,
    comprovante_ref TEXT,                      -- NÃºmero de autenticaÃ§Ã£o bancÃ¡ria / comprovante
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (origem_id) REFERENCES pedidos_orcamentos_compras(id) ON DELETE CASCADE,
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
  );
`);

// MigraÃ§Ãµes seguras para historico_ferias (Processos de DP & PrevisÃ£o de Cobertura)
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN etapa_processo TEXT DEFAULT 'FÃ©rias solicitada ao Departamento Pessoal';"); } catch (e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN data_aviso_entregue DATE;"); } catch (e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN data_recibo_entregue DATE;"); } catch (e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN colaborador_substituto_id INTEGER;"); } catch (e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN nome_substituto_avulso TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE historico_ferias ADD COLUMN status_ferias TEXT DEFAULT 'Programada';"); } catch (e) {}

// MigraÃ§Ãµes para Transporte Multi-linhas e Reajustes
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

// Inserir leads de demonstraÃ§Ã£o se a tabela estiver vazia
try {
  const countLeads = db.prepare('SELECT COUNT(*) as c FROM leads_comercial').get().c;
  if (countLeads === 0) {
    const defaultLeads = [
      {
        nome_lead: 'CondomÃ­nio Residencial Parque das Flores',
        nome_fantasia: 'EdifÃ­cio Parque das Flores',
        cnpj: '45.123.890/0001-12',
        segmento: 'CondomÃ­nio Residencial',
        contato_nome: 'Dr. Roberto MagalhÃ£es',
        contato_cargo: 'SÃ­ndico Profissional',
        telefone: '(11) 3456-7890',
        whatsapp: '(11) 98765-4321',
        email: 'sindico@parquedasflores.com.br',
        cidade: 'SÃ£o Paulo',
        bairro: 'Vila Mariana',
        endereco: 'Rua Domingos de Morais, 1200',
        origem_lead: 'IndicaÃ§Ã£o',
        etapa: 'negociacao',
        probabilidade: 80,
        valor_estimado_mensal: 28500.00,
        quantidade_postos_estimada: 4,
        previsao_fechamento: '2026-10-05',
        data_inicio_prevista: '2026-10-15',
        responsavel_nome: 'Mariana Consultora',
        observacoes: 'Necessidade de 2 porteiros 12x36, 1 folguista e 1 ASG 44h semanais. DecisÃ£o na assembleia de condomÃ­nio.'
      },
      {
        nome_lead: 'Hospital Santa Clara SaÃºde Integral',
        nome_fantasia: 'Hospital Santa Clara',
        cnpj: '18.999.444/0001-88',
        segmento: 'Hospital/SaÃºde',
        contato_nome: 'Dra. Vanessa Meireles',
        contato_cargo: 'Gerente de Facilities e Hotelaria',
        telefone: '(11) 3100-2200',
        whatsapp: '(11) 99123-8888',
        email: 'facilities@hospitalsantaclara.med.br',
        cidade: 'SÃ£o Paulo',
        bairro: 'Bela Vista',
        endereco: 'Av. Paulista, 850',
        origem_lead: 'ProspecÃ§Ã£o Ativa',
        etapa: 'proposta',
        probabilidade: 60,
        valor_estimado_mensal: 45000.00,
        quantidade_postos_estimada: 8,
        previsao_fechamento: '2026-10-12',
        data_inicio_prevista: '2026-11-01',
        responsavel_nome: 'Carlos Santos',
        observacoes: 'Limpeza hospitalar e controle de acesso com escala 12x36 diurno e noturno.'
      },
      {
        nome_lead: 'Centro Empresarial Horizon Corporate',
        nome_fantasia: 'Horizon Corporate',
        cnpj: '33.555.777/0001-99',
        segmento: 'CondomÃ­nio Comercial',
        contato_nome: 'Eng. Marcelo Antunes',
        contato_cargo: 'Diretor Predial',
        telefone: '(11) 4002-8922',
        whatsapp: '(11) 98888-7777',
        email: 'operacoes@horizoncorporate.com.br',
        cidade: 'SÃ£o Paulo',
        bairro: 'Itaim Bibi',
        endereco: 'Rua Funchal, 418',
        origem_lead: 'TrÃ¡fego Pago',
        etapa: 'visita_tecnica',
        probabilidade: 40,
        valor_estimado_mensal: 38000.00,
        quantidade_postos_estimada: 6,
        previsao_fechamento: '2026-10-20',
        data_inicio_prevista: '2026-11-15',
        responsavel_nome: 'Mariana Consultora',
        observacoes: 'Visita tÃ©cnica realizada para mediÃ§Ã£o de Ã¡reas e mapeamento de recepÃ§Ã£o bilÃ­ngue e portaria.'
      },
      {
        nome_lead: 'ColÃ©gio Nova EsperanÃ§a do Saber',
        nome_fantasia: 'ColÃ©gio Nova EsperanÃ§a',
        cnpj: '12.333.444/0001-55',
        segmento: 'Escola/Faculdade',
        contato_nome: 'Profa. Helena Bittencourt',
        contato_cargo: 'Diretora Financeira',
        telefone: '(11) 2233-4455',
        whatsapp: '(11) 97777-6666',
        email: 'financeiro@colegionovaesperanca.edu.br',
        cidade: 'SÃ£o Paulo',
        bairro: 'Mooca',
        endereco: 'Rua da Mooca, 2500',
        origem_lead: 'IndicaÃ§Ã£o',
        etapa: 'prospeccao',
        probabilidade: 20,
        valor_estimado_mensal: 19500.00,
        quantidade_postos_estimada: 3,
        previsao_fechamento: '2026-10-30',
        data_inicio_prevista: '2026-12-01',
        responsavel_nome: 'Carlos Santos',
        observacoes: 'ContrataÃ§Ã£o prevista para inÃ­cio no prÃ³ximo ano letivo / fÃ©rias escolares.'
      }
    ];

    const stmtLead = db.prepare(`
      INSERT INTO leads_comercial (
        nome_lead, nome_fantasia, cnpj, segmento, contato_nome, contato_cargo,
        telefone, whatsapp, email, cidade, bairro, endereco, origem_lead,
        etapa, probabilidade, valor_estimado_mensal, quantidade_postos_estimada,
        previsao_fechamento, data_inicio_prevista, responsavel_nome, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const l of defaultLeads) {
      const resL = stmtLead.run(
        l.nome_lead, l.nome_fantasia, l.cnpj, l.segmento, l.contato_nome, l.contato_cargo,
        l.telefone, l.whatsapp, l.email, l.cidade, l.bairro, l.endereco, l.origem_lead,
        l.etapa, l.probabilidade, l.valor_estimado_mensal, l.quantidade_postos_estimada,
        l.previsao_fechamento, l.data_inicio_prevista, l.responsavel_nome, l.observacoes
      );
      db.prepare(`
        INSERT INTO leads_interacoes (lead_id, tipo, descricao, usuario_nome)
        VALUES (?, 'reuniao', 'ReuniÃ£o de alinhamento inicial e levantamento de necessidades do cliente.', 'Mariana Consultora')
      `).run(resL.lastInsertRowid);
    }
  }
} catch(e) {
  console.error('Erro ao semear leads comerciais:', e);
}

// Inserir comunicado de boas-vindas se tabela estiver vazia
try {
  const countCom = db.prepare('SELECT COUNT(*) as c FROM comunicados').get().c;
  if (countCom === 0) {
    db.prepare(`
      INSERT INTO comunicados (titulo, mensagem, categoria, setor_destino, autor_nome, autor_setor)
      VALUES (
        'ðŸ“¢ Bem-vindos ao Mural Corporativo do SISFAC 2.0',
        'Este Ã© o canal oficial de comunicados, novidades e ordens de implantaÃ§Ã£o da empresa. Fique atento Ã s notificaÃ§Ãµes e confirme sua leitura sempre que houver um novo comunicado.',
        'importante',
        'todos',
        'Administrador Master',
        'admin'
      )
    `).run();
  }
} catch(e) {}

// =============================================================
// MÃ“DULO DE AFASTAMENTOS, EAD TREINAMENTOS & CANAL DE DENÃšNCIAS
// =============================================================

// 1. Setor CoordenaÃ§Ã£o Operacional
try {
  const existeCoord = db.prepare("SELECT id FROM setores WHERE sigla = 'COP' OR nome_setor LIKE '%CoordenaÃ§Ã£o Operacional%'").get();
  if (!existeCoord) {
    db.prepare(`
      INSERT INTO setores (nome_setor, sigla, descricao, cor_badge)
      VALUES ('CoordenaÃ§Ã£o Operacional', 'COP', 'GestÃ£o Operacional, Canal de DenÃºncias, Compliance e Auditoria de Contratos', 'teal')
    `).run();
  }
} catch (e) {}

// 2. Afastamentos de Colaboradores
db.exec(`
  CREATE TABLE IF NOT EXISTS afastamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    cliente_id INTEGER,
    unidade_origem_id INTEGER,
    posto_origem_id INTEGER,
    cargo_origem_id INTEGER,
    data_inicio DATE NOT NULL,
    data_retorno_prevista DATE,
    data_retorno_efetiva DATE,
    motivo TEXT NOT NULL,
    cid TEXT,
    observacoes TEXT,
    status TEXT DEFAULT 'Ativo',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.exec('ALTER TABLE colaboradores ADD COLUMN afastado INTEGER DEFAULT 0;'); } catch (e) {}
try { db.exec('ALTER TABLE colaboradores ADD COLUMN afastamento_atual_id INTEGER;'); } catch (e) {}

function garantirPostoAfastados(clienteId) {
  if (!clienteId) {
    const primeiroCli = db.prepare('SELECT id FROM clientes LIMIT 1').get();
    clienteId = primeiroCli ? primeiroCli.id : 1;
  }
  let posto = db.prepare("SELECT id FROM postos_trabalho WHERE cliente_id = ? AND UPPER(nome_posto) LIKE '%AFASTADO%'").get(clienteId);
  if (!posto) {
    const cargo = db.prepare('SELECT id FROM cargos LIMIT 1').get();
    const cargoId = cargo ? cargo.id : 1;
    const res = db.prepare(`
      INSERT INTO postos_trabalho (cliente_id, cargo_id, nome_posto, quantidade_vagas_limite, escala, turno, observacoes, ativo)
      VALUES (?, ?, 'AFASTADOS', 999, 'Administrativo', 'Geral', 'Posto especial reservado para colaboradores temporariamente afastados', 1)
    `).run(clienteId, cargoId);
    return res.lastInsertRowid;
  }
  return posto.id;
}

// 3. Plataforma Externa de Treinamentos (EAD)
db.exec(`
  CREATE TABLE IF NOT EXISTS treinamento_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    nome_plataforma TEXT DEFAULT 'Academia de Treinamentos & CapacitaÃ§Ã£o',
    slogan TEXT DEFAULT 'Desenvolvimento profissional e excelÃªncia operacional de equipes',
    logo_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    cor_primaria TEXT DEFAULT '#0d9488',
    cor_secundaria TEXT DEFAULT '#1e293b',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try {
  db.exec("ALTER TABLE treinamento_config ADD COLUMN banner_url TEXT DEFAULT ''");
} catch(e) {}
db.exec(`

  CREATE TABLE IF NOT EXISTS treinamento_usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT,
    login TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL,
    bio TEXT,
    especialidade TEXT,
    foto_url TEXT,
    mensagem_instrutor TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS treinamento_cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT DEFAULT 'Operacional',
    carga_horaria_horas INTEGER DEFAULT 2,
    capa_url TEXT,
    instrutor_id INTEGER,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS treinamento_modulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    ordem INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS treinamento_aulas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modulo_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    tipo_conteudo TEXT DEFAULT 'video',
    video_url TEXT,
    conteudo_texto TEXT,
    material_apoio_url TEXT,
    duracao_minutos INTEGER DEFAULT 15,
    ordem INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS treinamento_provas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    nota_minima_aprovacao REAL DEFAULT 70,
    questoes_json TEXT,
    ativo INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS treinamento_matriculas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    curso_id INTEGER NOT NULL,
    progresso_percent REAL DEFAULT 0,
    nota_prova REAL,
    status TEXT DEFAULT 'Em Andamento',
    data_conclusao DATETIME,
    UNIQUE(usuario_id, curso_id)
  );
`);

try {
  const conf = db.prepare('SELECT id FROM treinamento_config WHERE id = 1').get();
  if (!conf) {
    db.prepare(`
      INSERT INTO treinamento_config (id, nome_plataforma, slogan, logo_url, cor_primaria, cor_secundaria)
      VALUES (1, 'Academia de Treinamentos & CapacitaÃ§Ã£o', 'Desenvolvimento profissional e excelÃªncia operacional de equipes', '', '#0d9488', '#1e293b')
    `).run();
  }
} catch (e) {}

try {
  const countUsersEad = db.prepare('SELECT COUNT(*) as c FROM treinamento_usuarios').get().c;
  if (countUsersEad === 0) {
    db.prepare(`
      INSERT INTO treinamento_usuarios (nome, email, login, senha, tipo, especialidade, bio, foto_url, mensagem_instrutor)
      VALUES 
      ('Administrador Geral', 'admin@sisfac.com.br', 'admin', 'admin123', 'admin', 'GestÃ£o & Diretoria de Treinamentos', 'Diretoria executiva responsÃ¡vel pela formaÃ§Ã£o contÃ­nua, governanÃ§a e capacitaÃ§Ã£o dos colaboradores.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 'Bem-vindo ao nosso espaÃ§o de aprendizado contÃ­nuo! O seu desenvolvimento tÃ©cnico e humano Ã© o nosso maior valor.'),
      ('Prof. Marcos AurÃ©lio', 'marcos.instrutor@sisfac.com.br', 'prof.marcos', '123456', 'professor', 'SeguranÃ§a do Trabalho & Procedimentos Operacionais', 'TÃ©cnico em SeguranÃ§a do Trabalho e Instrutor Operacional de Facilities com 14 anos de experiÃªncia em contratos corporativos.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80', 'OlÃ¡, aluno! Dedique-se com atenÃ§Ã£o a cada aula. A correta execuÃ§Ã£o das tarefas diÃ¡rias e o uso de EPIs garantem o seu sucesso e a sua proteÃ§Ã£o.'),
      ('Profa. Camila Silveira', 'camila.instrutora@sisfac.com.br', 'prof.camila', '123456', 'professor', 'Atendimento ao Cliente, Portaria & Postura Profissional', 'Especialista em GestÃ£o de Pessoas, LideranÃ§a de Equipes e Atendimento de ExcelÃªncia no setor de ServiÃ§os.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80', 'Muito bem-vindo! Uma comunicaÃ§Ã£o cordial, postura Ã©tica e zelo pelo cliente abrem portas para o seu crescimento dentro da empresa.')
    `).run();

    const insCurso = db.prepare(`
      INSERT INTO treinamento_cursos (titulo, descricao, categoria, carga_horaria_horas, capa_url, instrutor_id)
      VALUES (
        'Manual de Boas PrÃ¡ticas Operacionais & Postura Profissional',
        'CapacitaÃ§Ã£o essencial sobre conduta no posto de trabalho, apresentaÃ§Ã£o pessoal, uso rigoroso de EPIs, pontualidade e excelÃªncia no atendimento.',
        'IntegraÃ§Ã£o & Postura',
        4,
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=600&q=80',
        2
      )
    `).run();
    const cursoId = insCurso.lastInsertRowid;

    const insMod1 = db.prepare(`
      INSERT INTO treinamento_modulos (curso_id, titulo, ordem)
      VALUES (?, 'MÃ³dulo 1: ApresentaÃ§Ã£o Pessoal, UniformizaÃ§Ã£o & SeguranÃ§a', 1)
    `).run(cursoId);
    const mod1Id = insMod1.lastInsertRowid;

    db.prepare(`
      INSERT INTO treinamento_aulas (modulo_id, titulo, tipo_conteudo, video_url, conteudo_texto, duracao_minutos, ordem)
      VALUES (?, 'Aula 1: Cuidados com Uniforme, CrachÃ¡ e ApresentaÃ§Ã£o Pessoal', 'video', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'O uniforme e o crachÃ¡ representam a identidade corporativa perante o cliente. Mantenha crachÃ¡ visÃ­vel no tÃ³rax e uniforme sempre limpo e alinhado.', 12, 1)
    `).run(mod1Id);

    db.prepare(`
      INSERT INTO treinamento_aulas (modulo_id, titulo, tipo_conteudo, video_url, conteudo_texto, duracao_minutos, ordem)
      VALUES (?, 'Aula 2: UtilizaÃ§Ã£o Correta de Equipamentos de ProteÃ§Ã£o Individual (EPIs)', 'video', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'O uso dos EPIs indicados para cada funÃ§Ã£o Ã© obrigatÃ³rio por lei e fundamental para preservar sua saÃºde e integridade fÃ­sica em todas as atividades.', 15, 2)
    `).run(mod1Id);

    const questoesExemplo = [
      {
        id: 1,
        pergunta: 'Em relaÃ§Ã£o ao crachÃ¡ de identificaÃ§Ã£o no posto de trabalho, qual Ã© a conduta correta?',
        opcoes: [
          'Guardar no bolso para nÃ£o perder ou quebrar',
          'Manter fixado e visÃ­vel na altura do tÃ³rax durante todo o perÃ­odo de trabalho',
          'Utilizar somente nos horÃ¡rios de entrada e saÃ­da',
          'Ã‰ opcional para funcionÃ¡rios com mais de 6 meses de empresa'
        ],
        correta: 1,
        explicacao: 'O crachÃ¡ Ã© item obrigatÃ³rio de identificaÃ§Ã£o e seguranÃ§a patrimonial em todos os postos de serviÃ§o.'
      },
      {
        id: 2,
        pergunta: 'Ao se deparar com um piso molhado ou produto quÃ­mico derramado no local, qual a primeira providÃªncia?',
        opcoes: [
          'Limpar sem equipamentos de proteÃ§Ã£o para ser mais rÃ¡pido',
          'Sinalizar e isolar a Ã¡rea com cones ou placas, utilizando os EPIs corretos antes da limpeza',
          'Ignorar e esperar que o piso seque sozinho',
          'Despejar Ã¡gua sanitÃ¡ria diretamente por cima'
        ],
        correta: 1,
        explicacao: 'A sinalizaÃ§Ã£o prÃ©via com cones evita quedas e acidentes com terceiros, e o uso de EPI protege o trabalhador.'
      }
    ];

    db.prepare(`
      INSERT INTO treinamento_provas (curso_id, titulo, nota_minima_aprovacao, questoes_json)
      VALUES (?, 'AvaliaÃ§Ã£o DidÃ¡tica de FixaÃ§Ã£o - MÃ³dulo de Boas PrÃ¡ticas', 70, ?)
    `).run(cursoId, JSON.stringify(questoesExemplo));
  }
} catch (e) {
  console.error('Erro ao inicializar cursos EAD:', e);
}

// 4. Canal / Portal de DenÃºncias (Compliance & LGPD)
db.exec(`
  CREATE TABLE IF NOT EXISTS denuncias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    protocolo TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'Anonima',
    nome_denunciante TEXT,
    cpf_denunciante TEXT,
    email_denunciante TEXT,
    telefone_denunciante TEXT,
    categoria TEXT NOT NULL,
    unidade_ou_local TEXT,
    data_ocorrencia DATE,
    pessoas_envolvidas TEXT,
    testemunhas TEXT,
    descricao_detalhada TEXT NOT NULL,
    evidencias_anexos TEXT,
    status TEXT DEFAULT 'Nova',
    gravidade TEXT DEFAULT 'MÃ©dia',
    responsavel_setor TEXT DEFAULT 'CoordenaÃ§Ã£o Operacional',
    tratativas TEXT,
    parecer_final TEXT,
    data_conclusao DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS solicitacoes_admissao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT,
    cargo_id INTEGER,
    cliente_id INTEGER,
    escala TEXT,
    status TEXT DEFAULT 'Pendente Gerente', -- 'Rascunho', 'Pendente Gerente', 'Pendente Auditoria', 'Autorizado', 'Efetivado', 'Rejeitado'
    solicitante_nome TEXT,
    posto_trabalho_id INTEGER,
    motivo_vaga TEXT, -- 'Substituicao', 'Reserva Tecnica', 'Aumento Quadro'
    colaborador_substituido_id INTEGER,
    gerencia_aprovado_por TEXT,
    gerencia_aprovado_em DATETIME,
    auditoria_aprovado_por TEXT,
    auditoria_aprovado_em DATETIME,
    dados_completos_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admissao_mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER NOT NULL,
    autor_nome TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);


function gerarDocumentosSSTParaColaborador(colaboradorId, cargoId = null, modeloOsId = null) {
  try {
    const col = db.prepare(`
      SELECT c.id, c.nome, c.cpf, c.cargo_id, c.modelo_os_id, c.data_admissao, cg.nome_cargo, cli.nome_fantasia as cliente_nome, pt.nome_posto
      FROM colaboradores c
      LEFT JOIN cargos cg ON c.cargo_id = cg.id
      LEFT JOIN clientes cli ON c.cliente_id = cli.id
      LEFT JOIN postos_trabalho pt ON c.posto_trabalho_id = pt.id
      WHERE c.id = ?
    `).get(colaboradorId);

    if (!col) return null;

    const dataRef = col.data_admissao || new Date().toISOString().split('T')[0];
    const finalCargoId = cargoId || col.cargo_id;
    const finalModeloOsId = modeloOsId || col.modelo_os_id;

    // 1. Documento Treinamento IntrodutÃ³rio SST
    let cfgTrein = null;
    try {
      cfgTrein = db.prepare('SELECT * FROM sst_config_treinamento_padrao ORDER BY id ASC LIMIT 1').get();
    } catch (e) {}

    let modulosCfg = [];
    if (cfgTrein && cfgTrein.modulos_json) {
      try { modulosCfg = JSON.parse(cfgTrein.modulos_json); } catch (e) {}
    }

    const instrutorNome = cfgTrein?.instrutor_nome || 'Cleverson Almeida';
    const instrutorReg = cfgTrein?.instrutor_registro || 'TST, DRT 0073086 / MG';
    const cargaTotal = cfgTrein?.carga_horaria_total || '6 Horas';
    const localTrein = cfgTrein?.local_treinamento || 'Sede Operacional / Posto de ServiÃ§o';
    const obsTrein = cfgTrein?.observacoes || 'Treinamento introdutÃ³rio admissional de integraÃ§Ã£o em SeguranÃ§a e SaÃºde no Trabalho realizado com aproveitamento satisfatÃ³rio.';

    const cronogramaFinal = (Array.isArray(modulosCfg) && modulosCfg.length > 0) ? modulosCfg : [
      { modulo: 'MÃ³dulo 1', tema: 'NR-01: DisposiÃ§Ãµes Gerais, Direitos e Deveres do Empregador e Empregado', carga_horaria: '1h30', modalidade: 'TeÃ³rico', instrutor: 'Cleverson Almeida (TST)' },
      { modulo: 'MÃ³dulo 2', tema: 'NR-06: Equipamentos de ProteÃ§Ã£o Individual (EPI) - Uso, ConservaÃ§Ã£o e Guarda', carga_horaria: '1h30', modalidade: 'PrÃ¡tico / Demonstrativo', instrutor: 'Cleverson Almeida (TST)' },
      { modulo: 'MÃ³dulo 3', tema: 'IdentificaÃ§Ã£o de Riscos no Posto de Trabalho e Medidas Preventivas', carga_horaria: '1h00', modalidade: 'TeÃ³rico-PrÃ¡tico', instrutor: 'Cleverson Almeida / Supervisor Operacional' },
      { modulo: 'MÃ³dulo 4', tema: 'PrevenÃ§Ã£o e PrincÃ­pios de Combate a IncÃªndio & Rotas de Fuga', carga_horaria: '1h00', modalidade: 'TeÃ³rico', instrutor: 'Cleverson Almeida (TST)' },
      { modulo: 'MÃ³dulo 5', tema: 'NoÃ§Ãµes de Primeiros Socorros e ComunicaÃ§Ã£o Imediata de Incidentes (CAT)', carga_horaria: '1h00', modalidade: 'TeÃ³rico', instrutor: 'Cleverson Almeida (TST)' }
    ];

    const conteudoTreinamento = {
      colaborador_id: col.id,
      colaborador_nome: col.nome,
      colaborador_cpf: col.cpf || 'NÃ£o informado',
      cargo_funcao: col.nome_cargo || 'Colaborador Efetivo',
      cliente_nome: col.cliente_nome || 'Base Operacional',
      posto_nome: col.nome_posto || 'Posto Operacional',
      data_admissao: col.data_admissao || dataRef,
      data_treinamento: dataRef,
      carga_horaria_total: cargaTotal,
      local_treinamento: localTrein,
      instrutor_nome: instrutorNome,
      instrutor_registro: instrutorReg,
      cronograma: cronogramaFinal,
      observacoes: obsTrein
    };

    const resTrein = db.prepare(`
      INSERT INTO sst_documentos_colaborador (
        colaborador_id, tipo_documento, titulo, status_assinatura, conteudo_json, data_geracao, arquivo_status
      ) VALUES (?, 'TREINAMENTO_INTRODUTORIO', ?, 'Pendente', ?, ?, 'Nao_Solicitado')
    `).run(
      col.id,
      `Lista de PresenÃ§a - Treinamento IntrodutÃ³rio de SST (NR-01) - ${col.nome}`,
      JSON.stringify(conteudoTreinamento),
      dataRef
    );

    // 2. Documento Ordem de ServiÃ§o (NR-01)
    let modelo = null;
    if (finalModeloOsId) {
      modelo = db.prepare('SELECT * FROM sst_modelos_ordens_servico WHERE id = ? AND ativo = 1').get(finalModeloOsId);
    }
    if (!modelo && finalCargoId) {
      modelo = db.prepare('SELECT * FROM sst_modelos_ordens_servico WHERE cargo_id = ? AND ativo = 1 ORDER BY id DESC LIMIT 1').get(finalCargoId);
    }
    if (!modelo && col.nome_cargo) {
      modelo = db.prepare('SELECT * FROM sst_modelos_ordens_servico WHERE LOWER(nome_funcao) LIKE LOWER(?) AND ativo = 1 ORDER BY id DESC LIMIT 1').get(`%${col.nome_cargo}%`);
    }
    if (!modelo) {
      modelo = db.prepare('SELECT * FROM sst_modelos_ordens_servico ORDER BY id ASC LIMIT 1').get();
    }

    const rotuloModelo = (modelo && (modelo.titulo_modelo || modelo.nome_funcao)) ? (modelo.titulo_modelo || modelo.nome_funcao) : (col.nome_cargo || 'FunÃ§Ã£o');

    const conteudoOS = {
      colaborador_id: col.id,
      colaborador_nome: col.nome,
      colaborador_cpf: col.cpf || 'NÃ£o informado',
      cargo_funcao: col.nome_cargo || (modelo ? modelo.nome_funcao : 'Colaborador'),
      titulo_modelo: modelo ? (modelo.titulo_modelo || modelo.nome_funcao) : null,
      modelo_os_id: modelo ? modelo.id : null,
      cliente_nome: col.cliente_nome || 'Posto de Trabalho',
      posto_nome: col.nome_posto || 'Posto Operacional',
      data_admissao: col.data_admissao || dataRef,
      data_emissao: dataRef,
      revisao: '01/2026',
      descricao_atividades: modelo ? modelo.descricao_atividades : 'Atividades pertinentes Ã  funÃ§Ã£o contratada.',
      riscos_ocupacionais: modelo ? JSON.parse(modelo.riscos_ocupacionais_json || '[]') : [],
      epis_obrigatorios: modelo ? JSON.parse(modelo.epis_obrigatorios_json || '[]') : [],
      medidas_preventivas: modelo ? modelo.medidas_preventivas : 'Cumprir as orientaÃ§Ãµes de seguranÃ§a da empresa.',
      normas_proibicoes: modelo ? modelo.normas_proibicoes : 'Proibido realizar atividades sem os devidos EPIs.',
      termo_compromisso: modelo ? modelo.termo_compromisso : 'Comprometo-me a cumprir todas as normas de seguranÃ§a do trabalho.'
    };

    const resOS = db.prepare(`
      INSERT INTO sst_documentos_colaborador (
        colaborador_id, tipo_documento, titulo, status_assinatura, conteudo_json, data_geracao, arquivo_status
      ) VALUES (?, 'ORDEM_SERVICO', ?, 'Pendente', ?, ?, 'Nao_Solicitado')
    `).run(
      col.id,
      `Ordem de ServiÃ§o (OS - NR-01) - ${rotuloModelo} - ${col.nome}`,
      JSON.stringify(conteudoOS),
      dataRef
    );

    return { treinamento_id: resTrein.lastInsertRowid, ordem_servico_id: resOS.lastInsertRowid };
  } catch (err) {
    console.error('Erro ao gerar documentos SST para colaborador:', err);
    return null;
  }
}

function obterOuCriarPedidoCompras(clienteId, anoMes) {
  let pedido = db.prepare('SELECT * FROM pedidos_compras_mensal WHERE ano_mes = ? AND cliente_id = ?').get(anoMes, clienteId);
  if (!pedido) {
    const tokenPublico = crypto.randomBytes(12).toString('hex');
    const res = db.prepare('INSERT INTO pedidos_compras_mensal (ano_mes, cliente_id, status, token_publico) VALUES (?, ?, ?, ?)').run(anoMes, clienteId, 'Rascunho', tokenPublico);
    pedido = { id: res.lastInsertRowid, ano_mes: anoMes, cliente_id: clienteId, status: 'Rascunho', token_publico: tokenPublico };
  } else if (!pedido.token_publico) {
    const tokenPublico = crypto.randomBytes(12).toString('hex');
    db.prepare('UPDATE pedidos_compras_mensal SET token_publico = ? WHERE id = ?').run(tokenPublico, pedido.id);
    pedido.token_publico = tokenPublico;
  }

  // Garantir registros de status e token para cada unidade ativa do cliente
  const unidades = db.prepare('SELECT id, responsavel_local, telefone_local FROM unidades WHERE cliente_id = ? AND ativo = 1').all(clienteId);
  for (const u of unidades) {
    let pus = db.prepare('SELECT id, token_acesso FROM pedido_unidade_status WHERE pedido_id = ? AND unidade_id = ?').get(pedido.id, u.id);
    if (!pus) {
      const tokenAcesso = crypto.randomBytes(12).toString('hex');
      db.prepare(`
        INSERT INTO pedido_unidade_status (pedido_id, unidade_id, status, responsavel_nome, responsavel_telefone, token_acesso)
        VALUES (?, ?, 'Pendente', ?, ?, ?)
      `).run(pedido.id, u.id, u.responsavel_local || '', u.telefone_local || '', tokenAcesso);
    } else if (!pus.token_acesso) {
      const tokenAcesso = crypto.randomBytes(12).toString('hex');
      db.prepare('UPDATE pedido_unidade_status SET token_acesso = ? WHERE id = ?').run(tokenAcesso, pus.id);
    }
  }

  return pedido;
}

function calcularDiasUteisPeriodo(dataInicioStr, dataFimStr, escala = '5x2') {
  if (!dataInicioStr || !dataFimStr) return 0;
  const inicio = new Date(dataInicioStr + 'T00:00:00');
  const fim = new Date(dataFimStr + 'T00:00:00');
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || inicio > fim) return 0;

  let total = 0;
  const curr = new Date(inicio);
  let step12x36 = 0;

  while (curr <= fim) {
    const dayOfWeek = curr.getDay(); // 0 = Domingo, 6 = SÃ¡bado
    if (escala.includes('5x2')) {
      if (dayOfWeek !== 0 && dayOfWeek !== 6) total++;
    } else if (escala.includes('6x1')) {
      if (dayOfWeek !== 0) total++;
    } else if (escala.includes('12x36')) {
      if (step12x36 % 2 === 0) total++;
      step12x36++;
    } else {
      if (dayOfWeek !== 0 && dayOfWeek !== 6) total++;
    }
    curr.setDate(curr.getDate() + 1);
  }
  return total;
}

function normalizarDataISO(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    if (val > 1000 && val < 100000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const p = str.split('/');
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    try {
      return d.toISOString().split('T')[0];
    } catch (e) {}
  }
  return str;
}

function registrarEventoHistoricoColaborador(colaboradorId, tipoEvento, titulo, descricao, dataEvento = null, dadosJson = null, responsavel = 'Sistema') {
  try {
    const data = dataEvento || new Date().toISOString().split('T')[0];
    const jsonStr = dadosJson ? (typeof dadosJson === 'string' ? dadosJson : JSON.stringify(dadosJson)) : null;
    db.prepare(`
      INSERT INTO historico_eventos_colaborador (
        colaborador_id, tipo_evento, titulo, descricao, data_evento, dados_adicionais_json, usuario_responsavel
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(colaboradorId, tipoEvento, titulo, descricao, data, jsonStr, responsavel);
  } catch (err) {
    console.error(`[Historico] Erro ao registrar evento para colaborador ${colaboradorId}:`, err.message);
  }
}

function calcularTempoEmpresa(dataAdmissaoStr, dataFimStr = null) {
  if (!dataAdmissaoStr) return 'NÃ£o informada';
  const inicio = new Date(dataAdmissaoStr + 'T00:00:00');
  const fim = dataFimStr ? new Date(dataFimStr + 'T00:00:00') : new Date();
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || inicio > fim) return 'Recente';

  let anos = fim.getFullYear() - inicio.getFullYear();
  let meses = fim.getMonth() - inicio.getMonth();
  let dias = fim.getDate() - inicio.getDate();

  if (dias < 0) {
    meses--;
    const ultimoDiaMesAnterior = new Date(fim.getFullYear(), fim.getMonth(), 0).getDate();
    dias += ultimoDiaMesAnterior;
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }

  const partes = [];
  if (anos > 0) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mÃªs' : 'meses'}`);
  if (dias > 0 || partes.length === 0) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);

  return partes.join(', ');
}

// -------------------------------------------------------------
// SINCRONIZAÃ‡ÃƒO DE CONTAS A PAGAR & PARCELAS DE COMPRAS
// -------------------------------------------------------------
function sincronizarContasPagarDoPedido(pedidoId) {
  try {
    const p = db.prepare(`
      SELECT po.*, f.nome_empresa as fornecedor_nome, f.chave_pix as fornecedor_pix, f.dados_bancarios as fornecedor_banco
      FROM pedidos_orcamentos_compras po
      LEFT JOIN fornecedores f ON po.fornecedor_id = f.id
      WHERE po.id = ?
    `).get(pedidoId);
    if (!p) return;

    const fornecedorNome = p.fornecedor_nome || 'Fornecedor Diversos';
    const formaPagamento = p.forma_pagamento || 'PIX';
    const dadosPagamento = p.dados_pagamento || p.fornecedor_pix || p.fornecedor_banco || '';

    // Mapear parcelas jÃ¡ pagas para preservar comprovante e data de liquidaÃ§Ã£o
    const parcelasPagas = db.prepare(`
      SELECT parcela_numero, data_pagamento, pago_por_nome, pago_por_id, comprovante_ref, observacoes
      FROM contas_pagar
      WHERE origem_id = ? AND status = 'Pago'
    `).all(pedidoId);
    const mapaPagas = new Map(parcelasPagas.map(item => [item.parcela_numero, item]));

    // Excluir apenas parcelas pendentes anteriores desta compra para recriÃ¡-las sincronizadas
    db.prepare(`DELETE FROM contas_pagar WHERE origem_id = ? AND status != 'Pago'`).run(pedidoId);

    let parcelas = [];
    if (p.parcelas_json) {
      try {
        const parsed = JSON.parse(p.parcelas_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parcelas = parsed;
        }
      } catch (e) {}
    }

    if (parcelas.length === 0) {
      const total = parseFloat(p.valor_total) || 0;
      const adiantamento = parseFloat(p.valor_adiantamento) || 0;
      const dataAdiantamento = p.data_adiantamento || new Date().toISOString().slice(0, 10);
      const restante = parseFloat(p.valor_restante) || Math.max(0, total - adiantamento);
      const dataRestante = p.data_vencimento_restante || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      if (adiantamento > 0 && restante > 0) {
        parcelas = [
          { numero: 1, tipo: 'Adiantamento / Entrada', valor: adiantamento, data_vencimento: dataAdiantamento },
          { numero: 2, tipo: `Restante (${p.prazo_restante_dias || 30} dias)`, valor: restante, data_vencimento: dataRestante }
        ];
      } else {
        parcelas = [
          { numero: 1, tipo: 'Parcela Ãšnica', valor: total, data_vencimento: dataAdiantamento }
        ];
      }
    }

    const stmtInsert = db.prepare(`
      INSERT INTO contas_pagar (
        origem_tipo, origem_id, fornecedor_id, fornecedor_nome, descricao, categoria,
        parcela_numero, total_parcelas, tipo_parcela, valor, data_vencimento,
        forma_pagamento, dados_pagamento, status, data_pagamento, pago_por_nome, pago_por_id,
        comprovante_ref, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < parcelas.length; i++) {
      const parc = parcelas[i];
      const num = parc.numero || (i + 1);
      const jaPaga = mapaPagas.get(num);
      const tipo = parc.tipo || (parcelas.length > 1 ? `Parcela ${num}/${parcelas.length}` : 'Parcela Ãšnica');
      const desc = `${p.titulo_orcamento} (${tipo})`;

      stmtInsert.run(
        'compra',
        pedidoId,
        p.fornecedor_id || null,
        fornecedorNome,
        desc,
        p.categoria_compra || 'Compras & Insumos',
        num,
        parcelas.length,
        tipo,
        parseFloat(parc.valor) || 0,
        parc.data_vencimento || new Date().toISOString().slice(0, 10),
        formaPagamento,
        dadosPagamento,
        jaPaga ? 'Pago' : 'Pendente',
        jaPaga ? jaPaga.data_pagamento : null,
        jaPaga ? jaPaga.pago_por_nome : null,
        jaPaga ? jaPaga.pago_por_id : null,
        jaPaga ? jaPaga.comprovante_ref : null,
        jaPaga ? jaPaga.observacoes : null
      );
    }

    atualizarStatusFinanceiroDoPedido(pedidoId);
  } catch (err) {
    console.error('Erro ao sincronizar contas a pagar do pedido:', err);
  }
}

function atualizarStatusFinanceiroDoPedido(pedidoId) {
  try {
    const contas = db.prepare('SELECT status FROM contas_pagar WHERE origem_id = ?').all(pedidoId);
    if (!contas || contas.length === 0) return;
    const pagas = contas.filter(c => c.status === 'Pago').length;
    let novoStatus = 'Pendente';
    if (pagas === contas.length) {
      novoStatus = 'Pago';
    } else if (pagas > 0) {
      novoStatus = 'Parcialmente Pago';
    }
    db.prepare('UPDATE pedidos_orcamentos_compras SET status_financeiro = ? WHERE id = ?').run(novoStatus, pedidoId);
  } catch (err) {
    console.error('Erro ao atualizar status financeiro do pedido:', err);
  }
}

// Sincronizar compras legadas na inicializaÃ§Ã£o se ainda nÃ£o estiverem no contas_pagar
try {
  const orcsSemConta = db.prepare(`
    SELECT po.id FROM pedidos_orcamentos_compras po
    WHERE NOT EXISTS (SELECT 1 FROM contas_pagar cp WHERE cp.origem_id = po.id)
  `).all();
  for (const o of orcsSemConta) {
    sincronizarContasPagarDoPedido(o.id);
  }
} catch(e) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function jsonResponse(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(JSON.stringify(data));
}

function errorResponse(res, message, statusCode = 500) {
  jsonResponse(res, { error: true, message }, statusCode);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error('Body muito grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const query = parsedUrl.query;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // =============================================================
  // ROTAS DA API REST
  // =============================================================
  if (pathname.startsWith('/api/')) {
    try {
      // -----------------------------------------------------------
      // 1. AUTENTICAÃ‡ÃƒO E LOGIN (RBAC)
      // -----------------------------------------------------------
      
      if (pathname === '/api/tunnel' && method === 'GET') {
        const tunnelUrl = obterUrlTunnel();
        const localIp = obterIpLocal();
        return jsonResponse(res, {
          url: tunnelUrl,
          local_url: `http://${localIp}:${PORT}`
        });
      }
      if (pathname === '/api/auth/login' && method === 'POST') {
        const { login, senha } = await parseRequestBody(req);
        if (!login || !senha) return errorResponse(res, 'Login e senha sÃ£o obrigatÃ³rios', 400);

        const usuario = db.prepare('SELECT id, nome, login, setor, email, pode_enviar_comunicados, ativo FROM usuarios WHERE login = ? AND senha = ? AND ativo = 1').get(login, senha);
        if (!usuario) {
          return errorResponse(res, 'Login ou senha invÃ¡lidos', 401);
        }
        if (usuario.setor === 'admin' || usuario.setor === 'Administrador Master' || usuario.login === 'admin') {
          usuario.pode_enviar_comunicados = 1;
        }

        // Buscar permissÃµes granulares
        const permissoes = db.prepare('SELECT modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir, pode_aprovar FROM permissoes_usuario WHERE usuario_id = ?').all(usuario.id);

        return jsonResponse(res, {
          success: true,
          usuario,
          permissoes
        });
      }

      // -----------------------------------------------------------
      // 2. GESTÃƒO DE USUÃRIOS E PERMISSÃ•ES (ADMINISTRADOR)
      // -----------------------------------------------------------
      if (pathname === '/api/usuarios' && method === 'GET') {
        const usuarios = db.prepare('SELECT id, nome, login, setor, email, pode_enviar_comunicados, ativo, created_at FROM usuarios ORDER BY nome ASC').all();
        for (const u of usuarios) {
          if (u.setor === 'admin' || u.setor === 'Administrador Master' || u.login === 'admin') u.pode_enviar_comunicados = 1;
          u.permissoes = db.prepare('SELECT modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir, pode_aprovar FROM permissoes_usuario WHERE usuario_id = ?').all(u.id);
        }
        return jsonResponse(res, usuarios);
      }

      if (pathname === '/api/usuarios' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome || !body.login || !body.senha || !body.setor) {
          return errorResponse(res, 'Nome, Login, Senha e Setor sÃ£o obrigatÃ³rios', 400);
        }

        const existe = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(body.login);
        if (existe) return errorResponse(res, 'JÃ¡ existe um usuÃ¡rio cadastrado com este login', 400);

        const ehAdminSetor = body.setor === 'admin' || body.setor === 'Administrador Master' || body.login === 'admin';
        const podeEnviar = body.pode_enviar_comunicados ? 1 : (ehAdminSetor ? 1 : 0);
        const stmt = db.prepare('INSERT INTO usuarios (nome, login, senha, setor, email, pode_enviar_comunicados) VALUES (?, ?, ?, ?, ?, ?)');
        const result = stmt.run(body.nome, body.login, body.senha, body.setor, body.email || '', podeEnviar);
        const userId = result.lastInsertRowid;

        // Inserir permissÃµes selecionadas
        if (body.permissoes && Array.isArray(body.permissoes)) {
          const stmtPerm = db.prepare(`
            INSERT INTO permissoes_usuario (usuario_id, modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir, pode_aprovar)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of body.permissoes) {
            const modulo = typeof p === 'string' ? p : (p && p.modulo ? p.modulo : '');
            if (!modulo) continue;
            const podeVis = typeof p === 'object' && p.pode_visualizar !== undefined ? (p.pode_visualizar ? 1 : 0) : 1;
            const podeCriar = typeof p === 'object' && p.pode_criar !== undefined ? (p.pode_criar ? 1 : 0) : 1;
            const podeEdit = typeof p === 'object' && p.pode_editar !== undefined ? (p.pode_editar ? 1 : 0) : 1;
            const podeExcl = typeof p === 'object' && p.pode_excluir !== undefined ? (p.pode_excluir ? 1 : 0) : 1;
            const podeAprov = typeof p === 'object' && p.pode_aprovar !== undefined ? (p.pode_aprovar ? 1 : 0) : 0;
            stmtPerm.run(userId, modulo, podeVis, podeCriar, podeEdit, podeExcl, podeAprov);
          }
        }

        return jsonResponse(res, { success: true, id: userId });
      }

      if (pathname.startsWith('/api/usuarios/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);

        // Buscar usuÃ¡rio atual no banco
        const usuarioAtual = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
        if (!usuarioAtual) {
          return errorResponse(res, 'UsuÃ¡rio nÃ£o encontrado', 404);
        }

        const nomeFinal = (body.nome !== undefined ? body.nome : usuarioAtual.nome || '').trim();
        const loginFinal = (body.login !== undefined ? body.login : usuarioAtual.login || '').trim();
        const setorFinal = (body.setor !== undefined && body.setor.trim() !== '' ? body.setor.trim() : usuarioAtual.setor);
        const emailFinal = body.email !== undefined ? body.email.trim() : (usuarioAtual.email || '');

        if (!nomeFinal) return errorResponse(res, 'Nome do operador Ã© obrigatÃ³rio', 400);
        if (!loginFinal) return errorResponse(res, 'Login de acesso Ã© obrigatÃ³rio', 400);

        // Se alterou login, validar se jÃ¡ nÃ£o pertence a outro usuÃ¡rio
        if (loginFinal !== usuarioAtual.login) {
          const existeOutro = db.prepare('SELECT id FROM usuarios WHERE login = ? AND id != ?').get(loginFinal, id);
          if (existeOutro) {
            return errorResponse(res, 'Este login de acesso jÃ¡ estÃ¡ em uso por outro operador.', 400);
          }
        }

        const ehAdminSetor = setorFinal === 'admin' || setorFinal === 'Administrador Master' || loginFinal === 'admin' || id === 1;
        const podeEnviar = body.pode_enviar_comunicados !== undefined 
          ? (body.pode_enviar_comunicados ? 1 : 0) 
          : (ehAdminSetor ? 1 : (usuarioAtual.pode_enviar_comunicados || 0));

        let sql = 'UPDATE usuarios SET nome = ?, login = ?, setor = ?, email = ?, pode_enviar_comunicados = ?, ativo = ?';
        const params = [nomeFinal, loginFinal, setorFinal, emailFinal, podeEnviar, body.ativo !== undefined ? (body.ativo ? 1 : 0) : usuarioAtual.ativo];

        if (body.senha && body.senha.trim()) {
          sql += ', senha = ?';
          params.push(body.senha.trim());
        }
        sql += ' WHERE id = ?';
        params.push(id);

        db.prepare(sql).run(...params);

        // Atualizar permissÃµes se enviadas
        if (body.permissoes && Array.isArray(body.permissoes)) {
          db.prepare('DELETE FROM permissoes_usuario WHERE usuario_id = ?').run(id);
          const stmtPerm = db.prepare(`
            INSERT INTO permissoes_usuario (usuario_id, modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir, pode_aprovar)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of body.permissoes) {
            const modulo = typeof p === 'string' ? p : (p && p.modulo ? p.modulo : '');
            if (!modulo) continue;
            const podeVis = typeof p === 'object' && p.pode_visualizar !== undefined ? (p.pode_visualizar ? 1 : 0) : 1;
            const podeCriar = typeof p === 'object' && p.pode_criar !== undefined ? (p.pode_criar ? 1 : 0) : 1;
            const podeEdit = typeof p === 'object' && p.pode_editar !== undefined ? (p.pode_editar ? 1 : 0) : 1;
            const podeExcl = typeof p === 'object' && p.pode_excluir !== undefined ? (p.pode_excluir ? 1 : 0) : 1;
            const podeAprov = typeof p === 'object' && p.pode_aprovar !== undefined ? (p.pode_aprovar ? 1 : 0) : 0;
            stmtPerm.run(id, modulo, podeVis, podeCriar, podeEdit, podeExcl, podeAprov);
          }
          // Garantir que admin sempre tenha permissÃ£o usuarios
          if (id === 1 || ehAdminSetor) {
            const ex = db.prepare('SELECT id FROM permissoes_usuario WHERE usuario_id = ? AND modulo = ?').get(id, 'usuarios');
            if (!ex) {
              db.prepare('INSERT INTO permissoes_usuario (usuario_id, modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir, pode_aprovar) VALUES (?, ?, 1, 1, 1, 1, 1)').run(id, 'usuarios');
            }
          }
        }

        const usuarioAtualizado = db.prepare('SELECT id, nome, login, setor, email, pode_enviar_comunicados, ativo FROM usuarios WHERE id = ?').get(id);
        const permissoesAtualizadas = db.prepare('SELECT modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir, pode_aprovar FROM permissoes_usuario WHERE usuario_id = ?').all(id);

        return jsonResponse(res, { success: true, usuario: usuarioAtualizado, permissoes: permissoesAtualizadas });
      }

      if (pathname.startsWith('/api/usuarios/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        if (id === 1) {
          return errorResponse(res, 'O Administrador Master principal nÃ£o pode ser excluÃ­do.', 400);
        }
        db.prepare('DELETE FROM permissoes_usuario WHERE usuario_id = ?').run(id);
        db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'UsuÃ¡rio excluÃ­do com sucesso!' });
      }

      // -----------------------------------------------------------
      // GESTÃƒO DE SETORES DA EMPRESA
      // -----------------------------------------------------------
      if (pathname === '/api/setores' && method === 'GET') {
        const setores = db.prepare(`
          SELECT s.*, 
            (SELECT COUNT(*) FROM usuarios u WHERE LOWER(u.setor) = LOWER(s.nome_setor) OR LOWER(u.setor) = LOWER(s.sigla) OR u.setor = CAST(s.id AS TEXT)) as total_usuarios
          FROM setores s
          ORDER BY s.nome_setor ASC
        `).all();
        return jsonResponse(res, setores);
      }

      if (pathname === '/api/setores' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome_setor || !body.nome_setor.trim()) {
          return errorResponse(res, 'Nome do setor Ã© obrigatÃ³rio', 400);
        }

        const nome = body.nome_setor.trim();
        const existe = db.prepare('SELECT id FROM setores WHERE LOWER(nome_setor) = ?').get(nome.toLowerCase());
        if (existe) {
          return errorResponse(res, 'JÃ¡ existe um setor cadastrado com este nome', 400);
        }

        const sigla = (body.sigla || '').trim().toUpperCase() || nome.slice(0, 3).toUpperCase();
        const descricao = (body.descricao || '').trim();
        const cor = (body.cor_badge || 'blue').trim();

        const ins = db.prepare(`
          INSERT INTO setores (nome_setor, sigla, descricao, cor_badge)
          VALUES (?, ?, ?, ?)
        `).run(nome, sigla, descricao, cor);

        return jsonResponse(res, { success: true, id: ins.lastInsertRowid, message: 'Setor cadastrado com sucesso!' });
      }

      if (pathname.startsWith('/api/setores/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        if (!body.nome_setor || !body.nome_setor.trim()) {
          return errorResponse(res, 'Nome do setor Ã© obrigatÃ³rio', 400);
        }

        const nome = body.nome_setor.trim();
        const existe = db.prepare('SELECT id FROM setores WHERE LOWER(nome_setor) = ? AND id != ?').get(nome.toLowerCase(), id);
        if (existe) {
          return errorResponse(res, 'JÃ¡ existe outro setor com este nome', 400);
        }

        const sigla = (body.sigla || '').trim().toUpperCase() || nome.slice(0, 3).toUpperCase();
        const descricao = (body.descricao || '').trim();
        const cor = (body.cor_badge || 'blue').trim();
        const ativo = body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1;

        db.prepare(`
          UPDATE setores SET nome_setor = ?, sigla = ?, descricao = ?, cor_badge = ?, ativo = ?
          WHERE id = ?
        `).run(nome, sigla, descricao, cor, ativo, id);

        return jsonResponse(res, { success: true, message: 'Setor atualizado com sucesso!' });
      }

      if (pathname.startsWith('/api/setores/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        const setor = db.prepare('SELECT * FROM setores WHERE id = ?').get(id);
        if (!setor) return errorResponse(res, 'Setor nÃ£o encontrado', 404);

        const vinculos = db.prepare(`
          SELECT COUNT(*) as total FROM usuarios 
          WHERE LOWER(setor) = LOWER(?) OR LOWER(setor) = LOWER(?) OR setor = CAST(? AS TEXT)
        `).get(setor.nome_setor, setor.sigla || '', id);

        if (vinculos && vinculos.total > 0) {
          db.prepare('UPDATE setores SET ativo = 0 WHERE id = ?').run(id);
          return jsonResponse(res, { success: true, message: `O setor possui ${vinculos.total} usuÃ¡rio(s) vinculado(s) e foi inativado para preservar o histÃ³rico.` });
        } else {
          db.prepare('DELETE FROM setores WHERE id = ?').run(id);
          return jsonResponse(res, { success: true, message: 'Setor excluÃ­do com sucesso!' });
        }
      }

      // -----------------------------------------------------------
      // 3. POSTOS DE TRABALHO & CONTROLE DE VAGAS CONTRATADAS
      // -----------------------------------------------------------
      if (pathname === '/api/postos' && method === 'GET') {
        let sql = `
          SELECT pt.*,
                 c.nome_fantasia as cliente_nome,
                 u.nome_unidade,
                 cg.nome_cargo,
                 (SELECT COUNT(*) FROM colaboradores col WHERE col.posto_trabalho_id = pt.id AND col.ativo = 1) as total_ocupados
          FROM postos_trabalho pt
          JOIN clientes c ON pt.cliente_id = c.id
          LEFT JOIN unidades u ON pt.unidade_id = u.id
          JOIN cargos cg ON pt.cargo_id = cg.id
          WHERE pt.ativo = 1
        `;
        const params = [];
        if (query.cliente_id) {
          sql += ' AND pt.cliente_id = ? ';
          params.push(parseInt(query.cliente_id, 10));
        }
        sql += ' ORDER BY pt.nome_posto ASC ';
        const postos = db.prepare(sql).all(...params);

        // Calcular vagas disponÃ­veis, vagas abertas e listar colaboradores alocados
        postos.forEach(p => {
          p.vagas_disponiveis = Math.max(0, p.quantidade_vagas_limite - p.total_ocupados);
          p.vagas_abertas = Math.max(0, p.quantidade_vagas_limite - p.total_ocupados);
          p.esta_lotado = p.total_ocupados >= p.quantidade_vagas_limite;
          p.requer_contratacao = p.vagas_abertas > 0;
          p.colaboradores_alocados = db.prepare(`
            SELECT col.id, col.nome, col.status_colaborador, col.data_admissao, col.escala, cg.nome_cargo
            FROM colaboradores col
            LEFT JOIN cargos cg ON col.cargo_id = cg.id
            WHERE col.posto_trabalho_id = ? AND col.ativo = 1
            ORDER BY col.nome ASC
          `).all(p.id);
        });

        return jsonResponse(res, postos);
      }

      if ((pathname === '/api/postos/lote' || pathname === '/api/postos') && method === 'POST') {
        const body = await parseRequestBody(req);

        // Se for requisiÃ§Ã£o em lote (com array 'postos')
        if (Array.isArray(body.postos) && body.postos.length > 0) {
          const clienteId = parseInt(body.cliente_id, 10);
          if (!clienteId) return errorResponse(res, 'Cliente Ã© obrigatÃ³rio', 400);

          const stmt = db.prepare(`
            INSERT INTO postos_trabalho (cliente_id, unidade_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const ids = [];
          for (const p of body.postos) {
            const nome = (p.nome_posto || '').trim();
            const cargoId = parseInt(p.cargo_id, 10);
            if (!nome || !cargoId) continue;
            const resPosto = stmt.run(
              clienteId,
              p.unidade_id ? parseInt(p.unidade_id, 10) : null,
              nome,
              cargoId,
              parseInt(p.quantidade_vagas_limite, 10) || 1,
              p.escala || '5x2',
              p.turno || 'Diurno',
              p.observacoes || ''
            );
            ids.push(resPosto.lastInsertRowid);
          }

          if (ids.length === 0) {
            return errorResponse(res, 'Informe ao menos um posto vÃ¡lido com Nome e FunÃ§Ã£o preenchidos.', 400);
          }

          return jsonResponse(res, {
            success: true,
            count: ids.length,
            ids,
            message: `${ids.length} posto(s) de trabalho cadastrado(s) com sucesso para o cliente!`
          });
        }

        // Cadastro unitÃ¡rio tradicional
        if (!body.cliente_id || !body.nome_posto || !body.cargo_id) {
          return errorResponse(res, 'Cliente, Nome do Posto e FunÃ§Ã£o/Cargo sÃ£o obrigatÃ³rios', 400);
        }

        const stmt = db.prepare(`
          INSERT INTO postos_trabalho (cliente_id, unidade_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const resPosto = stmt.run(
          parseInt(body.cliente_id, 10),
          body.unidade_id ? parseInt(body.unidade_id, 10) : null,
          body.nome_posto.trim(),
          parseInt(body.cargo_id, 10),
          parseInt(body.quantidade_vagas_limite, 10) || 1,
          body.escala || '5x2',
          body.turno || 'Diurno',
          body.observacoes || ''
        );
        return jsonResponse(res, { success: true, id: resPosto.lastInsertRowid, count: 1, message: 'Posto de trabalho cadastrado com sucesso!' });
      }

      if (pathname.match(/^\/api\/postos\/\d+$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[3], 10);
        const posto = db.prepare(`
          SELECT pt.*,
                 COALESCE(NULLIF(c.nome_fantasia, ''), NULLIF(c.nome_razao_social, ''), 'Cliente #' || c.id) as cliente_nome,
                 c.nome_razao_social as cliente_razao_social,
                 cg.nome_cargo,
                 u.nome_unidade,
                 (SELECT COUNT(*) FROM colaboradores WHERE posto_trabalho_id = pt.id AND ativo = 1) as total_ocupados
          FROM postos_trabalho pt
          JOIN clientes c ON pt.cliente_id = c.id
          JOIN cargos cg ON pt.cargo_id = cg.id
          LEFT JOIN unidades u ON pt.unidade_id = u.id
          WHERE pt.id = ?
        `).get(id);

        if (!posto) {
          return errorResponse(res, 'Posto de trabalho nÃ£o encontrado.', 404);
        }
        return jsonResponse(res, posto);
      }

      if (pathname.startsWith('/api/postos/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        let body = {};
        try { body = await parseRequestBody(req); } catch(e) {}

        const usuarioLogin = query.usuario_login || body.usuario_login || req.headers['x-usuario-login'];
        const usuarioSetor = query.usuario_setor || body.usuario_setor || req.headers['x-usuario-setor'];

        // ValidaÃ§Ã£o de seguranÃ§a: Administrador Master
        function isUsuarioAdminMasterServer(setor, login) {
          const s = String(setor || '').toLowerCase().trim();
          const l = String(login || '').toLowerCase().trim();
          if (s === 'admin' || s === 'administrador master' || s === 'administrador' || s.includes('admin') || l === 'admin') {
            return true;
          }
          if (l) {
            try {
              const u = db.prepare('SELECT setor FROM usuarios WHERE LOWER(login) = ? AND ativo = 1').get(l);
              if (u) {
                const us = String(u.setor || '').toLowerCase().trim();
                return us === 'admin' || us === 'administrador master' || us === 'administrador' || us.includes('admin');
              }
            } catch(e) {}
          }
          return false;
        }

        const isAdmin = isUsuarioAdminMasterServer(usuarioSetor, usuarioLogin);
        if (!isAdmin) {
          return errorResponse(res, 'Acesso Negado: Apenas o Administrador Master tem autorizaÃ§Ã£o para editar postos de clientes (aditivos de contrato ou correÃ§Ã£o).', 403);
        }

        const postoAtual = db.prepare('SELECT * FROM postos_trabalho WHERE id = ?').get(id);
        if (!postoAtual) {
          return errorResponse(res, 'Posto de trabalho nÃ£o encontrado.', 404);
        }

        const ocupados = db.prepare('SELECT COUNT(*) as count FROM colaboradores WHERE posto_trabalho_id = ? AND ativo = 1').get(id).count;
        const novoLimite = parseInt(body.quantidade_vagas_limite, 10) || 1;

        if (novoLimite < ocupados) {
          return errorResponse(res, `NÃ£o Ã© possÃ­vel reduzir o limite para ${novoLimite} vaga(s), pois existem atualmente ${ocupados} colaborador(es) alocado(s) neste posto. Realoque ou desvincule colaboradores antes de reduzir o quadro contratual.`, 400);
        }

        db.prepare(`
          UPDATE postos_trabalho SET
            nome_posto = ?, unidade_id = ?, cargo_id = ?, quantidade_vagas_limite = ?,
            escala = ?, turno = ?, observacoes = ?, ativo = ?
          WHERE id = ?
        `).run(
          body.nome_posto || postoAtual.nome_posto,
          body.unidade_id !== undefined ? (body.unidade_id ? parseInt(body.unidade_id, 10) : null) : postoAtual.unidade_id,
          body.cargo_id ? parseInt(body.cargo_id, 10) : postoAtual.cargo_id,
          novoLimite,
          body.escala || postoAtual.escala || '5x2',
          body.turno || postoAtual.turno || 'Comercial',
          body.observacoes !== undefined ? body.observacoes : postoAtual.observacoes,
          body.ativo !== undefined ? (body.ativo ? 1 : 0) : postoAtual.ativo,
          id
        );
        return jsonResponse(res, { success: true, message: 'Posto de trabalho atualizado com sucesso pelo Administrador Master!' });
      }

      // -----------------------------------------------------------
      // 3.1 GESTÃƒO DE ESCALAS DE TRABALHO & TURNOS CUSTOMIZADOS
      // -----------------------------------------------------------
      if (pathname === '/api/escalas' && method === 'GET') {
        const escalas = db.prepare(`
          SELECT * FROM escalas_trabalho 
          WHERE ativo = 1 
          ORDER BY nome ASC
        `).all();
        return jsonResponse(res, escalas);
      }

      if (pathname === '/api/escalas' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome || !body.nome.trim()) {
          return errorResponse(res, 'Nome da escala Ã© obrigatÃ³rio', 400);
        }

        const nome = body.nome.trim();
        const tipo = body.tipo || 'Semanal';
        const cargaSemanal = parseFloat(body.carga_horaria_semanal) || 44;
        const cargaDiaria = parseFloat(body.carga_horaria_diaria) || parseFloat((cargaSemanal / 5).toFixed(2));
        const diasSemanaJson = typeof body.dias_semana_json === 'string' 
          ? body.dias_semana_json 
          : JSON.stringify(body.dias_semana || ['seg', 'ter', 'qua', 'qui', 'sex']);
        const entrada = body.horario_entrada || '08:00';
        const saida = body.horario_saida || '17:48';
        const intervalo = parseInt(body.intervalo_minutos, 10) || 60;
        const descricao = body.descricao || '';
        const cor = body.cor || 'blue';

        try {
          const stmt = db.prepare(`
            INSERT INTO escalas_trabalho 
            (nome, tipo, carga_horaria_semanal, carga_horaria_diaria, dias_semana_json, horario_entrada, horario_saida, intervalo_minutos, descricao, cor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const result = stmt.run(nome, tipo, cargaSemanal, cargaDiaria, diasSemanaJson, entrada, saida, intervalo, descricao, cor);
          return jsonResponse(res, { success: true, id: result.lastInsertRowid, message: 'Nova escala de trabalho cadastrada com sucesso!' });
        } catch (err) {
          if (err.message && err.message.includes('UNIQUE')) {
            return errorResponse(res, 'JÃ¡ existe uma escala cadastrada com este nome', 400);
          }
          return errorResponse(res, 'Erro ao criar escala: ' + err.message, 500);
        }
      }

      if (pathname.startsWith('/api/escalas/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        if (!body.nome || !body.nome.trim()) {
          return errorResponse(res, 'Nome da escala Ã© obrigatÃ³rio', 400);
        }

        const nome = body.nome.trim();
        const tipo = body.tipo || 'Semanal';
        const cargaSemanal = parseFloat(body.carga_horaria_semanal) || 44;
        const cargaDiaria = parseFloat(body.carga_horaria_diaria) || parseFloat((cargaSemanal / 5).toFixed(2));
        const diasSemanaJson = typeof body.dias_semana_json === 'string' 
          ? body.dias_semana_json 
          : JSON.stringify(body.dias_semana || ['seg', 'ter', 'qua', 'qui', 'sex']);
        const entrada = body.horario_entrada || '08:00';
        const saida = body.horario_saida || '17:48';
        const intervalo = parseInt(body.intervalo_minutos, 10) || 60;
        const descricao = body.descricao || '';
        const cor = body.cor || 'blue';

        try {
          db.prepare(`
            UPDATE escalas_trabalho SET
              nome = ?, tipo = ?, carga_horaria_semanal = ?, carga_horaria_diaria = ?,
              dias_semana_json = ?, horario_entrada = ?, horario_saida = ?, intervalo_minutos = ?,
              descricao = ?, cor = ?
            WHERE id = ?
          `).run(nome, tipo, cargaSemanal, cargaDiaria, diasSemanaJson, entrada, saida, intervalo, descricao, cor, id);

          return jsonResponse(res, { success: true, message: 'Escala atualizada com sucesso!' });
        } catch (err) {
          return errorResponse(res, 'Erro ao atualizar escala: ' + err.message, 500);
        }
      }

      if (pathname.startsWith('/api/escalas/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        db.prepare('UPDATE escalas_trabalho SET ativo = 0 WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Escala removida com sucesso.' });
      }

      // -----------------------------------------------------------
      // 3.2 GESTÃƒO MULTI-CLIENTE & ROTEIROS COMPARTILHADOS (ATÃ‰ 5 CLIENTES)
      // -----------------------------------------------------------
      if (pathname === '/api/multi-cliente/roteiros' && method === 'GET') {
        const roteiros = db.prepare(`
          SELECT rm.*, 
                 col.nome as colaborador_nome, 
                 col.cpf as colaborador_cpf,
                 cg.nome_cargo as colaborador_cargo
          FROM roteiros_multi_clientes rm
          LEFT JOIN colaboradores col ON rm.colaborador_id = col.id
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          WHERE rm.ativo = 1
          ORDER BY rm.id DESC
        `).all();

        for (const r of roteiros) {
          try { r.clientes_ids = JSON.parse(r.clientes_ids_json || '[]'); } catch(e) { r.clientes_ids = []; }
          try { r.postos_ids = JSON.parse(r.postos_ids_json || '[]'); } catch(e) { r.postos_ids = []; }
          try { r.detalhes_dias = JSON.parse(r.detalhes_dias_json || '{}'); } catch(e) { r.detalhes_dias = {}; }

          if (r.clientes_ids.length > 0) {
            const placeholders = r.clientes_ids.map(() => '?').join(',');
            r.clientes_info = db.prepare(`
              SELECT c.id, c.nome_fantasia, c.nome_razao_social, c.cnpj
              FROM clientes c
              WHERE c.id IN (${placeholders})
            `).all(...r.clientes_ids);
          } else {
            r.clientes_info = [];
          }
        }

        return jsonResponse(res, roteiros);
      }

      if (pathname === '/api/multi-cliente/roteiros' && method === 'POST') {
        const body = await parseRequestBody(req);
        const colaboradorId = parseInt(body.colaborador_id, 10);
        const clientesArr = Array.isArray(body.clientes) ? body.clientes : [];

        if (!colaboradorId) {
          return errorResponse(res, 'Colaborador Ã© obrigatÃ³rio para o agrupamento multi-cliente', 400);
        }
        if (clientesArr.length === 0) {
          return errorResponse(res, 'Ao menos um cliente deve ser selecionado', 400);
        }
        if (clientesArr.length > 5) {
          return errorResponse(res, 'Limite mÃ¡ximo de atÃ© 5 clientes por roteiro multi-cliente excedido', 400);
        }

        const colab = db.prepare('SELECT id, nome, cargo_id FROM colaboradores WHERE id = ? AND ativo = 1').get(colaboradorId);
        if (!colab) {
          return errorResponse(res, 'Colaborador nÃ£o encontrado ou inativo', 404);
        }

        const clientesIds = [];
        const postosIds = [];
        const detalhesDias = {};

        for (const item of clientesArr) {
          const cid = parseInt(item.cliente_id, 10);
          if (!cid || clientesIds.includes(cid)) continue;
          clientesIds.push(cid);

          let pid = item.posto_trabalho_id ? parseInt(item.posto_trabalho_id, 10) : null;
          if (!pid) {
            const pExistente = db.prepare('SELECT id FROM postos_trabalho WHERE cliente_id = ? AND ativo = 1 LIMIT 1').get(cid);
            if (pExistente) {
              pid = pExistente.id;
            } else {
              const resPosto = db.prepare(`
                INSERT INTO postos_trabalho (cliente_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno, observacoes)
                VALUES (?, 'Posto Operacional (Multi-Cliente)', ?, 1, 'Multi-Cliente', 'Diurno', 'Posto gerado para atendimento compartilhado')
              `).run(cid, colab.cargo_id || 1);
              pid = resPosto.lastInsertRowid;
            }
          }
          postosIds.push(pid);

          detalhesDias[cid] = {
            posto_id: pid,
            dias: Array.isArray(item.dias_semana) ? item.dias_semana : (item.dias_semana ? [item.dias_semana] : ['Seg', 'Qua']),
            carga_horaria: item.carga_horaria_semanal || '16h',
            entrada: item.horario_entrada || '08:00',
            saida: item.horario_saida || '17:00',
            observacoes: item.observacoes || ''
          };
        }

        const nomeRoteiro = body.nome_roteiro && body.nome_roteiro.trim()
          ? body.nome_roteiro.trim()
          : `Roteiro Multi-Cliente (${clientesIds.length} Clientes) - ${colab.nome}`;

        const cargaTotal = body.carga_total_semanal || '44h';
        const escalaNome = body.escala_nome || '44h Semanal FlexÃ­vel (Multi-Postos)';

        const stmtRoteiro = db.prepare(`
          INSERT INTO roteiros_multi_clientes
          (nome_roteiro, colaborador_id, clientes_ids_json, postos_ids_json, detalhes_dias_json, carga_total_semanal, escala_nome, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const resRoteiro = stmtRoteiro.run(
          nomeRoteiro,
          colaboradorId,
          JSON.stringify(clientesIds),
          JSON.stringify(postosIds),
          JSON.stringify(detalhesDias),
          cargaTotal,
          escalaNome,
          body.observacoes || ''
        );
        const roteiroId = resRoteiro.lastInsertRowid;

        for (const cid of clientesIds) {
          db.prepare(`
            UPDATE colaborador_clientes_compartilhados 
            SET ativo = 0 
            WHERE colaborador_id = ? AND cliente_id = ?
          `).run(colaboradorId, cid);
        }

        const stmtVinculo = db.prepare(`
          INSERT INTO colaborador_clientes_compartilhados
          (roteiro_id, colaborador_id, cliente_id, posto_trabalho_id, dias_semana, carga_horaria_semanal, horario_entrada, horario_saida, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const cid of clientesIds) {
          const det = detalhesDias[cid];
          const diasStr = Array.isArray(det.dias) ? det.dias.join(',') : String(det.dias || '');
          stmtVinculo.run(
            roteiroId,
            colaboradorId,
            cid,
            det.posto_id,
            diasStr,
            det.carga_horaria,
            det.entrada,
            det.saida,
            det.observacoes
          );
        }

        db.prepare(`
          UPDATE colaboradores SET 
            cliente_id = COALESCE(cliente_id, ?),
            posto_trabalho_id = COALESCE(posto_trabalho_id, ?),
            escala = ?
          WHERE id = ?
        `).run(clientesIds[0], postosIds[0], escalaNome, colaboradorId);

        return jsonResponse(res, {
          success: true,
          roteiro_id: roteiroId,
          message: `Roteiro Multi-Cliente com ${clientesIds.length} cliente(s) vinculado ao colaborador ${colab.nome} com sucesso!`
        });
      }

      if (pathname.startsWith('/api/multi-cliente/roteiros/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[4], 10);
        db.prepare('UPDATE roteiros_multi_clientes SET ativo = 0 WHERE id = ?').run(id);
        db.prepare('UPDATE colaborador_clientes_compartilhados SET ativo = 0 WHERE roteiro_id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Roteiro multi-cliente desvinculado com sucesso.' });
      }

      if (pathname === '/api/multi-cliente/calendario' && method === 'GET') {
        const diasSemana = ['Segunda-Feira', 'TerÃ§a-Feira', 'Quarta-Feira', 'Quinta-Feira', 'Sexta-Feira', 'SÃ¡bado', 'Domingo'];
        const diasAbrev = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

        const postosDiretos = db.prepare(`
          SELECT pt.id as posto_id, pt.nome_posto, pt.escala, pt.turno, pt.quantidade_vagas_limite,
                 c.id as cliente_id, COALESCE(NULLIF(c.nome_fantasia, ''), c.nome_razao_social) as cliente_nome,
                 cg.nome_cargo,
                 col.id as colaborador_id, col.nome as colaborador_nome,
                 0 as is_multi_cliente, '' as dias_atendimento, '' as carga_horaria
          FROM postos_trabalho pt
          JOIN clientes c ON pt.cliente_id = c.id
          JOIN cargos cg ON pt.cargo_id = cg.id
          LEFT JOIN colaboradores col ON col.posto_trabalho_id = pt.id AND col.ativo = 1
          WHERE pt.ativo = 1 AND c.ativo = 1
        `).all();

        const compartilhados = db.prepare(`
          SELECT ccc.posto_trabalho_id as posto_id, pt.nome_posto, pt.escala, pt.turno, pt.quantidade_vagas_limite,
                 c.id as cliente_id, COALESCE(NULLIF(c.nome_fantasia, ''), c.nome_razao_social) as cliente_nome,
                 cg.nome_cargo,
                 col.id as colaborador_id, col.nome as colaborador_nome,
                 1 as is_multi_cliente, ccc.dias_semana as dias_atendimento, ccc.carga_horaria_semanal as carga_horaria,
                 ccc.horario_entrada, ccc.horario_saida,
                 ccc.roteiro_id
          FROM colaborador_clientes_compartilhados ccc
          JOIN clientes c ON ccc.cliente_id = c.id
          JOIN colaboradores col ON ccc.colaborador_id = col.id
          LEFT JOIN postos_trabalho pt ON ccc.posto_trabalho_id = pt.id
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          WHERE ccc.ativo = 1 AND c.ativo = 1 AND col.ativo = 1
        `).all();

        const calendario = {};
        diasAbrev.forEach((da, idx) => {
          calendario[da] = {
            dia_abrev: da,
            dia_nome: diasSemana[idx],
            itens: []
          };
        });

        for (const comp of compartilhados) {
          const dias = (comp.dias_atendimento || '').toLowerCase();
          diasAbrev.forEach(da => {
            if (dias.includes(da)) {
              calendario[da].itens.push({
                ...comp,
                posto_nome: comp.nome_posto || 'Posto Operacional Compartilhado',
                tipo_alocacao: 'Multi-Cliente (Compartilhado)',
                destaque: 'multi'
              });
            }
          });
        }

        for (const dir of postosDiretos) {
          const esc = (dir.escala || '5x2').toLowerCase();
          diasAbrev.forEach(da => {
            let atende = false;
            if (esc.includes('5x2') && ['seg', 'ter', 'qua', 'qui', 'sex'].includes(da)) atende = true;
            else if (esc.includes('6x1') && ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'].includes(da)) atende = true;
            else if (esc.includes('12x36')) atende = true;
            else if (esc.includes(da)) atende = true;

            if (atende) {
              const jaTem = calendario[da].itens.some(i => i.posto_id === dir.posto_id && i.is_multi_cliente);
              if (!jaTem) {
                calendario[da].itens.push({
                  ...dir,
                  tipo_alocacao: dir.colaborador_id ? 'Efetivo Direto' : 'Vaga Livre',
                  destaque: dir.colaborador_id ? 'direto' : 'vago'
                });
              }
            }
          });
        }

        return jsonResponse(res, calendario);
      }

      // -----------------------------------------------------------
      // 4. COLABORADORES COM TRAVA RÃGIDA DE LOTAÃ‡ÃƒO MÃXIMA DO POSTO
      // -----------------------------------------------------------
      if (pathname === '/api/colaboradores' && method === 'GET') {
        let sql = `
          SELECT col.*,
                 cg.nome_cargo,
                 c.nome_fantasia as cliente_nome,
                 u.nome_unidade,
                 pt.nome_posto,
                 pt.quantidade_vagas_limite as posto_limite_vagas
          FROM colaboradores col
          JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN unidades u ON col.unidade_id = u.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];
        if (query.status === 'demitidos') {
          sql += " AND col.status_colaborador = 'Demitido' ";
        } else if (query.status === 'afastados') {
          sql += " AND (col.afastado = 1 OR pt.nome_posto LIKE '%AFASTADO%') ";
        } else if (query.status === 'todos') {
          // sem filtro de ativo
        } else {
          sql += " AND col.ativo = 1 AND (col.status_colaborador IS NULL OR col.status_colaborador != 'Demitido') ";
        }
        if (query.cliente_id) {
          sql += ' AND col.cliente_id = ? ';
          params.push(parseInt(query.cliente_id, 10));
        }
        if (query.posto_id) {
          sql += ' AND col.posto_trabalho_id = ? ';
          params.push(parseInt(query.posto_id, 10));
        }
        sql += ' ORDER BY col.nome ASC ';
        const colaboradores = db.prepare(sql).all(...params);

        // Calcular dias atÃ© fÃ©rias
        const hoje = new Date();
        colaboradores.forEach(col => {
          if (col.data_admissao) {
            let dataStr = String(col.data_admissao).trim();
            if (dataStr.includes('/')) {
              const partes = dataStr.split('/');
              if (partes.length === 3) {
                dataStr = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
              }
            }
            const adm = new Date(dataStr);
            if (!isNaN(adm.getTime())) {
              const limiteFerias = new Date(adm);
              limiteFerias.setMonth(limiteFerias.getMonth() + 23); // 23 meses = limite antes de vencer
              col.limite_ferias_vencimento = limiteFerias.toISOString().split('T')[0];

              const diffTempo = limiteFerias - hoje;
              const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
              col.dias_para_ferias = diffDias;

              if (diffDias < 0) {
                col.status_ferias = 'Vencida';
              } else if (diffDias <= 60) {
                col.status_ferias = 'A Vencer Urgente (60d)';
              } else {
                col.status_ferias = 'Em dia';
              }
            } else {
              col.status_ferias = 'Sem admissÃ£o';
            }
          } else {
            col.status_ferias = 'Sem admissÃ£o';
          }
          col.na_reserva_tecnica = !col.posto_trabalho_id || !col.cliente_id;

          // Buscar clientes e postos compartilhados (Multi-Cliente)
          const comp = db.prepare(`
            SELECT ccc.id as vinculo_id, ccc.cliente_id, ccc.posto_trabalho_id, ccc.dias_semana, ccc.carga_horaria_semanal,
                   COALESCE(NULLIF(c.nome_fantasia, ''), c.nome_razao_social) as cliente_nome,
                   pt.nome_posto
            FROM colaborador_clientes_compartilhados ccc
            JOIN clientes c ON ccc.cliente_id = c.id
            LEFT JOIN postos_trabalho pt ON ccc.posto_trabalho_id = pt.id
            WHERE ccc.colaborador_id = ? AND ccc.ativo = 1 AND c.ativo = 1
          `).all(col.id);

          col.clientes_compartilhados = comp;
          col.is_multi_cliente = comp.length > 0;
          if (col.is_multi_cliente) {
            col.total_clientes_multi = comp.length;
            col.na_reserva_tecnica = false;
          }
        });

        return jsonResponse(res, colaboradores);
      }

      if (pathname === '/api/colaboradores' && method === 'POST') {
        const body = await parseRequestBody(req);
        let cargoId = body.cargo_id ? parseInt(body.cargo_id, 10) : null;
        if (!cargoId && body.cargo) {
          const cRow = db.prepare('SELECT id FROM cargos WHERE nome_cargo LIKE ? OR nome_cargo = ? LIMIT 1').get(`%${body.cargo}%`, body.cargo);
          if (cRow) cargoId = cRow.id;
        }
        if (!body.nome || !cargoId) return errorResponse(res, 'Nome e Cargo sÃ£o obrigatÃ³rios', 400);
        body.cargo_id = cargoId;

        // TRAVA RÃGIDA DE POSTO: Bloquear se exceder vagas contratadas!
        if (body.posto_trabalho_id) {
          const postoId = parseInt(body.posto_trabalho_id, 10);
          const posto = db.prepare('SELECT id, nome_posto, quantidade_vagas_limite FROM postos_trabalho WHERE id = ?').get(postoId);

          if (posto && !posto.nome_posto.toUpperCase().includes('AFASTADO')) {
            const ocupados = db.prepare('SELECT COUNT(*) as count FROM colaboradores WHERE posto_trabalho_id = ? AND ativo = 1').get(postoId).count;
            if (ocupados >= posto.quantidade_vagas_limite) {
              return errorResponse(
                res,
                `BLOQUEIO DE LOTAÃ‡ÃƒO: O posto "${posto.nome_posto}" possui limite contratado de ${posto.quantidade_vagas_limite} vaga(s) e jÃ¡ estÃ¡ totalmente ocupado (${ocupados}/${posto.quantidade_vagas_limite}). NÃ£o Ã© permitido alocar colaboradores a mais neste posto.`,
                400
              );
            }
          }
        }

        let linhasTransporte = [];
        if (body.linhas_transporte_json) {
          try {
            linhasTransporte = typeof body.linhas_transporte_json === 'string'
              ? JSON.parse(body.linhas_transporte_json)
              : body.linhas_transporte_json;
          } catch (e) {
            linhasTransporte = [];
          }
        }

        let totalDiarioVT = 0;
        let totalPassagensDia = parseInt(body.quantidade_passagens_dia, 10) || 0;
        let valorPassagemUnitaria = parseFloat(body.valor_passagem_unitaria) || 4.40;
        let linhasOnibusResumo = (body.linhas_onibus || '').trim();

        if (Array.isArray(linhasTransporte) && linhasTransporte.length > 0) {
          let somaPassagens = 0;
          let somaValor = 0;
          const partesResumo = [];

          linhasTransporte = linhasTransporte.map((linha, idx) => {
            const nome = (linha.nome_linha || `Linha ${idx + 1}`).trim();
            const tarifa = parseFloat(linha.tarifa) || 0;
            const qtdIda = parseInt(linha.qtd_ida, 10) >= 0 ? parseInt(linha.qtd_ida, 10) : 1;
            const qtdVolta = parseInt(linha.qtd_volta, 10) >= 0 ? parseInt(linha.qtd_volta, 10) : 1;
            const totalViagens = qtdIda + qtdVolta;
            const sub = Math.round(totalViagens * tarifa * 100) / 100;
            somaPassagens += totalViagens;
            somaValor += sub;
            partesResumo.push(`${nome} (${totalViagens}x R$ ${tarifa.toFixed(2)})`);
            return {
              id: linha.id || (idx + 1),
              nome_linha: nome,
              tarifa,
              qtd_ida: qtdIda,
              qtd_volta: qtdVolta,
              total_diario: sub
            };
          });

          totalDiarioVT = Math.round(somaValor * 100) / 100;
          totalPassagensDia = somaPassagens;
          if (totalPassagensDia > 0 && totalDiarioVT > 0) {
            valorPassagemUnitaria = Math.round((totalDiarioVT / totalPassagensDia) * 100) / 100;
          }
          if (!linhasOnibusResumo || linhasOnibusResumo === 'Municipal') {
            linhasOnibusResumo = partesResumo.join(' + ');
          }
        } else {
          totalPassagensDia = totalPassagensDia || 2;
          totalDiarioVT = parseFloat(body.total_diario_vt) || (Math.round(totalPassagensDia * valorPassagemUnitaria * 100) / 100);
          if (!linhasOnibusResumo) linhasOnibusResumo = 'Municipal';
        }

        const modeloOsId = body.modelo_os_id ? parseInt(body.modelo_os_id, 10) : null;

        const stmt = db.prepare(`
          INSERT INTO colaboradores (
            nome, cpf, cargo_id, cliente_id, unidade_id, posto_trabalho_id, escala,
            data_admissao, telefone, email, linhas_onibus, quantidade_passagens_dia,
            valor_passagem_unitaria, valor_diario_va, linhas_transporte_json, total_diario_vt,
            modelo_os_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          body.nome,
          body.cpf || '',
          parseInt(body.cargo_id, 10),
          body.cliente_id ? parseInt(body.cliente_id, 10) : null,
          body.unidade_id ? parseInt(body.unidade_id, 10) : null,
          body.posto_trabalho_id ? parseInt(body.posto_trabalho_id, 10) : null,
          body.escala || '5x2',
          body.data_admissao || null,
          body.telefone || '',
          body.email || '',
          linhasOnibusResumo,
          totalPassagensDia,
          valorPassagemUnitaria,
          parseFloat(body.valor_diario_va) || 28.00,
          JSON.stringify(linhasTransporte || []),
          totalDiarioVT,
          modeloOsId
        );

        const novoColabId = result.lastInsertRowid;
        try {
          const cargoInfo = body.cargo_id ? db.prepare('SELECT nome_cargo FROM cargos WHERE id = ?').get(body.cargo_id)?.nome_cargo : 'FunÃ§Ã£o PadrÃ£o';
          const clienteInfo = body.cliente_id ? db.prepare('SELECT nome_fantasia FROM clientes WHERE id = ?').get(body.cliente_id)?.nome_fantasia : 'Reserva TÃ©cnica';
          registrarEventoHistoricoColaborador(
            novoColabId,
            'ADMISSAO',
            'AdmissÃ£o na Empresa',
            `Colaborador admitido na funÃ§Ã£o de ${cargoInfo} alocado em: ${clienteInfo}. Escala: ${body.escala || '5x2'}.`,
            body.data_admissao || new Date().toISOString().split('T')[0],
            { cargo: cargoInfo, cliente: clienteInfo, escala: body.escala || '5x2' }
          );
        } catch (eH) {}

        // GERAÃ‡ÃƒO AUTOMÃTICA IMEDIATA DE DOCUMENTOS SST (Treinamento IntrodutÃ³rio e OS NR-01)
        try {
          gerarDocumentosSSTParaColaborador(novoColabId, body.cargo_id, modeloOsId);
        } catch (eSST) {
          console.error('Erro ao auto-gerar SST no cadastro:', eSST);
        }

        return jsonResponse(res, { success: true, id: novoColabId });
      }

      if (pathname.startsWith('/api/colaboradores/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);

        // Buscar dados anteriores para histÃ³rico e auditoria
        const colabAnterior = db.prepare(`
          SELECT col.*, cg.nome_cargo, c.nome_fantasia as cliente_nome, pt.nome_posto
          FROM colaboradores col
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          WHERE col.id = ?
        `).get(id);

        // TRAVA RÃGIDA DE POSTO NA EDIÃ‡ÃƒO
        if (body.posto_trabalho_id) {
          const postoId = parseInt(body.posto_trabalho_id, 10);
          const posto = db.prepare('SELECT id, nome_posto, quantidade_vagas_limite FROM postos_trabalho WHERE id = ?').get(postoId);

          if (posto && !posto.nome_posto.toUpperCase().includes('AFASTADO')) {
            const ocupados = db.prepare('SELECT COUNT(*) as count FROM colaboradores WHERE posto_trabalho_id = ? AND ativo = 1 AND id != ?').get(postoId, id).count;
            if (ocupados >= posto.quantidade_vagas_limite) {
              return errorResponse(
                res,
                `BLOQUEIO DE LOTAÃ‡ÃƒO: O posto "${posto.nome_posto}" possui limite contratado de ${posto.quantidade_vagas_limite} vaga(s) e jÃ¡ possui ${ocupados} colaboradores alocados.`,
                400
              );
            }
          }
        }

        const novoCargoId = parseInt(body.cargo_id, 10);
        const novoClienteId = body.cliente_id ? parseInt(body.cliente_id, 10) : null;
        const novaUnidadeId = body.unidade_id ? parseInt(body.unidade_id, 10) : null;
        const novoPostoId = body.posto_trabalho_id ? parseInt(body.posto_trabalho_id, 10) : null;
        const novoVA = parseFloat(body.valor_diario_va) || 28.00;

        let editLinhasTransporte = [];
        if (body.linhas_transporte_json) {
          try {
            editLinhasTransporte = typeof body.linhas_transporte_json === 'string'
              ? JSON.parse(body.linhas_transporte_json)
              : body.linhas_transporte_json;
          } catch (e) {
            editLinhasTransporte = [];
          }
        }

        let editTotalDiarioVT = 0;
        let editTotalPassagens = parseInt(body.quantidade_passagens_dia, 10) || 0;
        let editValorPassagem = parseFloat(body.valor_passagem_unitaria) || 4.40;
        let editLinhasResumo = (body.linhas_onibus || '').trim();

        if (Array.isArray(editLinhasTransporte) && editLinhasTransporte.length > 0) {
          let somaPass = 0;
          let somaVal = 0;
          const partesRes = [];

          editLinhasTransporte = editLinhasTransporte.map((linha, idx) => {
            const nome = (linha.nome_linha || `Linha ${idx + 1}`).trim();
            const tarifa = parseFloat(linha.tarifa) || 0;
            const qtdIda = parseInt(linha.qtd_ida, 10) >= 0 ? parseInt(linha.qtd_ida, 10) : 1;
            const qtdVolta = parseInt(linha.qtd_volta, 10) >= 0 ? parseInt(linha.qtd_volta, 10) : 1;
            const totalViagens = qtdIda + qtdVolta;
            const sub = Math.round(totalViagens * tarifa * 100) / 100;
            somaPass += totalViagens;
            somaVal += sub;
            partesRes.push(`${nome} (${totalViagens}x R$ ${tarifa.toFixed(2)})`);
            return {
              id: linha.id || (idx + 1),
              nome_linha: nome,
              tarifa,
              qtd_ida: qtdIda,
              qtd_volta: qtdVolta,
              total_diario: sub
            };
          });

          editTotalDiarioVT = Math.round(somaVal * 100) / 100;
          editTotalPassagens = somaPass;
          if (editTotalPassagens > 0 && editTotalDiarioVT > 0) {
            editValorPassagem = Math.round((editTotalDiarioVT / editTotalPassagens) * 100) / 100;
          }
          if (!editLinhasResumo || editLinhasResumo === 'Municipal') {
            editLinhasResumo = partesRes.join(' + ');
          }
        } else {
          editTotalPassagens = editTotalPassagens || 2;
          editTotalDiarioVT = parseFloat(body.total_diario_vt) || (Math.round(editTotalPassagens * editValorPassagem * 100) / 100);
          if (!editLinhasResumo) editLinhasResumo = 'Municipal';
        }

        const novoModeloOsId = body.modelo_os_id !== undefined ? (body.modelo_os_id ? parseInt(body.modelo_os_id, 10) : null) : (colabAnterior ? colabAnterior.modelo_os_id : null);

        db.prepare(`
          UPDATE colaboradores SET
            nome = ?, cpf = ?, cargo_id = ?, cliente_id = ?, unidade_id = ?,
            posto_trabalho_id = ?, escala = ?, data_admissao = ?, telefone = ?,
            email = ?, linhas_onibus = ?, quantidade_passagens_dia = ?,
            valor_passagem_unitaria = ?, valor_diario_va = ?, ativo = ?,
            linhas_transporte_json = ?, total_diario_vt = ?, modelo_os_id = ?
          WHERE id = ?
        `).run(
          body.nome,
          body.cpf || null,
          novoCargoId,
          novoClienteId,
          novaUnidadeId,
          novoPostoId,
          body.escala || '5x2',
          body.data_admissao || null,
          body.telefone || null,
          body.email || null,
          editLinhasResumo,
          editTotalPassagens,
          editValorPassagem,
          novoVA,
          body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1,
          JSON.stringify(editLinhasTransporte || []),
          editTotalDiarioVT,
          novoModeloOsId,
          id
        );

        // LOGICA MULTI CLIENTE
        // Remove os roteiros antigos
        db.prepare('DELETE FROM colaborador_clientes_compartilhados WHERE colaborador_id = ?').run(id);

        if (body.is_multi_cliente && Array.isArray(body.multi_clientes)) {
           const stmtMulti = db.prepare(`
              INSERT INTO colaborador_clientes_compartilhados 
              (colaborador_id, cliente_id, ativo)
              VALUES (?, ?, 1)
           `);
           for (const mc of body.multi_clientes) {
              if (mc.cliente_id) {
                 stmtMulti.run(id, mc.cliente_id);
              }
           }
        }
        // Registro de alteraÃ§Ãµes no histÃ³rico da vida do colaborador
        if (colabAnterior) {
          try {
            // 1. MudanÃ§a de Cliente / Posto / Setor
            if (colabAnterior.cliente_id !== novoClienteId || colabAnterior.posto_trabalho_id !== novoPostoId) {
              const novoCliNome = novoClienteId ? db.prepare('SELECT nome_fantasia FROM clientes WHERE id = ?').get(novoClienteId)?.nome_fantasia : 'Reserva TÃ©cnica';
              const novoPtNome = novoPostoId ? db.prepare('SELECT nome_posto FROM postos_trabalho WHERE id = ?').get(novoPostoId)?.nome_posto : 'Sem Posto Fixo';
              registrarEventoHistoricoColaborador(
                id,
                'TRANSFERENCIA',
                'MudanÃ§a de Posto / Cliente',
                `Transferido de [${colabAnterior.cliente_nome || 'Reserva TÃ©cnica'} - ${colabAnterior.nome_posto || 'Sem Posto'}] para [${novoCliNome} - ${novoPtNome}].`,
                new Date().toISOString().split('T')[0]
              );
            }

            // 2. MudanÃ§a no Transporte / VT
            const vtAntigo = Number(colabAnterior.total_diario_vt || (colabAnterior.quantidade_passagens_dia * colabAnterior.valor_passagem_unitaria) || 0);
            if (Math.abs(vtAntigo - editTotalDiarioVT) > 0.01 || (colabAnterior.linhas_onibus || '') !== editLinhasResumo) {
              registrarEventoHistoricoColaborador(
                id,
                'ALTERACAO_BENEFICIO',
                'AlteraÃ§Ã£o no Vale Transporte (VT)',
                `Transporte atualizado. Custo diÃ¡rio: R$ ${vtAntigo.toFixed(2)} -> R$ ${editTotalDiarioVT.toFixed(2)} (${editTotalPassagens} viagens/dia). Detalhes: ${editLinhasResumo}.`,
                new Date().toISOString().split('T')[0]
              );
            }

            // 3. MudanÃ§a na DiÃ¡ria de AlimentaÃ§Ã£o / VA
            const vaAntigo = Number(colabAnterior.valor_diario_va || 0);
            if (vaAntigo !== novoVA) {
              registrarEventoHistoricoColaborador(
                id,
                'ALTERACAO_BENEFICIO',
                'AlteraÃ§Ã£o no Vale AlimentaÃ§Ã£o (VA)',
                `DiÃ¡ria de alimentaÃ§Ã£o alterada de R$ ${vaAntigo.toFixed(2)}/dia para R$ ${novoVA.toFixed(2)}/dia.`,
                new Date().toISOString().split('T')[0]
              );
            }
          } catch (eEv) {
            console.error('Erro ao auditar histÃ³rico:', eEv.message);
          }
        }


        return jsonResponse(res, { success: true });
      }

      if (pathname.match(/^\/api\/colaboradores\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        try {
          db.prepare('DELETE FROM sst_documentos_colaborador WHERE colaborador_id = ?').run(id);
          db.prepare('DELETE FROM historico_eventos_colaborador WHERE colaborador_id = ?').run(id);
          db.prepare('DELETE FROM beneficios_colaborador_mes WHERE colaborador_id = ?').run(id);
          db.prepare('DELETE FROM faltas WHERE colaborador_id = ?').run(id);
          db.prepare('DELETE FROM ferias WHERE colaborador_id = ?').run(id);
          db.prepare('DELETE FROM colaboradores WHERE id = ?').run(id);
          return jsonResponse(res, { success: true, message: 'Colaborador removido com sucesso!' });
        } catch (eDel) {
          db.prepare("UPDATE colaboradores SET ativo = 0, posto_trabalho_id = NULL, status_colaborador = 'Demitido' WHERE id = ?").run(id);
          return jsonResponse(res, { success: true, message: 'Colaborador inativado e posto liberado com sucesso!' });
        }
      }

      // DEMISSÃƒO / DESLIGAMENTO DE COLABORADOR (LIBERA POSTO DE TRABALHO)
      if (pathname.match(/^\/api\/colaboradores\/\d+\/demitir$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        const dataDemissao = body.data_demissao || new Date().toISOString().split('T')[0];
        const motivo = body.motivo_demissao || 'DemissÃ£o / Desligamento de Colaborador';

        const colab = db.prepare('SELECT id, nome, posto_trabalho_id, cliente_id FROM colaboradores WHERE id = ?').get(id);
        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        db.prepare(`
          UPDATE colaboradores SET
            ativo = 0,
            status_colaborador = 'Demitido',
            data_demissao = ?,
            motivo_demissao = ?,
            posto_trabalho_id = NULL
          WHERE id = ?
        `).run(dataDemissao, motivo, id);

        registrarEventoHistoricoColaborador(
          id,
          'DEMISSAO',
          'Desligamento / DemissÃ£o da Empresa',
          `Colaborador desligado da empresa na data de ${dataDemissao}. Motivo: ${motivo}. Posto anterior desocupado.`,
          dataDemissao,
          { motivo: motivo, data_demissao: dataDemissao }
        );

        return jsonResponse(res, {
          success: true,
          message: `Colaborador ${colab.nome} foi demitido/desligado com sucesso. O posto de trabalho foi desocupado e agora requer contrataÃ§Ã£o ou realocaÃ§Ã£o.`
        });
      }

      // VINCULAR / TRANSFERIR COLABORADOR EFETIVO AO POSTO DE TRABALHO
      if (pathname.match(/^\/api\/colaboradores\/\d+\/vincular-posto$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);

        if (!body.posto_trabalho_id || !body.cliente_id) {
          return errorResponse(res, 'Cliente e Posto de Trabalho de destino sÃ£o obrigatÃ³rios', 400);
        }

        const postoDestinoId = parseInt(body.posto_trabalho_id, 10);
        const clienteDestinoId = parseInt(body.cliente_id, 10);

        // 1. Obter colaborador atual
        const colab = db.prepare(`
          SELECT col.*, pt.nome_posto as posto_origem_nome, c.nome_fantasia as cliente_origem_nome
          FROM colaboradores col
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          LEFT JOIN clientes c ON col.cliente_id = c.id
          WHERE col.id = ?
        `).get(id);

        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);
        if (colab.ativo === 0 || colab.status_colaborador === 'Demitido') {
          return errorResponse(res, 'Colaborador inativo ou demitido nÃ£o pode ser vinculado a postos', 400);
        }

        // 2. Obter e validar posto de destino
        const postoDestino = db.prepare(`
          SELECT pt.*, c.nome_fantasia as cliente_nome
          FROM postos_trabalho pt
          JOIN clientes c ON pt.cliente_id = c.id
          WHERE pt.id = ? AND pt.ativo = 1
        `).get(postoDestinoId);

        if (!postoDestino) return errorResponse(res, 'Posto de trabalho de destino nÃ£o encontrado ou inativo', 404);

        // 3. Trava rÃ­gida de lotaÃ§Ã£o mÃ¡xima no posto de destino
        const ocupadosDestino = db.prepare(`
          SELECT COUNT(*) as count
          FROM colaboradores
          WHERE posto_trabalho_id = ? AND ativo = 1 AND id != ?
        `).get(postoDestinoId, id).count;

        if (!postoDestino.nome_posto.toUpperCase().includes('AFASTADO') && ocupadosDestino >= postoDestino.quantidade_vagas_limite) {
          return errorResponse(
            res,
            `BLOQUEIO DE LOTAÃ‡ÃƒO: O posto "${postoDestino.nome_posto}" possui limite contratado de ${postoDestino.quantidade_vagas_limite} vaga(s) e jÃ¡ estÃ¡ totalmente ocupado (${ocupadosDestino}/${postoDestino.quantidade_vagas_limite}). NÃ£o Ã© permitido alocar colaboradores excedentes.`,
            400
          );
        }

        // 4. ParÃ¢metros de atualizaÃ§Ã£o
        const novoCargoId = body.cargo_id ? parseInt(body.cargo_id, 10) : (postoDestino.cargo_id || colab.cargo_id);
        const novaEscala = body.escala || postoDestino.escala || colab.escala;
        const novaUnidadeId = body.unidade_id ? parseInt(body.unidade_id, 10) : (postoDestino.unidade_id || null);

        // 5. Atualizar colaborador com o novo cliente e posto
        db.prepare(`
          UPDATE colaboradores SET
            cliente_id = ?,
            posto_trabalho_id = ?,
            unidade_id = ?,
            cargo_id = ?,
            escala = ?
          WHERE id = ?
        `).run(
          clienteDestinoId,
          postoDestinoId,
          novaUnidadeId,
          novoCargoId,
          novaEscala,
          id
        );

        const eraReserva = !colab.posto_trabalho_id;
        const mensagem = eraReserva
          ? `Colaborador ${colab.nome} foi puxado da Reserva TÃ©cnica e vinculado com sucesso ao posto "${postoDestino.nome_posto}" de ${postoDestino.cliente_nome}!`
          : `Colaborador ${colab.nome} foi transferido do cliente "${colab.cliente_origem_nome || 'Anterior'}" para o posto "${postoDestino.nome_posto}" de ${postoDestino.cliente_nome}. A vaga no posto anterior foi liberada com sucesso!`;

        registrarEventoHistoricoColaborador(
          id,
          'TRANSFERENCIA',
          eraReserva ? 'AlocaÃ§Ã£o em Posto de Trabalho' : 'TransferÃªncia de Posto/Cliente',
          mensagem,
          new Date().toISOString().split('T')[0],
          {
            origem: { cliente: colab.cliente_origem_nome, posto: colab.posto_origem_nome },
            destino: { cliente: postoDestino.cliente_nome, posto: postoDestino.nome_posto }
          }
        );

        return jsonResponse(res, {
          success: true,
          message: mensagem,
          era_reserva: eraReserva,
          origem: {
            cliente_id: colab.cliente_id,
            cliente_nome: colab.cliente_origem_nome,
            posto_id: colab.posto_trabalho_id,
            posto_nome: colab.posto_origem_nome
          },
          destino: {
            cliente_id: clienteDestinoId,
            cliente_nome: postoDestino.cliente_nome,
            posto_id: postoDestinoId,
            posto_nome: postoDestino.nome_posto
          }
        });
      }

      // VINCULAR COLABORADORES EM LOTE AO POSTO DE TRABALHO
      if (pathname === '/api/colaboradores/vincular-lote' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { colaborador_ids, posto_trabalho_id, cliente_id, cargo_id, escala, unidade_id } = body;

        if (!Array.isArray(colaborador_ids) || colaborador_ids.length === 0) {
          return errorResponse(res, 'Nenhum colaborador selecionado para vinculaÃ§Ã£o', 400);
        }
        if (!posto_trabalho_id || !cliente_id) {
          return errorResponse(res, 'Cliente e Posto de Trabalho de destino sÃ£o obrigatÃ³rios', 400);
        }

        const postoDestinoId = parseInt(posto_trabalho_id, 10);
        const clienteDestinoId = parseInt(cliente_id, 10);

        const postoDestino = db.prepare(`
          SELECT pt.*, c.nome_fantasia as cliente_nome
          FROM postos_trabalho pt
          JOIN clientes c ON pt.cliente_id = c.id
          WHERE pt.id = ? AND pt.ativo = 1
        `).get(postoDestinoId);

        if (!postoDestino) return errorResponse(res, 'Posto de trabalho de destino nÃ£o encontrado ou inativo', 404);

        // Validar lotaÃ§Ã£o mÃ¡xima disponÃ­vel no posto de destino
        const placeholders = colaborador_ids.map(() => '?').join(',');
        const ocupadosDestino = db.prepare(`
          SELECT COUNT(*) as count
          FROM colaboradores
          WHERE posto_trabalho_id = ? AND ativo = 1 AND id NOT IN (${placeholders})
        `).get(postoDestinoId, ...colaborador_ids).count;

        const vagasDisponiveis = postoDestino.quantidade_vagas_limite - ocupadosDestino;
        if (!postoDestino.nome_posto.toUpperCase().includes('AFASTADO') && colaborador_ids.length > vagasDisponiveis) {
          return errorResponse(
            res,
            `BLOQUEIO DE LOTAÃ‡ÃƒO: O posto "${postoDestino.nome_posto}" possui apenas ${vagasDisponiveis} vaga(s) disponÃ­vel(is) (limite: ${postoDestino.quantidade_vagas_limite}, ocupadas por outros: ${ocupadosDestino}). VocÃª tentou vincular ${colaborador_ids.length} colaborador(es).`,
            400
          );
        }

        const novoCargoId = cargo_id ? parseInt(cargo_id, 10) : (postoDestino.cargo_id || null);
        const novaEscala = escala || postoDestino.escala || '5x2';
        const novaUnidadeId = unidade_id ? parseInt(unidade_id, 10) : (postoDestino.unidade_id || null);

        const stmtUpdate = db.prepare(`
          UPDATE colaboradores SET
            cliente_id = ?,
            posto_trabalho_id = ?,
            unidade_id = ?,
            cargo_id = COALESCE(?, cargo_id),
            escala = COALESCE(?, escala)
          WHERE id = ?
        `);

        let totalVinculados = 0;
        let transferidos = 0;
        let reservas = 0;

        for (const cid of colaborador_ids) {
          const c = db.prepare('SELECT id, nome, posto_trabalho_id FROM colaboradores WHERE id = ?').get(cid);
          if (c) {
            if (c.posto_trabalho_id) transferidos++;
            else reservas++;
            stmtUpdate.run(clienteDestinoId, postoDestinoId, novaUnidadeId, novoCargoId, novaEscala, cid);
            totalVinculados++;

            registrarEventoHistoricoColaborador(
              cid,
              'TRANSFERENCIA',
              'AlocaÃ§Ã£o / VinculaÃ§Ã£o ao Posto',
              `Colaborador vinculado ao posto "${postoDestino.nome_posto}" (${postoDestino.cliente_nome}). Escala: ${novaEscala}.`,
              new Date().toISOString().split('T')[0],
              { posto: postoDestino.nome_posto, cliente: postoDestino.cliente_nome, escala: novaEscala }
            );
          }
        }

        return jsonResponse(res, {
          success: true,
          message: `${totalVinculados} colaborador(es) vinculado(s) com sucesso ao posto "${postoDestino.nome_posto}" de ${postoDestino.cliente_nome}! (${reservas} da Reserva TÃ©cnica, ${transferidos} por TransferÃªncia)`,
          total_vinculados: totalVinculados,
          reservas,
          transferidos
        });
      }

      // DESVINCULAR COLABORADOR PARA A RESERVA TÃ‰CNICA (SEM DEMISSÃƒO)
      if (pathname.match(/^\/api\/colaboradores\/\d+\/desvincular-posto$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        const colab = db.prepare(`
          SELECT col.id, col.nome, col.posto_trabalho_id, pt.nome_posto, c.nome_fantasia as cliente_nome
          FROM colaboradores col
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          LEFT JOIN clientes c ON col.cliente_id = c.id
          WHERE col.id = ?
        `).get(id);

        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        db.prepare(`
          UPDATE colaboradores SET
            cliente_id = NULL,
            posto_trabalho_id = NULL,
            unidade_id = NULL
          WHERE id = ?
        `).run(id);

        registrarEventoHistoricoColaborador(
          id,
          'TRANSFERENCIA',
          'Movido para a Reserva TÃ©cnica',
          `Colaborador desvinculado do posto "${colab.nome_posto || 'Posto'}" (${colab.cliente_nome || 'Cliente'}) e retornado para a Reserva TÃ©cnica.`,
          new Date().toISOString().split('T')[0],
          { posto_anterior: colab.nome_posto, cliente_anterior: colab.cliente_nome }
        );

        return jsonResponse(res, {
          success: true,
          message: `Colaborador ${colab.nome} foi desvinculado do posto "${colab.nome_posto || 'Posto'}" e movido para a Reserva TÃ©cnica. A vaga no posto foi liberada com sucesso.`
        });
      }

      // OBTER HISTÃ“RICO DA VIDA DO COLABORADOR (DOSSIÃŠ & LINHA DO TEMPO 360Â°)
      if (pathname.match(/^\/api\/colaboradores\/\d+\/historico$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[3], 10);
        const colab = db.prepare(`
          SELECT col.*, cg.nome_cargo, c.nome_fantasia as cliente_nome, pt.nome_posto, u.nome_unidade
          FROM colaboradores col
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          LEFT JOIN unidades u ON col.unidade_id = u.id
          WHERE col.id = ?
        `).get(id);

        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        // Buscar eventos registrados na tabela historico_eventos_colaborador
        const eventosDB = db.prepare(`
          SELECT * FROM historico_eventos_colaborador
          WHERE colaborador_id = ?
          ORDER BY data_evento DESC, id DESC
        `).all(id);

        // Buscar faltas e atestados em faltas_coberturas
        const faltasDB = db.prepare(`
          SELECT f.*, c.nome_fantasia as cliente_nome, u.nome_unidade, cg.nome_cargo,
                 cobertor.nome as cobertor_nome, free.nome as freelancer_nome
          FROM faltas_coberturas f
          LEFT JOIN clientes c ON f.cliente_id = c.id
          LEFT JOIN unidades u ON f.unidade_id = u.id
          LEFT JOIN cargos cg ON f.cargo_id = cg.id
          LEFT JOIN colaboradores cobertor ON f.cobertor_colaborador_id = cobertor.id
          LEFT JOIN freelancers free ON f.freelancer_id = free.id
          WHERE f.colaborador_id = ?
          ORDER BY f.data_falta DESC
        `).all(id);

        // Buscar fÃ©rias registradas
        const feriasDB = db.prepare(`
          SELECT hf.*, c.nome_fantasia as cliente_nome, pt.nome_posto, free.nome as freelancer_nome
          FROM historico_ferias hf
          LEFT JOIN clientes c ON hf.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON hf.posto_trabalho_id = pt.id
          LEFT JOIN freelancers free ON hf.freelancer_id = free.id
          WHERE hf.colaborador_id = ?
          ORDER BY hf.data_inicio DESC
        `).all(id);

        const timeline = [];

        // 1. Eventos da tabela de auditoria
        eventosDB.forEach(ev => {
          timeline.push({
            id: 'ev_' + ev.id,
            tipo: ev.tipo_evento,
            titulo: ev.titulo,
            descricao: ev.descricao,
            data: ev.data_evento,
            responsavel: ev.usuario_responsavel || 'Sistema',
            detalhes: ev.dados_adicionais_json ? JSON.parse(ev.dados_adicionais_json) : null,
            created_at: ev.created_at
          });
        });

        // 2. Se nÃ£o houver evento explÃ­cito de admissÃ£o, sintetizar com a data de admissÃ£o
        const temAdmissao = timeline.some(t => t.tipo === 'ADMISSAO');
        if (!temAdmissao && colab.data_admissao) {
          timeline.push({
            id: 'adm_auto',
            tipo: 'ADMISSAO',
            titulo: 'AdmissÃ£o na Empresa',
            descricao: `Colaborador admitido no cargo de ${colab.nome_cargo || 'FunÃ§Ã£o Contratual'} no cliente ${colab.cliente_nome || 'Reserva TÃ©cnica'}. Escala: ${colab.escala || '5x2'}.`,
            data: colab.data_admissao,
            responsavel: 'Registro Cadastral',
            detalhes: {
              cargo: colab.nome_cargo,
              cliente: colab.cliente_nome,
              escala: colab.escala
            },
            created_at: colab.data_admissao
          });
        }

        // 3. Se estiver demitido e nÃ£o houver evento explÃ­cito de demissÃ£o
        const temDemissao = timeline.some(t => t.tipo === 'DEMISSAO');
        if (!temDemissao && colab.data_demissao) {
          timeline.push({
            id: 'dem_auto',
            tipo: 'DEMISSAO',
            titulo: 'Desligamento / DemissÃ£o',
            descricao: colab.motivo_demissao || 'Colaborador desligado da empresa.',
            data: colab.data_demissao,
            responsavel: 'Recursos Humanos',
            detalhes: { motivo: colab.motivo_demissao },
            created_at: colab.data_demissao
          });
        }

        // 4. Inserir faltas e atestados
        faltasDB.forEach(f => {
          const ehAtestado = !!(f.cid_atestado || (f.motivo_falta && f.motivo_falta.toLowerCase().includes('atestado')));
          const tipo = ehAtestado ? 'ATESTADO' : 'FALTA';
          const titulo = ehAtestado 
            ? `Atestado MÃ©dico (${f.dias_afastamento || 1} dia(s)${f.cid_atestado ? ' - CID: ' + f.cid_atestado : ''})` 
            : `Falta Registrada (${f.motivo_falta || 'Injustificada'})`;
          
          let cobInfo = 'Posto sem cobertura substituta.';
          if (f.houve_cobertura) {
            cobInfo = `Houve cobertura (${f.tipo_cobertura || 'Substituto'}): ${f.cobertor_nome || f.freelancer_nome || 'Colaborador'}.`;
          }

          timeline.push({
            id: 'falta_' + f.id,
            tipo: tipo,
            titulo: titulo,
            descricao: `Data: ${f.data_falta} | Local: ${f.cliente_nome || 'Cliente'} - ${f.nome_unidade || 'Unidade'}. ${cobInfo} ${f.observacoes_operacao ? ' Obs: ' + f.observacoes_operacao : ''}`,
            data: f.data_falta,
            responsavel: f.supervisor_nome || 'OperaÃ§Ã£o/RH',
            detalhes: {
              motivo: f.motivo_falta,
              dias: f.dias_afastamento,
              cid: f.cid_atestado,
              houve_cobertura: f.houve_cobertura,
              cobertor: f.cobertor_nome || f.freelancer_nome
            },
            created_at: f.created_at
          });
        });

        // 5. Inserir fÃ©rias
        feriasDB.forEach(fe => {
          const jaTem = timeline.some(t => t.tipo === 'FERIAS' && t.data === fe.data_inicio);
          if (!jaTem) {
            let cobInfo = fe.havera_cobertura ? `Cobertura por: ${fe.freelancer_nome || 'Substituto'}` : 'Sem substituiÃ§Ã£o direta.';
            timeline.push({
              id: 'ferias_' + fe.id,
              tipo: 'FERIAS',
              titulo: `FÃ©rias Concedidas (${fe.dias_ferias} dias)`,
              descricao: `PerÃ­odo gozado de ${fe.data_inicio} atÃ© ${fe.data_fim}. ${fe.tipo_ferias || ''}. ${cobInfo} ${fe.observacoes ? ' Obs: ' + fe.observacoes : ''}`,
              data: fe.data_inicio,
              responsavel: 'RH / BenefÃ­cios',
              detalhes: {
                data_inicio: fe.data_inicio,
                data_fim: fe.data_fim,
                dias: fe.dias_ferias,
                tipo: fe.tipo_ferias,
                cobertura: fe.havera_cobertura,
                freelancer: fe.freelancer_nome
              },
              created_at: fe.created_at
            });
          }
        });

        // Ordenar timeline do mais recente para o mais antigo
        timeline.sort((a, b) => {
          if (a.data !== b.data) return b.data.localeCompare(a.data);
          return (b.created_at || '').localeCompare(a.created_at || '');
        });

        const totalFaltas = faltasDB.filter(f => !f.cid_atestado && (!f.motivo_falta || !f.motivo_falta.toLowerCase().includes('atestado'))).length;
        const totalAtestados = faltasDB.filter(f => f.cid_atestado || (f.motivo_falta && f.motivo_falta.toLowerCase().includes('atestado'))).length;
        const totalFerias = feriasDB.length;
        const totalTransferencias = timeline.filter(t => t.tipo === 'TRANSFERENCIA').length;
        const tempoEmpresa = calcularTempoEmpresa(colab.data_admissao, colab.data_demissao);

        return jsonResponse(res, {
          colaborador: {
            ...colab,
            tempo_empresa: tempoEmpresa
          },
          estatisticas: {
            tempo_empresa: tempoEmpresa,
            total_faltas: totalFaltas,
            total_atestados: totalAtestados,
            total_ferias: totalFerias,
            total_transferencias: totalTransferencias
          },
          timeline: timeline
        });
      }

      // REGISTRAR ANOTAÃ‡ÃƒO MANUAL NO HISTÃ“RICO DO COLABORADOR
      if (pathname.match(/^\/api\/colaboradores\/\d+\/historico$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);

        if (!body.titulo) return errorResponse(res, 'TÃ­tulo do evento Ã© obrigatÃ³rio', 400);

        registrarEventoHistoricoColaborador(
          id,
          body.tipo_evento || 'ANOTACAO',
          body.titulo,
          body.descricao || '',
          body.data_evento || new Date().toISOString().split('T')[0],
          body.dados_adicionais || null,
          body.usuario_responsavel || 'Administrador'
        );

        return jsonResponse(res, { success: true, message: 'Evento adicionado ao histÃ³rico com sucesso!' });
      }

      // OBTER DADOS DE UM COLABORADOR PARA EDIÃ‡ÃƒO
      if (pathname.match(/^\/api\/colaboradores\/\d+$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[3], 10);
        const colab = db.prepare(`
          SELECT col.*, cg.nome_cargo, c.nome_fantasia as cliente_nome, pt.nome_posto
          FROM colaboradores col
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          WHERE col.id = ?
        `).get(id);

        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);
        return jsonResponse(res, colab);
      }

      // CONCEDER FÃ‰RIAS AO COLABORADOR
      if (pathname.match(/^\/api\/colaboradores\/\d+\/conceder-ferias$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        const colab = db.prepare('SELECT id, nome, cliente_id, unidade_id, posto_trabalho_id FROM colaboradores WHERE id = ?').get(id);
        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        const dataInicio = body.data_inicio;
        const dataFim = body.data_fim;
        if (!dataInicio || !dataFim) return errorResponse(res, 'Data de inÃ­cio e data de tÃ©rmino das fÃ©rias sÃ£o obrigatÃ³rias', 400);

        const diffTempo = Math.abs(new Date(dataFim) - new Date(dataInicio));
        const dias = Math.max(1, Math.round(diffTempo / (1000 * 60 * 60 * 24)) + 1);
        const haveraCobertura = body.havera_cobertura ? 1 : 0;
        const tipoCobertura = body.tipo_cobertura || (haveraCobertura ? 'freelancer' : 'sem_cobertura');
        const freelancerId = body.freelancer_id ? parseInt(body.freelancer_id, 10) : null;
        const valorCobertura = parseFloat(body.valor_cobertura) || 0;

        // 1. Inserir no histÃ³rico de fÃ©rias
        const stmtHist = db.prepare(`
          INSERT INTO historico_ferias (
            colaborador_id, posto_trabalho_id, cliente_id, data_inicio, data_fim,
            dias_ferias, tipo_ferias, havera_cobertura, tipo_cobertura, freelancer_id,
            valor_cobertura, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmtHist.run(
          id,
          colab.posto_trabalho_id,
          colab.cliente_id,
          dataInicio,
          dataFim,
          dias,
          body.tipo_ferias || 'FÃ©rias Integrais (30 dias)',
          haveraCobertura,
          tipoCobertura,
          freelancerId,
          valorCobertura,
          body.observacoes || ''
        );

        // 2. Se houver cobertura com freelancer, integrar com coberturas_ferias_mensal
        if (haveraCobertura && freelancerId) {
          const anoMes = dataInicio.slice(0, 7);
          db.prepare(`
            INSERT INTO coberturas_ferias_mensal (
              colaborador_titular_id, posto_trabalho_id, cliente_id, freelancer_id,
              ano_mes, data_inicio, data_fim, tipo_cobertura, valor_acordado_mensal, status_pagamento, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            colab.posto_trabalho_id || 1,
            colab.cliente_id || 1,
            freelancerId,
            anoMes,
            dataInicio,
            dataFim,
            body.tipo_ferias || 'FÃ©rias Integrais (30 dias)',
            valorCobertura || 2800.00,
            'Pendente',
            body.observacoes || ''
          );
        }

        // 3. Atualizar status e datas de fÃ©rias do colaborador
        db.prepare(`
          UPDATE colaboradores SET
            status_ferias_atual = 'Em FÃ©rias',
            ultima_ferias_inicio = ?,
            ultima_ferias_fim = ?
          WHERE id = ?
        `).run(dataInicio, dataFim, id);

        registrarEventoHistoricoColaborador(
          id,
          'FERIAS',
          `ConcessÃ£o de FÃ©rias (${dias} dias)`,
          `PerÃ­odo gozado de ${dataInicio} atÃ© ${dataFim}. ${haveraCobertura ? 'Com cobertura de substituiÃ§Ã£o' : 'Sem cobertura de substituiÃ§Ã£o'}.${body.observacoes ? ' Obs: ' + body.observacoes : ''}`,
          dataInicio,
          { data_inicio: dataInicio, data_fim: dataFim, dias: dias, cobertura: haveraCobertura }
        );

        return jsonResponse(res, {
          success: true,
          message: `FÃ©rias concedidas com sucesso para ${colab.nome} (${dataInicio} a ${dataFim}).`
        });
      }

      // -----------------------------------------------------------
      // 5. EXCLUSÃƒO EM MASSA (MÃšLTIPLOS ITENS COM CHECKBOXES)
      // -----------------------------------------------------------
      if (pathname === '/api/batch-delete' && method === 'POST') {
        const { entidade, ids } = await parseRequestBody(req);
        if (!entidade || !Array.isArray(ids) || ids.length === 0) {
          return errorResponse(res, 'Entidade e array de IDs sÃ£o obrigatÃ³rios', 400);
        }

        const placeholders = ids.map(() => '?').join(',');

        if (entidade === 'colaboradores') {
          db.prepare(`UPDATE colaboradores SET ativo = 0 WHERE id IN (${placeholders})`).run(...ids);
        } else if (entidade === 'clientes') {
          db.prepare(`UPDATE clientes SET ativo = 0 WHERE id IN (${placeholders})`).run(...ids);
        } else if (entidade === 'faltas' || entidade === 'faturamento') {
          db.prepare(`DELETE FROM faltas_coberturas WHERE id IN (${placeholders})`).run(...ids);
        } else if (entidade === 'postos') {
          db.prepare(`UPDATE postos_trabalho SET ativo = 0 WHERE id IN (${placeholders})`).run(...ids);
        } else if (entidade === 'freelancers') {
          db.prepare(`UPDATE freelancers SET ativo = 0 WHERE id IN (${placeholders})`).run(...ids);
        } else if (entidade === 'ferias' || entidade === 'coberturas_ferias') {
          db.prepare(`DELETE FROM coberturas_ferias_mensal WHERE id IN (${placeholders})`).run(...ids);
        } else if (entidade === 'beneficios') {
          db.prepare(`UPDATE colaboradores SET linhas_onibus = 'Sem VT', valor_passagem_unitaria = 0, valor_diario_va = 0 WHERE id IN (${placeholders})`).run(...ids);
        } else if (entidade === 'cargos') {
          db.prepare(`UPDATE cargos SET ativo = 0 WHERE id IN (${placeholders})`).run(...ids);
        } else {
          return errorResponse(res, 'Entidade nÃ£o suportada para exclusÃ£o em massa', 400);
        }

        return jsonResponse(res, { success: true, count: ids.length });
      }

      // -----------------------------------------------------------
      // 6. CONTROLE DE FÃ‰RIAS E DIMENSIONAMENTO FREELANCER MENSAL
      // -----------------------------------------------------------
      if (pathname === '/api/ferias/coberturas' && method === 'GET') {
        const mes = query.ano_mes;
        let sql = `
          SELECT cf.*,
                 col.nome as titular_nome,
                 cg.nome_cargo,
                 c.nome_fantasia as cliente_nome,
                 pt.nome_posto,
                 free.nome as freelancer_nome,
                 free.telefone as freelancer_telefone,
                 free.chave_pix as freelancer_pix
          FROM coberturas_ferias_mensal cf
          JOIN colaboradores col ON cf.colaborador_titular_id = col.id
          JOIN cargos cg ON col.cargo_id = cg.id
          JOIN clientes c ON cf.cliente_id = c.id
          JOIN postos_trabalho pt ON cf.posto_trabalho_id = pt.id
          JOIN freelancers free ON cf.freelancer_id = free.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];
        if (mes) {
          sql += ' AND cf.ano_mes = ? ';
          params.push(mes);
        }
        sql += ' ORDER BY cf.data_inicio DESC ';
        const coberturas = db.prepare(sql).all(...params);
        return jsonResponse(res, coberturas);
      }

      if (pathname === '/api/ferias/coberturas' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.colaborador_titular_id || !body.freelancer_id || !body.data_inicio || !body.data_fim) {
          return errorResponse(res, 'Colaborador Titular, Freelancer, Data InÃ­cio e Fim sÃ£o obrigatÃ³rios', 400);
        }

        // Buscar posto e cliente do colaborador
        const colab = db.prepare('SELECT cliente_id, posto_trabalho_id FROM colaboradores WHERE id = ?').get(parseInt(body.colaborador_titular_id, 10));
        const clienteId = colab ? colab.cliente_id : body.cliente_id;
        const postoId = colab ? colab.posto_trabalho_id : body.posto_trabalho_id;

        const stmt = db.prepare(`
          INSERT INTO coberturas_ferias_mensal (
            colaborador_titular_id, posto_trabalho_id, cliente_id, freelancer_id,
            ano_mes, data_inicio, data_fim, tipo_cobertura, valor_acordado_mensal, status_pagamento, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const resCob = stmt.run(
          parseInt(body.colaborador_titular_id, 10),
          postoId || 1,
          clienteId || 1,
          parseInt(body.freelancer_id, 10),
          body.ano_mes || body.data_inicio.slice(0, 7),
          body.data_inicio,
          body.data_fim,
          body.tipo_cobertura || 'FÃ©rias (30 dias)',
          parseFloat(body.valor_acordado_mensal) || 2800.00,
          'Pendente',
          body.observacoes || ''
        );

        return jsonResponse(res, { success: true, id: resCob.lastInsertRowid });
      }

      // -----------------------------------------------------------
      // 6.1. CALENDÃRIO INTERATIVO & PROCESSOS DE FÃ‰RIAS (DP)
      // -----------------------------------------------------------
      if (pathname === '/api/ferias/programadas' && method === 'GET') {
        const mes = query.ano_mes; // 'YYYY-MM' ou 'todos'
        const etapa = query.etapa_processo;
        const clienteId = query.cliente_id;
        const busca = (query.busca || '').trim().toLowerCase();

        let sql = `
          SELECT hf.*,
                 col.nome as colaborador_nome,
                 col.nome as titular_nome,
                 col.cpf as colaborador_cpf,
                 col.cpf as titular_cpf,
                 col.data_admissao as colaborador_admissao,
                 col.status_ferias_atual,
                 cg.nome_cargo,
                 c.nome_fantasia as cliente_nome,
                 c.nome_razao_social as cliente_razao_social,
                 pt.nome_posto,
                 pt.escala as posto_escala,
                 pt.turno as posto_turno,
                 free.nome as freelancer_nome,
                 free.telefone as freelancer_telefone,
                 free.chave_pix as freelancer_pix,
                 sub.nome as substituto_titular_nome,
                 sub.nome as substituto_nome,
                 sub_cg.nome_cargo as substituto_titular_cargo
          FROM historico_ferias hf
          JOIN colaboradores col ON hf.colaborador_id = col.id
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON hf.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON hf.posto_trabalho_id = pt.id
          LEFT JOIN freelancers free ON hf.freelancer_id = free.id
          LEFT JOIN colaboradores sub ON hf.colaborador_substituto_id = sub.id
          LEFT JOIN cargos sub_cg ON sub.cargo_id = sub_cg.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];

        if (mes && mes !== 'todos') {
          sql += ` AND (
            strftime('%Y-%m', hf.data_inicio) = ? OR 
            strftime('%Y-%m', hf.data_fim) = ? OR 
            (? BETWEEN strftime('%Y-%m', hf.data_inicio) AND strftime('%Y-%m', hf.data_fim))
          ) `;
          params.push(mes, mes, mes);
        }

        if (etapa && etapa !== 'todos') {
          sql += ' AND hf.etapa_processo = ? ';
          params.push(etapa);
        }

        if (clienteId && clienteId !== 'todos') {
          sql += ' AND hf.cliente_id = ? ';
          params.push(parseInt(clienteId, 10));
        }

        if (busca) {
          sql += ' AND (LOWER(col.nome) LIKE ? OR LOWER(COALESCE(free.nome, "")) LIKE ? OR LOWER(COALESCE(sub.nome, "")) LIKE ? OR LOWER(COALESCE(pt.nome_posto, "")) LIKE ?) ';
          const term = `%${busca}%`;
          params.push(term, term, term, term);
        }

        sql += ' ORDER BY hf.data_inicio ASC, hf.id DESC ';
        const ferias = db.prepare(sql).all(...params);

        // KPIs de Processos de FÃ©rias
        const kpis = {
          total_solicitadas_dp: 0,
          total_aviso_entregue: 0,
          total_recibo_entregue: 0,
          total_concluidas: 0,
          total_programadas: ferias.length
        };

        ferias.forEach(f => {
          const ep = f.etapa_processo || 'FÃ©rias solicitada ao Departamento Pessoal';
          if (ep === 'FÃ©rias solicitada ao Departamento Pessoal') kpis.total_solicitadas_dp++;
          else if (ep === 'Aviso de fÃ©rias entregue') kpis.total_aviso_entregue++;
          else if (ep === 'Recibo de fÃ©rias entregue') kpis.total_recibo_entregue++;
          else if (ep.includes('ConcluÃ­da') || ep.includes('Gozo')) kpis.total_concluidas++;
        });

        return jsonResponse(res, { success: true, ferias, programadas: ferias, kpis });
      }

      if (pathname === '/api/ferias/programar' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.colaborador_id || !body.data_inicio || !body.data_fim) {
          return errorResponse(res, 'Colaborador, Data de InÃ­cio e Data de Fim sÃ£o obrigatÃ³rios', 400);
        }

        const colabId = parseInt(body.colaborador_id, 10);
        const colab = db.prepare('SELECT * FROM colaboradores WHERE id = ?').get(colabId);
        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        const dataInicio = body.data_inicio;
        const dataFim = body.data_fim;
        const dInicio = new Date(dataInicio + 'T12:00:00');
        const dFim = new Date(dataFim + 'T12:00:00');
        const diffDays = Math.max(1, Math.round((dFim - dInicio) / (1000 * 60 * 60 * 24)) + 1);
        const diasFerias = parseInt(body.dias_ferias, 10) || diffDays;

        const tipoCobertura = body.tipo_cobertura || 'sem_cobertura';
        const haveraCobertura = tipoCobertura !== 'sem_cobertura' ? 1 : 0;
        const freelancerId = (tipoCobertura === 'freelancer' && body.freelancer_id) ? parseInt(body.freelancer_id, 10) : null;
        const colabSubId = (tipoCobertura === 'colaborador' && body.colaborador_substituto_id) ? parseInt(body.colaborador_substituto_id, 10) : null;
        const valorCobertura = parseFloat(body.valor_cobertura) || 0;
        const etapa = body.etapa_processo || 'FÃ©rias solicitada ao Departamento Pessoal';

        const stmtHist = db.prepare(`
          INSERT INTO historico_ferias (
            colaborador_id, posto_trabalho_id, cliente_id, data_inicio, data_fim,
            dias_ferias, tipo_ferias, havera_cobertura, tipo_cobertura,
            freelancer_id, colaborador_substituto_id, nome_substituto_avulso, valor_cobertura,
            etapa_processo, data_aviso_entregue, data_recibo_entregue, status_ferias, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const resHist = stmtHist.run(
          colabId,
          colab.posto_trabalho_id,
          colab.cliente_id,
          dataInicio,
          dataFim,
          diasFerias,
          body.tipo_ferias || `FÃ©rias (${diasFerias} dias)`,
          haveraCobertura,
          tipoCobertura,
          freelancerId,
          colabSubId,
          body.nome_substituto_avulso || '',
          valorCobertura,
          etapa,
          body.data_aviso_entregue || null,
          body.data_recibo_entregue || null,
          body.status_ferias || 'Programada',
          body.observacoes || ''
        );

        const newId = resHist.lastInsertRowid;

        // Se houver cobertura com freelancer, integrar com coberturas_ferias_mensal
        if (haveraCobertura && freelancerId) {
          const anoMes = dataInicio.slice(0, 7);
          db.prepare(`
            INSERT INTO coberturas_ferias_mensal (
              colaborador_titular_id, posto_trabalho_id, cliente_id, freelancer_id,
              ano_mes, data_inicio, data_fim, tipo_cobertura, valor_acordado_mensal, status_pagamento, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            colabId,
            colab.posto_trabalho_id || 1,
            colab.cliente_id || 1,
            freelancerId,
            anoMes,
            dataInicio,
            dataFim,
            body.tipo_ferias || `FÃ©rias (${diasFerias} dias)`,
            valorCobertura || 2800.00,
            'Pendente',
            body.observacoes || ''
          );
        }

        // Se for etapa 'FÃ©rias em Gozo / ConcluÃ­das' ou a data de inÃ­cio for hoje/passada, marcar colaborador
        const hojeStr = new Date().toISOString().split('T')[0];
        if (dataInicio <= hojeStr && dataFim >= hojeStr) {
          db.prepare(`
            UPDATE colaboradores SET
              status_ferias_atual = 'Em FÃ©rias',
              ultima_ferias_inicio = ?,
              ultima_ferias_fim = ?
            WHERE id = ?
          `).run(dataInicio, dataFim, colabId);
        }

        registrarEventoHistoricoColaborador(
          colabId,
          'FERIAS',
          `ProgramaÃ§Ã£o de FÃ©rias (${diasFerias} dias) - ${etapa}`,
          `PerÃ­odo de ${dataInicio} atÃ© ${dataFim}. Cobertura: ${tipoCobertura}.${body.observacoes ? ' Obs: ' + body.observacoes : ''}`,
          dataInicio,
          { id: newId, data_inicio: dataInicio, data_fim: dataFim, etapa: etapa }
        );

        return jsonResponse(res, { success: true, id: newId, message: 'FÃ©rias programadas com sucesso!' });
      }

      if (pathname.match(/^\/api\/ferias\/programadas\/\d+$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[4], 10);
        const f = db.prepare(`
          SELECT hf.*,
                 col.nome as colaborador_nome,
                 col.cpf as colaborador_cpf,
                 cg.nome_cargo,
                 c.nome_fantasia as cliente_nome,
                 pt.nome_posto,
                 free.nome as freelancer_nome,
                 free.chave_pix as freelancer_pix,
                 sub.nome as substituto_titular_nome
          FROM historico_ferias hf
          JOIN colaboradores col ON hf.colaborador_id = col.id
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON hf.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON hf.posto_trabalho_id = pt.id
          LEFT JOIN freelancers free ON hf.freelancer_id = free.id
          LEFT JOIN colaboradores sub ON hf.colaborador_substituto_id = sub.id
          WHERE hf.id = ?
        `).get(id);

        if (!f) return errorResponse(res, 'FÃ©rias nÃ£o encontradas', 404);
        return jsonResponse(res, f);
      }

      if (pathname.match(/^\/api\/ferias\/programadas\/\d+$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        const atual = db.prepare('SELECT * FROM historico_ferias WHERE id = ?').get(id);
        if (!atual) return errorResponse(res, 'FÃ©rias nÃ£o encontradas', 404);

        const dataInicio = body.data_inicio || atual.data_inicio;
        const dataFim = body.data_fim || atual.data_fim;
        const dInicio = new Date(dataInicio + 'T12:00:00');
        const dFim = new Date(dataFim + 'T12:00:00');
        const diffDays = Math.max(1, Math.round((dFim - dInicio) / (1000 * 60 * 60 * 24)) + 1);
        const diasFerias = parseInt(body.dias_ferias, 10) || diffDays;

        const tipoCobertura = body.tipo_cobertura || atual.tipo_cobertura || 'sem_cobertura';
        const haveraCobertura = tipoCobertura !== 'sem_cobertura' ? 1 : 0;
        const freelancerId = (tipoCobertura === 'freelancer' && body.freelancer_id) ? parseInt(body.freelancer_id, 10) : null;
        const colabSubId = (tipoCobertura === 'colaborador' && body.colaborador_substituto_id) ? parseInt(body.colaborador_substituto_id, 10) : null;
        const valorCobertura = parseFloat(body.valor_cobertura) !== undefined ? parseFloat(body.valor_cobertura) : atual.valor_cobertura;
        const etapa = body.etapa_processo || atual.etapa_processo || 'FÃ©rias solicitada ao Departamento Pessoal';

        db.prepare(`
          UPDATE historico_ferias SET
            data_inicio = ?,
            data_fim = ?,
            dias_ferias = ?,
            tipo_ferias = ?,
            havera_cobertura = ?,
            tipo_cobertura = ?,
            freelancer_id = ?,
            colaborador_substituto_id = ?,
            nome_substituto_avulso = ?,
            valor_cobertura = ?,
            etapa_processo = ?,
            data_aviso_entregue = ?,
            data_recibo_entregue = ?,
            observacoes = ?
          WHERE id = ?
        `).run(
          dataInicio,
          dataFim,
          diasFerias,
          body.tipo_ferias || `FÃ©rias (${diasFerias} dias)`,
          haveraCobertura,
          tipoCobertura,
          freelancerId,
          colabSubId,
          body.nome_substituto_avulso || '',
          valorCobertura,
          etapa,
          body.data_aviso_entregue || atual.data_aviso_entregue,
          body.data_recibo_entregue || atual.data_recibo_entregue,
          body.observacoes || '',
          id
        );

        // Sincronizar com coberturas_ferias_mensal se cobertura por freelancer
        if (haveraCobertura && freelancerId) {
          const anoMes = dataInicio.slice(0, 7);
          const cobExistente = db.prepare('SELECT id FROM coberturas_ferias_mensal WHERE colaborador_titular_id = ? AND data_inicio = ?').get(atual.colaborador_id, atual.data_inicio);
          if (cobExistente) {
            db.prepare(`
              UPDATE coberturas_ferias_mensal SET
                freelancer_id = ?, data_inicio = ?, data_fim = ?, valor_acordado_mensal = ?, ano_mes = ?
              WHERE id = ?
            `).run(freelancerId, dataInicio, dataFim, valorCobertura, anoMes, cobExistente.id);
          } else {
            db.prepare(`
              INSERT INTO coberturas_ferias_mensal (
                colaborador_titular_id, posto_trabalho_id, cliente_id, freelancer_id,
                ano_mes, data_inicio, data_fim, tipo_cobertura, valor_acordado_mensal, status_pagamento, observacoes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(atual.colaborador_id, atual.posto_trabalho_id || 1, atual.cliente_id || 1, freelancerId, anoMes, dataInicio, dataFim, `FÃ©rias (${diasFerias} dias)`, valorCobertura, 'Pendente', body.observacoes || '');
          }
        } else {
          // Se nÃ£o hÃ¡ mais freelancer, remover cobertura vinculada
          db.prepare('DELETE FROM coberturas_ferias_mensal WHERE colaborador_titular_id = ? AND data_inicio = ?').run(atual.colaborador_id, atual.data_inicio);
        }

        return jsonResponse(res, { success: true, message: 'ProgramaÃ§Ã£o de fÃ©rias atualizada com sucesso!' });
      }

      if (pathname.match(/^\/api\/ferias\/programadas\/\d+\/etapa$/) && method === 'PATCH') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);
        if (!body.etapa_processo) return errorResponse(res, 'Etapa Ã© obrigatÃ³ria', 400);

        const atual = db.prepare('SELECT * FROM historico_ferias WHERE id = ?').get(id);
        if (!atual) return errorResponse(res, 'FÃ©rias nÃ£o encontradas', 404);

        const hojeStr = new Date().toISOString().split('T')[0];
        let dataAviso = body.data_aviso_entregue || atual.data_aviso_entregue;
        let dataRecibo = body.data_recibo_entregue || atual.data_recibo_entregue;

        if (body.etapa_processo === 'Aviso de fÃ©rias entregue' && !dataAviso) {
          dataAviso = hojeStr;
        } else if (body.etapa_processo === 'Recibo de fÃ©rias entregue' && !dataRecibo) {
          dataRecibo = hojeStr;
        }

        db.prepare(`
          UPDATE historico_ferias SET
            etapa_processo = ?,
            data_aviso_entregue = ?,
            data_recibo_entregue = ?
          WHERE id = ?
        `).run(body.etapa_processo, dataAviso, dataRecibo, id);

        // Se etapa for concluÃ­da ou gozo e perÃ­odo ativo, atualizar colaborador
        if (body.etapa_processo === 'FÃ©rias em Gozo / ConcluÃ­das') {
          if (atual.data_inicio <= hojeStr && atual.data_fim >= hojeStr) {
            db.prepare("UPDATE colaboradores SET status_ferias_atual = 'Em FÃ©rias' WHERE id = ?").run(atual.colaborador_id);
          } else if (atual.data_fim < hojeStr) {
            db.prepare("UPDATE colaboradores SET status_ferias_atual = 'Trabalhando' WHERE id = ?").run(atual.colaborador_id);
          }
        }

        return jsonResponse(res, { success: true, message: 'Etapa atualizada com sucesso!' });
      }

      if (pathname.match(/^\/api\/ferias\/programadas\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[4], 10);
        const atual = db.prepare('SELECT * FROM historico_ferias WHERE id = ?').get(id);
        if (!atual) return errorResponse(res, 'FÃ©rias nÃ£o encontradas', 404);

        // Deletar do histÃ³rico
        db.prepare('DELETE FROM historico_ferias WHERE id = ?').run(id);

        // Deletar coberturas vinculadas
        db.prepare('DELETE FROM coberturas_ferias_mensal WHERE colaborador_titular_id = ? AND data_inicio = ?').run(atual.colaborador_id, atual.data_inicio);

        // Restaurar status do colaborador se estava em fÃ©rias deste perÃ­odo
        db.prepare("UPDATE colaboradores SET status_ferias_atual = 'Trabalhando' WHERE id = ?").run(atual.colaborador_id);

        return jsonResponse(res, { success: true, message: 'ProgramaÃ§Ã£o de fÃ©rias cancelada com sucesso!' });
      }
      if (pathname === '/api/beneficios/fechamento' && method === 'GET') {
        const anoMes = query.ano_mes || new Date().toISOString().slice(0, 7);
        const [ano, mesNum] = anoMes.split('-').map(Number);
        const totalDiasNoMes = new Date(ano, mesNum, 0).getDate();
        const dataInicioMes = `${anoMes}-01`;
        const dataFimMes = `${anoMes}-${String(totalDiasNoMes).padStart(2, '0')}`;

        // Buscar parÃ¢metros de dias Ãºteis padrÃ£o do mÃªs
        let configDias = db.prepare('SELECT * FROM beneficios_config_mes WHERE ano_mes = ?').get(anoMes);
        if (!configDias) {
          configDias = { dias_uteis_5x2: 22, dias_uteis_6x1: 26, dias_uteis_12x36: 15 };
        }

        // Buscar colaboradores: ativos ou que foram demitidos a partir do inÃ­cio deste mÃªs, e admitidos atÃ© o fim deste mÃªs
        const colaboradores = db.prepare(`
          SELECT col.id, col.nome, col.cpf, col.escala, col.data_admissao, col.data_demissao,
                 col.status_colaborador, col.linhas_onibus, col.quantidade_passagens_dia,
                 col.valor_passagem_unitaria, col.valor_diario_va, col.ativo,
                 col.linhas_transporte_json, col.total_diario_vt,
                 c.nome_fantasia as cliente_nome, pt.nome_posto
          FROM colaboradores col
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          WHERE (col.data_admissao IS NULL OR col.data_admissao <= ?)
            AND (col.ativo = 1 OR (col.data_demissao IS NOT NULL AND col.data_demissao >= ?))
          ORDER BY col.nome ASC
        `).all(dataFimMes, dataInicioMes);

        const resultado = [];
        let totalGeralVT = 0;
        let totalGeralVA = 0;
        let totalFaltasDescontadas = 0;

        for (const col of colaboradores) {
          // Determinar perÃ­odo padrÃ£o para este colaborador
          let defaultInicio = dataInicioMes;
          if (col.data_admissao && col.data_admissao > dataInicioMes && col.data_admissao <= dataFimMes) {
            defaultInicio = col.data_admissao;
          }

          let defaultFim = dataFimMes;
          if (col.data_demissao && col.data_demissao >= dataInicioMes && col.data_demissao < dataFimMes) {
            defaultFim = col.data_demissao;
          }

          const ehProporcional = (defaultInicio !== dataInicioMes || defaultFim !== dataFimMes);
          let motivoProporcional = '';
          if (defaultInicio !== dataInicioMes && defaultFim !== dataFimMes) {
            motivoProporcional = 'AdmissÃ£o e DemissÃ£o no mÃªs';
          } else if (defaultInicio !== dataInicioMes) {
            motivoProporcional = 'Admitido no mÃªs';
          } else if (defaultFim !== dataFimMes) {
            motivoProporcional = 'Demitido no mÃªs';
          }

          // INTEGRAÃ‡ÃƒO COM FALTAS: Buscar faltas registradas no mÃªs
          const faltasDoMes = db.prepare(`
            SELECT data_falta
            FROM faltas_coberturas 
            WHERE colaborador_id = ? AND strftime('%Y-%m', data_falta) = ?
          `).all(col.id, anoMes);
          const faltasCount = faltasDoMes.length;

          // Verificar se existe customizaÃ§Ã£o salva
          const custom = db.prepare(`
            SELECT * FROM beneficios_colaborador_mes
            WHERE ano_mes = ? AND colaborador_id = ?
          `).get(anoMes, col.id);

          let dataInicioBeneficio, dataFimBeneficio, diasVT, diasVA;
          let tarifaVT, passagensDia, diariaVA, faltasDescontadas;
          let observacoes = '', customizado = false, diasSelecionadosJson = null;

          const valorPassagemBase = col.valor_passagem_unitaria !== null && col.valor_passagem_unitaria !== undefined ? Number(col.valor_passagem_unitaria) : 4.40;
          const qtdPassagensBase = col.quantidade_passagens_dia !== null && col.quantidade_passagens_dia !== undefined ? Number(col.quantidade_passagens_dia) : 2;
          const diariaVABase = col.valor_diario_va !== null && col.valor_diario_va !== undefined ? Number(col.valor_diario_va) : 28.00;

          if (custom && custom.customizado) {
            customizado = true;
            dataInicioBeneficio = custom.data_inicio_beneficio || defaultInicio;
            dataFimBeneficio = custom.data_fim_beneficio || defaultFim;
            tarifaVT = custom.tarifa_vt !== null && custom.tarifa_vt !== undefined ? Number(custom.tarifa_vt) : valorPassagemBase;
            passagensDia = custom.passagens_dia !== null && custom.passagens_dia !== undefined ? Number(custom.passagens_dia) : qtdPassagensBase;
            diariaVA = custom.diaria_va !== null && custom.diaria_va !== undefined ? Number(custom.diaria_va) : diariaVABase;
            faltasDescontadas = custom.faltas_descontadas !== null && custom.faltas_descontadas !== undefined ? Number(custom.faltas_descontadas) : faltasCount;
            diasVT = custom.dias_vt !== null && custom.dias_vt !== undefined ? Number(custom.dias_vt) : 0;
            diasVA = custom.dias_va !== null && custom.dias_va !== undefined ? Number(custom.dias_va) : 0;
            observacoes = custom.observacoes || '';
            diasSelecionadosJson = custom.dias_selecionados_json || null;
          } else {
            customizado = false;
            dataInicioBeneficio = defaultInicio;
            dataFimBeneficio = defaultFim;
            tarifaVT = valorPassagemBase;
            passagensDia = qtdPassagensBase;
            diariaVA = diariaVABase;
            faltasDescontadas = faltasCount;

            // Dias padrÃ£o do perÃ­odo
            let diasCalculados = 0;
            if (ehProporcional) {
              diasCalculados = calcularDiasUteisPeriodo(defaultInicio, defaultFim, col.escala);
            } else {
              if (col.escala.includes('6x1')) diasCalculados = configDias.dias_uteis_6x1;
              else if (col.escala.includes('12x36')) diasCalculados = configDias.dias_uteis_12x36;
              else diasCalculados = configDias.dias_uteis_5x2;
            }

            const diasEfetivosPadrao = Math.max(0, diasCalculados - faltasCount);
            diasVT = diasEfetivosPadrao;
            diasVA = diasEfetivosPadrao;
          }

          let custoDiarioVT = 0;
          if (custom && custom.customizado) {
            custoDiarioVT = passagensDia * tarifaVT;
          } else {
            custoDiarioVT = (col.total_diario_vt && Number(col.total_diario_vt) > 0)
              ? Number(col.total_diario_vt)
              : (passagensDia * tarifaVT);
          }
          const totalVTFinal = diasVT * custoDiarioVT;
          const totalVAFinal = diasVA * diariaVA;

          totalGeralVT += totalVTFinal;
          totalGeralVA += totalVAFinal;
          totalFaltasDescontadas += faltasDescontadas;

          resultado.push({
            colaborador_id: col.id,
            nome: col.nome,
            cpf: col.cpf,
            cliente_nome: col.cliente_nome || 'Geral',
            nome_posto: col.nome_posto || 'Posto PadrÃ£o',
            escala: col.escala,
            data_admissao: col.data_admissao,
            data_demissao: col.data_demissao,
            status_colaborador: col.status_colaborador || (col.ativo ? 'Ativo' : 'Demitido'),
            linhas_onibus: col.linhas_onibus || 'Municipal',
            linhas_transporte_json: col.linhas_transporte_json,
            data_inicio_beneficio: dataInicioBeneficio,
            data_fim_beneficio: dataFimBeneficio,
            eh_proporcional: ehProporcional,
            motivo_proporcional: motivoProporcional,
            customizado: customizado,
            faltas_mes: faltasDescontadas,
            dias_vt: diasVT,
            dias_va: diasVA,
            passagens_dia: passagensDia,
            tarifa_vt: tarifaVT,
            custo_diario_vt: custoDiarioVT,
            total_vt_final: totalVTFinal,
            diaria_va: diariaVA,
            total_va_final: totalVAFinal,
            observacoes: observacoes,
            dias_selecionados_json: diasSelecionadosJson
          });
        }

        return jsonResponse(res, {
          ano_mes: anoMes,
          configDias,
          total_colaboradores: resultado.length,
          total_geral_vt: totalGeralVT,
          total_geral_va: totalGeralVA,
          total_faltas_descontadas: totalFaltasDescontadas,
          itens: resultado
        });
      }

      // Detalhes do colaborador para modal de ajuste de benefÃ­cios e calendÃ¡rio
      if (pathname.startsWith('/api/beneficios/colaborador/') && method === 'GET') {
        const colabId = parseInt(pathname.split('/')[4], 10);
        const anoMes = query.ano_mes || new Date().toISOString().slice(0, 7);

        const col = db.prepare(`
          SELECT col.*, c.nome_fantasia as cliente_nome, pt.nome_posto
          FROM colaboradores col
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          WHERE col.id = ?
        `).get(colabId);

        if (!col) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        const [ano, mesNum] = anoMes.split('-').map(Number);
        const totalDiasNoMes = new Date(ano, mesNum, 0).getDate();
        const dataInicioMes = `${anoMes}-01`;
        const dataFimMes = `${anoMes}-${String(totalDiasNoMes).padStart(2, '0')}`;

        // Determinar datas proporcionais padrÃ£o
        let defaultInicio = dataInicioMes;
        if (col.data_admissao && col.data_admissao > dataInicioMes && col.data_admissao <= dataFimMes) {
          defaultInicio = col.data_admissao;
        }

        let defaultFim = dataFimMes;
        if (col.data_demissao && col.data_demissao >= dataInicioMes && col.data_demissao < dataFimMes) {
          defaultFim = col.data_demissao;
        }

        // Faltas no mÃªs
        const faltasRows = db.prepare(`
          SELECT data_falta FROM faltas_coberturas
          WHERE colaborador_id = ? AND strftime('%Y-%m', data_falta) = ?
        `).all(colabId, anoMes);
        const faltasSet = new Set(faltasRows.map(r => r.data_falta));

        // Buscar customizaÃ§Ã£o existente
        const custom = db.prepare(`
          SELECT * FROM beneficios_colaborador_mes
          WHERE ano_mes = ? AND colaborador_id = ?
        `).get(anoMes, colabId);

        let customDiasSet = null;
        if (custom && custom.dias_selecionados_json) {
          try {
            customDiasSet = new Set(JSON.parse(custom.dias_selecionados_json));
          } catch (e) {}
        }

        // Gerar grade diÃ¡ria do mÃªs
        const diasCalendario = [];
        let step12x36 = 0;

        for (let d = 1; d <= totalDiasNoMes; d++) {
          const diaStr = String(d).padStart(2, '0');
          const dataIso = `${anoMes}-${diaStr}`;
          const dateObj = new Date(`${dataIso}T00:00:00`);
          const diaSemana = dateObj.getDay(); // 0: Dom, 1: Seg, ..., 6: SÃ¡b

          let ehUtilEscala = false;
          if (col.escala.includes('5x2')) {
            ehUtilEscala = (diaSemana !== 0 && diaSemana !== 6);
          } else if (col.escala.includes('6x1')) {
            ehUtilEscala = (diaSemana !== 0);
          } else if (col.escala.includes('12x36')) {
            ehUtilEscala = (step12x36 % 2 === 0);
            step12x36++;
          } else {
            ehUtilEscala = (diaSemana !== 0 && diaSemana !== 6);
          }

          const estaNoPeriodo = (dataIso >= defaultInicio && dataIso <= defaultFim);
          const ehFalta = faltasSet.has(dataIso);

          let ativo = false;
          if (customDiasSet !== null) {
            ativo = customDiasSet.has(dataIso);
          } else {
            ativo = estaNoPeriodo && ehUtilEscala && !ehFalta;
          }

          diasCalendario.push({
            data: dataIso,
            dia: d,
            dia_semana: diaSemana,
            eh_util_escala: ehUtilEscala,
            esta_no_periodo: estaNoPeriodo,
            eh_falta: ehFalta,
            ativo: ativo
          });
        }

        const diasAtivosCalculados = diasCalendario.filter(d => d.ativo).length;

        const valorPassagemBase = col.valor_passagem_unitaria !== null && col.valor_passagem_unitaria !== undefined ? Number(col.valor_passagem_unitaria) : 4.40;
        const qtdPassagensBase = col.quantidade_passagens_dia !== null && col.quantidade_passagens_dia !== undefined ? Number(col.quantidade_passagens_dia) : 2;
        const diariaVABase = col.valor_diario_va !== null && col.valor_diario_va !== undefined ? Number(col.valor_diario_va) : 28.00;

        const dadosBeneficio = {
          customizado: !!(custom && custom.customizado),
          data_inicio_beneficio: custom?.data_inicio_beneficio || defaultInicio,
          data_fim_beneficio: custom?.data_fim_beneficio || defaultFim,
          dias_vt: custom?.dias_vt !== null && custom?.dias_vt !== undefined ? custom.dias_vt : diasAtivosCalculados,
          dias_va: custom?.dias_va !== null && custom?.dias_va !== undefined ? custom.dias_va : diasAtivosCalculados,
          tarifa_vt: custom?.tarifa_vt !== null && custom?.tarifa_vt !== undefined ? Number(custom.tarifa_vt) : valorPassagemBase,
          passagens_dia: custom?.passagens_dia !== null && custom?.passagens_dia !== undefined ? Number(custom.passagens_dia) : qtdPassagensBase,
          diaria_va: custom?.diaria_va !== null && custom?.diaria_va !== undefined ? Number(custom.diaria_va) : diariaVABase,
          faltas_descontadas: custom?.faltas_descontadas !== null && custom?.faltas_descontadas !== undefined ? Number(custom.faltas_descontadas) : faltasSet.size,
          observacoes: custom?.observacoes || ''
        };

        return jsonResponse(res, {
          colaborador: {
            id: col.id,
            nome: col.nome,
            cpf: col.cpf,
            escala: col.escala,
            data_admissao: col.data_admissao,
            data_demissao: col.data_demissao,
            status_colaborador: col.status_colaborador,
            cliente_nome: col.cliente_nome || 'Geral',
            nome_posto: col.nome_posto || 'Posto PadrÃ£o',
            linhas_onibus: col.linhas_onibus || 'Municipal'
          },
          ano_mes: anoMes,
          data_inicio_mes: dataInicioMes,
          data_fim_mes: dataFimMes,
          default_inicio: defaultInicio,
          default_fim: defaultFim,
          eh_proporcional: (defaultInicio !== dataInicioMes || defaultFim !== dataFimMes),
          faltas_registradas: Array.from(faltasSet),
          dias_calendario: diasCalendario,
          beneficio: dadosBeneficio
        });
      }

      // Salvar customizaÃ§Ã£o de benefÃ­cios do colaborador
      if (pathname.startsWith('/api/beneficios/colaborador/') && method === 'POST') {
        const colabId = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        if (!body.ano_mes) return errorResponse(res, 'MÃªs de competÃªncia (ano_mes) Ã© obrigatÃ³rio', 400);

        const stmt = db.prepare(`
          INSERT INTO beneficios_colaborador_mes (
            ano_mes, colaborador_id, data_inicio_beneficio, data_fim_beneficio,
            dias_vt, dias_va, tarifa_vt, passagens_dia, diaria_va,
            faltas_descontadas, dias_selecionados_json, observacoes, customizado, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(ano_mes, colaborador_id) DO UPDATE SET
            data_inicio_beneficio = excluded.data_inicio_beneficio,
            data_fim_beneficio = excluded.data_fim_beneficio,
            dias_vt = excluded.dias_vt,
            dias_va = excluded.dias_va,
            tarifa_vt = excluded.tarifa_vt,
            passagens_dia = excluded.passagens_dia,
            diaria_va = excluded.diaria_va,
            faltas_descontadas = excluded.faltas_descontadas,
            dias_selecionados_json = excluded.dias_selecionados_json,
            observacoes = excluded.observacoes,
            customizado = 1,
            updated_at = CURRENT_TIMESTAMP
        `);

        stmt.run(
          body.ano_mes,
          colabId,
          body.data_inicio_beneficio || null,
          body.data_fim_beneficio || null,
          parseInt(body.dias_vt, 10) || 0,
          parseInt(body.dias_va, 10) || 0,
          parseFloat(body.tarifa_vt) || 0,
          parseInt(body.passagens_dia, 10) || 0,
          parseFloat(body.diaria_va) || 0,
          parseInt(body.faltas_descontadas, 10) || 0,
          body.dias_selecionados_json ? (typeof body.dias_selecionados_json === 'string' ? body.dias_selecionados_json : JSON.stringify(body.dias_selecionados_json)) : null,
          body.observacoes || ''
        );

        return jsonResponse(res, { success: true, message: 'BenefÃ­cio atualizado com sucesso!' });
      }

      // Restaurar padrÃ£o do sistema para colaborador
      if (pathname.startsWith('/api/beneficios/colaborador/') && method === 'DELETE') {
        const colabId = parseInt(pathname.split('/')[4], 10);
        const anoMes = query.ano_mes;

        if (!anoMes) return errorResponse(res, 'ParÃ¢metro ano_mes Ã© obrigatÃ³rio', 400);

        db.prepare(`
          DELETE FROM beneficios_colaborador_mes
          WHERE colaborador_id = ? AND ano_mes = ?
        `).run(colabId, anoMes);

        return jsonResponse(res, { success: true, message: 'PadrÃ£o do sistema restaurado para este colaborador!' });
      }

      if (pathname === '/api/beneficios/config-mes' && method === 'POST') {
        const body = await parseRequestBody(req);
        db.prepare(`
          INSERT INTO beneficios_config_mes (ano_mes, dias_uteis_5x2, dias_uteis_6x1, dias_uteis_12x36, observacoes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(ano_mes) DO UPDATE SET
            dias_uteis_5x2 = excluded.dias_uteis_5x2,
            dias_uteis_6x1 = excluded.dias_uteis_6x1,
            dias_uteis_12x36 = excluded.dias_uteis_12x36
        `).run(
          body.ano_mes,
          parseInt(body.dias_uteis_5x2, 10) || 22,
          parseInt(body.dias_uteis_6x1, 10) || 26,
          parseInt(body.dias_uteis_12x36, 10) || 15,
          body.observacoes || ''
        );
        return jsonResponse(res, { success: true });
      }

      // CONCESSÃƒO COLETIVA DE BENEFÃCIOS EM LOTE (POR ESCALA, CLIENTE OU CALENDÃRIO)
      if (pathname === '/api/beneficios/concessao-lote' && method === 'POST') {
        const body = await parseRequestBody(req);
        const {
          ano_mes,
          colaborador_ids,
          data_inicio,
          data_fim,
          dias_modo, // 'calendario' ou 'fixo'
          dias_vt_fixo,
          dias_va_fixo,
          espelhar_valores_cadastrados = true,
          tarifa_vt_personalizada,
          passagens_dia_personalizada,
          diaria_va_personalizada,
          descontar_faltas = true,
          observacoes = ''
        } = body;

        if (!ano_mes) return errorResponse(res, 'MÃªs de competÃªncia (ano_mes) Ã© obrigatÃ³rio', 400);
        if (!Array.isArray(colaborador_ids) || colaborador_ids.length === 0) {
          return errorResponse(res, 'Nenhum colaborador selecionado para a concessÃ£o em lote', 400);
        }

        const stmtUpsert = db.prepare(`
          INSERT INTO beneficios_colaborador_mes (
            ano_mes, colaborador_id, data_inicio_beneficio, data_fim_beneficio,
            dias_vt, dias_va, tarifa_vt, passagens_dia, diaria_va,
            faltas_descontadas, observacoes, customizado, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(ano_mes, colaborador_id) DO UPDATE SET
            data_inicio_beneficio = excluded.data_inicio_beneficio,
            data_fim_beneficio = excluded.data_fim_beneficio,
            dias_vt = excluded.dias_vt,
            dias_va = excluded.dias_va,
            tarifa_vt = excluded.tarifa_vt,
            passagens_dia = excluded.passagens_dia,
            diaria_va = excluded.diaria_va,
            faltas_descontadas = excluded.faltas_descontadas,
            observacoes = excluded.observacoes,
            customizado = 1,
            updated_at = CURRENT_TIMESTAMP
        `);

        let processados = 0;
        let totalValorVT = 0;
        let totalValorVA = 0;

        for (const cid of colaborador_ids) {
          const col = db.prepare('SELECT * FROM colaboradores WHERE id = ?').get(cid);
          if (!col) continue;

          let diasCalculados = 0;
          if (dias_modo === 'fixo') {
            diasCalculados = parseInt(dias_vt_fixo, 10) || 0;
          } else {
            // Modo calendÃ¡rio (Dia X ao Dia Y) conforme a escala de cada colaborador
            diasCalculados = calcularDiasUteisPeriodo(data_inicio, data_fim, col.escala || '5x2');
          }

          let faltasCount = 0;
          if (descontar_faltas) {
            let sqlFaltas = 'SELECT COUNT(*) as count FROM faltas_coberturas WHERE colaborador_id = ?';
            const paramsFaltas = [cid];
            if (data_inicio && data_fim) {
              sqlFaltas += ' AND data_falta >= ? AND data_falta <= ?';
              paramsFaltas.push(data_inicio, data_fim);
            } else {
              sqlFaltas += " AND strftime('%Y-%m', data_falta) = ?";
              paramsFaltas.push(ano_mes);
            }
            faltasCount = db.prepare(sqlFaltas).get(...paramsFaltas).count;
          }

          const diasEfetivosVT = Math.max(0, (dias_modo === 'fixo' ? (parseInt(dias_vt_fixo, 10) || 0) : diasCalculados) - faltasCount);
          const diasEfetivosVA = Math.max(0, (dias_modo === 'fixo' ? (parseInt(dias_va_fixo, 10) || 0) : diasCalculados) - faltasCount);

          let tarifaVT = col.valor_passagem_unitaria !== null && col.valor_passagem_unitaria !== undefined ? Number(col.valor_passagem_unitaria) : 4.40;
          let passagensDia = col.quantidade_passagens_dia !== null && col.quantidade_passagens_dia !== undefined ? Number(col.quantidade_passagens_dia) : 2;
          let diariaVA = col.valor_diario_va !== null && col.valor_diario_va !== undefined ? Number(col.valor_diario_va) : 28.00;

          if (!espelhar_valores_cadastrados) {
            if (tarifa_vt_personalizada !== undefined && tarifa_vt_personalizada !== '') tarifaVT = parseFloat(tarifa_vt_personalizada) || 0;
            if (passagens_dia_personalizada !== undefined && passagens_dia_personalizada !== '') passagensDia = parseInt(passagens_dia_personalizada, 10) || 0;
            if (diaria_va_personalizada !== undefined && diaria_va_personalizada !== '') diariaVA = parseFloat(diaria_va_personalizada) || 0;
          }

          const obsTexto = observacoes || `ConcessÃ£o coletiva em lote (${data_inicio || ''} a ${data_fim || ''})`;

          stmtUpsert.run(
            ano_mes,
            cid,
            data_inicio || null,
            data_fim || null,
            diasEfetivosVT,
            diasEfetivosVA,
            tarifaVT,
            passagensDia,
            diariaVA,
            faltasCount,
            obsTexto
          );

          totalValorVT += (diasEfetivosVT * passagensDia * tarifaVT);
          totalValorVA += (diasEfetivosVA * diariaVA);
          processados++;
        }

        return jsonResponse(res, {
          success: true,
          count: processados,
          total_vt: totalValorVT,
          total_va: totalValorVA,
          total_geral: totalValorVT + totalValorVA,
          message: `ConcessÃ£o coletiva aplicada com sucesso para ${processados} colaborador(es)!`
        });
      }

      // 7.1 REAJUSTE EM MASSA DO VALE ALIMENTAÃ‡ÃƒO (VA)
      if (pathname === '/api/beneficios/reajuste-massa-va' && method === 'POST') {
        const body = await parseRequestBody(req);
        const novoValor = parseFloat(body.novo_valor_diario_va);
        if (isNaN(novoValor) || novoValor <= 0) {
          return errorResponse(res, 'Novo valor diÃ¡rio de VA deve ser um nÃºmero vÃ¡lido maior que zero.', 400);
        }

        const escopo = body.escopo || 'todos'; // 'todos', 'setor', 'cliente', 'cargo', 'selecionados'
        let sql = 'SELECT id, nome, valor_diario_va, posto_trabalho_id, cliente_id FROM colaboradores WHERE ativo = 1';
        const params = [];

        if (escopo === 'setor' && body.posto_trabalho_id) {
          sql += ' AND posto_trabalho_id = ?';
          params.push(parseInt(body.posto_trabalho_id, 10));
        } else if (escopo === 'cliente' && body.cliente_id) {
          sql += ' AND cliente_id = ?';
          params.push(parseInt(body.cliente_id, 10));
        } else if (escopo === 'cargo' && body.cargo_id) {
          sql += ' AND cargo_id = ?';
          params.push(parseInt(body.cargo_id, 10));
        } else if (escopo === 'selecionados' && Array.isArray(body.colaboradores_ids) && body.colaboradores_ids.length > 0) {
          const placeholders = body.colaboradores_ids.map(() => '?').join(',');
          sql += ` AND id IN (${placeholders})`;
          params.push(...body.colaboradores_ids.map(Number));
        }

        const colaboradoresAlvo = db.prepare(sql).all(...params);
        if (colaboradoresAlvo.length === 0) {
          return errorResponse(res, 'Nenhum colaborador ativo encontrado para o escopo selecionado.', 404);
        }

        const stmtUpdateColab = db.prepare('UPDATE colaboradores SET valor_diario_va = ? WHERE id = ?');
        const stmtUpdateMes = db.prepare('UPDATE beneficios_colaborador_mes SET diaria_va = ?, updated_at = CURRENT_TIMESTAMP WHERE colaborador_id = ? AND ano_mes = ?');
        const anoMes = body.ano_mes || new Date().toISOString().slice(0, 7);
        const atualizarFolhaMes = !!body.atualizar_folha_mes;

        let atualizados = 0;
        const hojeIso = new Date().toISOString().split('T')[0];

        for (const c of colaboradoresAlvo) {
          const valorAnterior = Number(c.valor_diario_va || 0);
          stmtUpdateColab.run(novoValor, c.id);

          if (atualizarFolhaMes) {
            stmtUpdateMes.run(novoValor, c.id, anoMes);
          }

          try {
            registrarEventoHistoricoColaborador(
              c.id,
              'ALTERACAO_BENEFICIO',
              'Reajuste em Massa do Vale AlimentaÃ§Ã£o (VA)',
              `Valor da diÃ¡ria de alimentaÃ§Ã£o reajustado de R$ ${valorAnterior.toFixed(2)} para R$ ${novoValor.toFixed(2)} (Escopo: ${escopo}).`,
              hojeIso
            );
          } catch (eH) {}

          atualizados++;
        }

        return jsonResponse(res, {
          success: true,
          count: atualizados,
          novo_valor: novoValor,
          folha_atualizada: atualizarFolhaMes,
          message: `Reajuste em massa de VA concluÃ­do com sucesso para ${atualizados} colaborador(es)! Novo valor: R$ ${novoValor.toFixed(2)}/dia.`
        });
      }

      // 7.2 REAJUSTE EM MASSA DO VALE TRANSPORTE (VT) - SELECIONANDO SETOR POR SETOR
      if (pathname === '/api/beneficios/reajuste-massa-vt' && method === 'POST') {
        const body = await parseRequestBody(req);
        const tipoReajuste = body.tipo_reajuste || 'tarifa_unitaria'; // 'tarifa_unitaria' ou 'valor_diario_fixo'
        const novaTarifa = parseFloat(body.nova_tarifa);
        const novoValorDiario = parseFloat(body.novo_valor_diario);

        if (tipoReajuste === 'tarifa_unitaria' && (isNaN(novaTarifa) || novaTarifa <= 0)) {
          return errorResponse(res, 'Informe uma tarifa unitÃ¡ria de transporte vÃ¡lida maior que zero.', 400);
        }
        if (tipoReajuste === 'valor_diario_fixo' && (isNaN(novoValorDiario) || novoValorDiario <= 0)) {
          return errorResponse(res, 'Informe um valor diÃ¡rio fixo de transporte vÃ¡lido maior que zero.', 400);
        }

        const escopo = body.escopo || 'setor'; // padrÃ£o: setor por setor
        let sql = `
          SELECT id, nome, valor_passagem_unitaria, quantidade_passagens_dia,
                 linhas_transporte_json, total_diario_vt, linhas_onibus, posto_trabalho_id, cliente_id
          FROM colaboradores
          WHERE ativo = 1
        `;
        const params = [];

        if (escopo === 'setor' && body.posto_trabalho_id) {
          sql += ' AND posto_trabalho_id = ?';
          params.push(parseInt(body.posto_trabalho_id, 10));
        } else if (escopo === 'cliente' && body.cliente_id) {
          sql += ' AND cliente_id = ?';
          params.push(parseInt(body.cliente_id, 10));
        } else if (escopo === 'selecionados' && Array.isArray(body.colaboradores_ids) && body.colaboradores_ids.length > 0) {
          const placeholders = body.colaboradores_ids.map(() => '?').join(',');
          sql += ` AND id IN (${placeholders})`;
          params.push(...body.colaboradores_ids.map(Number));
        }

        const colaboradoresAlvo = db.prepare(sql).all(...params);
        if (colaboradoresAlvo.length === 0) {
          return errorResponse(res, 'Nenhum colaborador ativo encontrado no setor/escopo selecionado.', 404);
        }

        const anoMes = body.ano_mes || new Date().toISOString().slice(0, 7);
        const atualizarFolhaMes = !!body.atualizar_folha_mes;
        const hojeIso = new Date().toISOString().split('T')[0];
        let atualizados = 0;

        const stmtUpdateColab = db.prepare(`
          UPDATE colaboradores
          SET valor_passagem_unitaria = ?,
              total_diario_vt = ?,
              linhas_transporte_json = ?,
              linhas_onibus = ?
          WHERE id = ?
        `);

        const stmtUpdateMes = db.prepare(`
          UPDATE beneficios_colaborador_mes
          SET tarifa_vt = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE colaborador_id = ? AND ano_mes = ?
        `);

        for (const c of colaboradoresAlvo) {
          let linhas = [];
          if (c.linhas_transporte_json) {
            try {
              linhas = typeof c.linhas_transporte_json === 'string' ? JSON.parse(c.linhas_transporte_json) : c.linhas_transporte_json;
            } catch (e) {
              linhas = [];
            }
          }

          let finalTarifa = c.valor_passagem_unitaria || 4.40;
          let finalTotalDiario = c.total_diario_vt || 0;
          let resumoLinhas = c.linhas_onibus || '';

          if (tipoReajuste === 'tarifa_unitaria') {
            finalTarifa = novaTarifa;
            if (Array.isArray(linhas) && linhas.length > 0) {
              let soma = 0;
              const partes = [];
              linhas = linhas.map(l => {
                const totalViagens = (Number(l.qtd_ida) || 1) + (Number(l.qtd_volta) || 1);
                const sub = Math.round(totalViagens * novaTarifa * 100) / 100;
                soma += sub;
                partes.push(`${l.nome_linha || 'Linha'} (${totalViagens}x R$ ${novaTarifa.toFixed(2)})`);
                return {
                  ...l,
                  tarifa: novaTarifa,
                  total_diario: sub
                };
              });
              finalTotalDiario = Math.round(soma * 100) / 100;
              resumoLinhas = partes.join(' + ');
            } else {
              const qtd = c.quantidade_passagens_dia || 2;
              finalTotalDiario = Math.round(qtd * novaTarifa * 100) / 100;
              resumoLinhas = `Municipal (${qtd}x R$ ${novaTarifa.toFixed(2)})`;
            }
          } else {
            // Valor diÃ¡rio fixo
            finalTotalDiario = novoValorDiario;
            const qtd = c.quantidade_passagens_dia || 2;
            if (qtd > 0) {
              finalTarifa = Math.round((novoValorDiario / qtd) * 100) / 100;
            }
          }

          stmtUpdateColab.run(
            finalTarifa,
            finalTotalDiario,
            JSON.stringify(linhas || []),
            resumoLinhas,
            c.id
          );

          if (atualizarFolhaMes) {
            stmtUpdateMes.run(finalTarifa, c.id, anoMes);
          }

          try {
            registrarEventoHistoricoColaborador(
              c.id,
              'ALTERACAO_BENEFICIO',
              'Reajuste em Massa do Vale Transporte (VT)',
              `VT reajustado no setor. Nova tarifa: R$ ${finalTarifa.toFixed(2)} | Novo custo diÃ¡rio: R$ ${finalTotalDiario.toFixed(2)}.`,
              hojeIso
            );
          } catch (eH) {}

          atualizados++;
        }

        return jsonResponse(res, {
          success: true,
          count: atualizados,
          folha_atualizada: atualizarFolhaMes,
          message: `Reajuste em massa de VT concluÃ­do com sucesso para ${atualizados} colaborador(es) do setor!`
        });
      }


      // -----------------------------------------------------------
      // 8. COMPRAS: ORÃ‡AMENTOS, CONDIÃ‡Ã•ES DE PAGAMENTO & APROVAÃ‡ÃƒO
      // -----------------------------------------------------------
      if (pathname === '/api/compras/orcamentos' && method === 'GET') {
        const mes = query.ano_mes;
        const forma = query.forma_pagamento;
        const condicao = query.condicao_pagamento;
        const statusAprov = query.status_aprovacao;
        const statusFinan = query.status_financeiro;

        let sql = `
          SELECT po.*,
                 f.nome_empresa as fornecedor_nome,
                 f.tipo_fornecedor,
                 f.chave_pix as fornecedor_chave_pix,
                 f.dados_bancarios as fornecedor_dados_bancarios,
                 c.nome_fantasia as cliente_nome,
                 c.nome_razao_social as cliente_razao_social,
                 c.cnpj as cliente_cnpj
          FROM pedidos_orcamentos_compras po
          LEFT JOIN fornecedores f ON po.fornecedor_id = f.id
          LEFT JOIN clientes c ON po.cliente_id = c.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];
        if (mes && mes !== 'todos') {
          sql += ' AND po.ano_mes = ? ';
          params.push(mes);
        }
        if (forma && forma !== 'todos') {
          sql += ' AND po.forma_pagamento = ? ';
          params.push(forma);
        }
        if (condicao && condicao !== 'todos') {
          sql += ' AND po.condicao_pagamento = ? ';
          params.push(condicao);
        }
        if (statusAprov && statusAprov !== 'todos') {
          sql += ' AND po.status_aprovacao = ? ';
          params.push(statusAprov);
        }
        if (statusFinan && statusFinan !== 'todos') {
          sql += ' AND po.status_financeiro = ? ';
          params.push(statusFinan);
        }
        sql += ' ORDER BY po.created_at DESC ';
        const orcamentos = db.prepare(sql).all(...params);

        // Anexar parcelas de contas_pagar para cada pedido
        for (const o of orcamentos) {
          o.parcelas = db.prepare('SELECT * FROM contas_pagar WHERE origem_id = ? ORDER BY parcela_numero ASC').all(o.id);
        }
        return jsonResponse(res, orcamentos);
      }

      // CONSULTAR PEDIDO / ORÃ‡AMENTO INDIVIDUAL COMPLETO
      if (pathname.match(/^\/api\/compras\/orcamentos\/\d+$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[4], 10);
        const orc = db.prepare(`
          SELECT po.*,
                 f.nome_empresa as fornecedor_nome,
                 f.cnpj as fornecedor_cnpj,
                 f.contato as fornecedor_contato,
                 f.telefone as fornecedor_telefone,
                 f.email as fornecedor_email,
                 f.chave_pix as fornecedor_chave_pix,
                 f.dados_bancarios as fornecedor_dados_bancarios,
                 c.nome_fantasia as cliente_nome,
                 c.nome_razao_social as cliente_razao_social,
                 c.cnpj as cliente_cnpj
          FROM pedidos_orcamentos_compras po
          LEFT JOIN fornecedores f ON po.fornecedor_id = f.id
          LEFT JOIN clientes c ON po.cliente_id = c.id
          WHERE po.id = ?
        `).get(id);
        if (!orc) return errorResponse(res, 'OrÃ§amento / Pedido nÃ£o encontrado', 404);
        orc.parcelas = db.prepare('SELECT *, origem_id as pedido_compra_id, parcela_numero as numero_parcela FROM contas_pagar WHERE origem_id = ? ORDER BY parcela_numero ASC').all(id);
        return jsonResponse(res, orc);
      }

      if (pathname === '/api/compras/orcamentos' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.titulo_orcamento || !body.categoria_compra || body.valor_total === undefined) {
          return errorResponse(res, 'TÃ­tulo, Categoria e Valor Total sÃ£o obrigatÃ³rios', 400);
        }

        const stmt = db.prepare(`
          INSERT INTO pedidos_orcamentos_compras (
            ano_mes, categoria_compra, fornecedor_id, cliente_id, titulo_orcamento,
            valor_total, status_aprovacao, detalhes_itens,
            condicao_pagamento, prazo_restante_dias, valor_adiantamento, data_adiantamento,
            valor_restante, data_vencimento_restante, parcelas_json, forma_pagamento,
            dados_pagamento, status_financeiro
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const resOrc = stmt.run(
          body.ano_mes || new Date().toISOString().slice(0, 7),
          body.categoria_compra,
          body.fornecedor_id ? parseInt(body.fornecedor_id, 10) : null,
          body.cliente_id ? parseInt(body.cliente_id, 10) : null,
          body.titulo_orcamento,
          parseFloat(body.valor_total) || 0,
          'Aguardando AprovaÃ§Ã£o Diretoria/Admin',
          body.detalhes_itens || '',
          body.condicao_pagamento || 'adiantamento_prazo',
          body.prazo_restante_dias ? parseInt(body.prazo_restante_dias, 10) : 30,
          body.valor_adiantamento !== undefined ? parseFloat(body.valor_adiantamento) : 0,
          body.data_adiantamento || new Date().toISOString().slice(0, 10),
          body.valor_restante !== undefined ? parseFloat(body.valor_restante) : 0,
          body.data_vencimento_restante || null,
          body.parcelas_json ? (typeof body.parcelas_json === 'string' ? body.parcelas_json : JSON.stringify(body.parcelas_json)) : null,
          body.forma_pagamento || 'PIX',
          body.dados_pagamento || '',
          'Pendente'
        );

        const newId = resOrc.lastInsertRowid;
        sincronizarContasPagarDoPedido(newId);

        return jsonResponse(res, { success: true, id: newId });
      }

      // ATUALIZAR CONDIÃ‡Ã•ES DE PAGAMENTO DE PEDIDO EXISTENTE
      if (pathname.match(/^\/api\/compras\/orcamentos\/\d+\/condicoes-pagamento$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        db.prepare(`
          UPDATE pedidos_orcamentos_compras SET
            condicao_pagamento = ?,
            prazo_restante_dias = ?,
            valor_adiantamento = ?,
            data_adiantamento = ?,
            valor_restante = ?,
            data_vencimento_restante = ?,
            parcelas_json = ?,
            forma_pagamento = ?,
            dados_pagamento = ?
          WHERE id = ?
        `).run(
          body.condicao_pagamento || 'adiantamento_prazo',
          body.prazo_restante_dias ? parseInt(body.prazo_restante_dias, 10) : 30,
          body.valor_adiantamento !== undefined ? parseFloat(body.valor_adiantamento) : 0,
          body.data_adiantamento || null,
          body.valor_restante !== undefined ? parseFloat(body.valor_restante) : 0,
          body.data_vencimento_restante || null,
          body.parcelas_json ? (typeof body.parcelas_json === 'string' ? body.parcelas_json : JSON.stringify(body.parcelas_json)) : null,
          body.forma_pagamento || 'PIX',
          body.dados_pagamento || '',
          id
        );

        sincronizarContasPagarDoPedido(id);

        return jsonResponse(res, { success: true, message: 'CondiÃ§Ãµes de pagamento atualizadas com sucesso!' });
      }

      // APROVAR ORÃ‡AMENTO (DIRETORIA / ADMINISTRADOR)
      if (pathname.startsWith('/api/compras/orcamentos/') && pathname.endsWith('/autorizar') && method === 'POST') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        db.prepare(`
          UPDATE pedidos_orcamentos_compras SET
            status_aprovacao = 'Aprovado',
            autorizado_por_nome = ?,
            autorizado_por_usuario_id = ?,
            data_autorizacao = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(body.usuario_nome || 'Diretoria Executiva', body.usuario_id || 1, id);

        // Garantir que as parcelas existam no financeiro
        sincronizarContasPagarDoPedido(id);

        return jsonResponse(res, { success: true });
      }

      // REJEITAR ORÃ‡AMENTO
      if (pathname.startsWith('/api/compras/orcamentos/') && pathname.endsWith('/rejeitar') && method === 'POST') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        db.prepare(`
          UPDATE pedidos_orcamentos_compras SET
            status_aprovacao = 'Rejeitado',
            motivo_rejeicao = ?,
            autorizado_por_nome = ?,
            data_autorizacao = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(body.motivo_rejeicao || 'NÃ£o autorizado', body.usuario_nome || 'Diretoria', id);

        // Remover parcelas pendentes do financeiro
        db.prepare(`DELETE FROM contas_pagar WHERE origem_id = ? AND status != 'Pago'`).run(id);

        return jsonResponse(res, { success: true });
      }

      // -----------------------------------------------------------
      // 8.1. FINANCEIRO: CONTAS A PAGAR & CRONOGRAMA DE VENCIMENTOS
      // -----------------------------------------------------------
      if (pathname === '/api/financeiro/contas-pagar' && method === 'GET') {
        const mes = query.ano_mes; // 'YYYY-MM' ou 'todos'
        const statusFiltro = query.status; // 'todos', 'pendente', 'pago', 'vencido', 'hoje', 'proximos_7_dias'
        const forma = query.forma_pagamento;
        const fornecedorId = query.fornecedor_id;
        const busca = (query.busca || '').trim().toLowerCase();

        let sql = `
          SELECT cp.*,
                 cp.origem_id as pedido_compra_id,
                 cp.parcela_numero as numero_parcela,
                 po.titulo_orcamento as pedido_titulo,
                 po.status_aprovacao as pedido_status_aprovacao,
                 f.chave_pix as fornecedor_pix,
                 f.dados_bancarios as fornecedor_banco,
                 f.telefone as fornecedor_telefone
          FROM contas_pagar cp
          LEFT JOIN pedidos_orcamentos_compras po ON cp.origem_id = po.id
          LEFT JOIN fornecedores f ON cp.fornecedor_id = f.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];

        if (mes && mes !== 'todos') {
          sql += " AND strftime('%Y-%m', cp.data_vencimento) = ? ";
          params.push(mes);
        }

        if (statusFiltro === 'pendente') {
          sql += " AND cp.status = 'Pendente' ";
        } else if (statusFiltro === 'pago') {
          sql += " AND cp.status = 'Pago' ";
        } else if (statusFiltro === 'vencido') {
          sql += " AND cp.status = 'Pendente' AND cp.data_vencimento < date('now', 'localtime') ";
        } else if (statusFiltro === 'hoje') {
          sql += " AND cp.status = 'Pendente' AND cp.data_vencimento = date('now', 'localtime') ";
        } else if (statusFiltro === 'proximos_7_dias') {
          sql += " AND cp.status = 'Pendente' AND cp.data_vencimento >= date('now', 'localtime') AND cp.data_vencimento <= date('now', 'localtime', '+7 days') ";
        }

        if (forma && forma !== 'todos') {
          sql += " AND cp.forma_pagamento = ? ";
          params.push(forma);
        }

        if (fornecedorId && fornecedorId !== 'todos') {
          sql += " AND cp.fornecedor_id = ? ";
          params.push(parseInt(fornecedorId, 10));
        }

        if (busca) {
          sql += " AND (LOWER(cp.descricao) LIKE ? OR LOWER(cp.fornecedor_nome) LIKE ? OR LOWER(COALESCE(cp.dados_pagamento, '')) LIKE ? OR LOWER(COALESCE(po.titulo_orcamento, '')) LIKE ?) ";
          const term = `%${busca}%`;
          params.push(term, term, term, term);
        }

        sql += " ORDER BY cp.data_vencimento ASC, cp.id ASC ";
        const contas = db.prepare(sql).all(...params);

        // Calcular KPIs em tempo real
        let kpiSql = `
          SELECT
            COALESCE(SUM(CASE WHEN status = 'Pendente' AND data_vencimento < date('now', 'localtime') THEN valor ELSE 0 END), 0) as total_vencido,
            COUNT(CASE WHEN status = 'Pendente' AND data_vencimento < date('now', 'localtime') THEN 1 END) as qtd_vencido,

            COALESCE(SUM(CASE WHEN status = 'Pendente' AND data_vencimento = date('now', 'localtime') THEN valor ELSE 0 END), 0) as total_hoje,
            COUNT(CASE WHEN status = 'Pendente' AND data_vencimento = date('now', 'localtime') THEN 1 END) as qtd_hoje,

            COALESCE(SUM(CASE WHEN status = 'Pendente' AND data_vencimento >= date('now', 'localtime') AND data_vencimento <= date('now', 'localtime', '+7 days') THEN valor ELSE 0 END), 0) as total_proximos_7_dias,
            COUNT(CASE WHEN status = 'Pendente' AND data_vencimento >= date('now', 'localtime') AND data_vencimento <= date('now', 'localtime', '+7 days') THEN 1 END) as qtd_proximos_7_dias,

            COALESCE(SUM(CASE WHEN ${mes && mes !== 'todos' ? "strftime('%Y-%m', data_vencimento) = '" + mes + "'" : "1=1"} THEN valor ELSE 0 END), 0) as total_mes,
            COALESCE(SUM(CASE WHEN status = 'Pago' AND ${mes && mes !== 'todos' ? "(strftime('%Y-%m', data_pagamento) = '" + mes + "' OR strftime('%Y-%m', data_vencimento) = '" + mes + "')" : "1=1"} THEN valor ELSE 0 END), 0) as total_pago_mes,
            COALESCE(SUM(CASE WHEN status = 'Pendente' AND ${mes && mes !== 'todos' ? "strftime('%Y-%m', data_vencimento) = '" + mes + "'" : "1=1"} THEN valor ELSE 0 END), 0) as total_pendente_mes,
            COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as total_qtd_pendente
          FROM contas_pagar
        `;
        const kpis = db.prepare(kpiSql).get();

        return jsonResponse(res, { contas, kpis, mes_referencia: mes || 'todos' });
      }

      // BAIXA / REGISTRAR PAGAMENTO DE CONTA
      if (pathname.match(/^\/api\/financeiro\/contas-pagar\/\d+\/pagar$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        const conta = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id);
        if (!conta) return errorResponse(res, 'Conta a pagar nÃ£o encontrada', 404);

        const dataPag = body.data_pagamento || new Date().toISOString();
        const pagoPorNome = body.usuario_nome || 'Financeiro';
        const pagoPorId = body.usuario_id || 1;
        const comprovante = body.comprovante_ref || '';
        const obs = body.observacoes || '';

        db.prepare(`
          UPDATE contas_pagar SET
            status = 'Pago',
            data_pagamento = ?,
            pago_por_nome = ?,
            pago_por_id = ?,
            comprovante_ref = ?,
            observacoes = ?
          WHERE id = ?
        `).run(dataPag, pagoPorNome, pagoPorId, comprovante, obs, id);

        if (conta.origem_id) {
          atualizarStatusFinanceiroDoPedido(conta.origem_id);
        }

        return jsonResponse(res, { success: true, message: 'Pagamento registrado com sucesso!' });
      }

      // ESTORNAR / DESFAZER PAGAMENTO DE CONTA
      if (pathname.match(/^\/api\/financeiro\/contas-pagar\/\d+\/estornar$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[4], 10);
        const conta = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id);
        if (!conta) return errorResponse(res, 'Conta a pagar nÃ£o encontrada', 404);

        db.prepare(`
          UPDATE contas_pagar SET
            status = 'Pendente',
            data_pagamento = null,
            pago_por_nome = null,
            pago_por_id = null,
            comprovante_ref = null
          WHERE id = ?
        `).run(id);

        if (conta.origem_id) {
          atualizarStatusFinanceiroDoPedido(conta.origem_id);
        }

        return jsonResponse(res, { success: true, message: 'Pagamento estornado com sucesso!' });
      }

      // CADASTRO DE CONTA A PAGAR AVULSA
      if (pathname === '/api/financeiro/contas-pagar' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.descricao || !body.valor || !body.data_vencimento) {
          return errorResponse(res, 'DescriÃ§Ã£o, Valor e Data de Vencimento sÃ£o obrigatÃ³rios', 400);
        }

        const resIns = db.prepare(`
          INSERT INTO contas_pagar (
            origem_tipo, fornecedor_id, fornecedor_nome, descricao, categoria,
            parcela_numero, total_parcelas, tipo_parcela, valor, data_vencimento,
            forma_pagamento, dados_pagamento, status, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'avulso',
          body.fornecedor_id ? parseInt(body.fornecedor_id, 10) : null,
          body.fornecedor_nome || 'Diversos',
          body.descricao,
          body.categoria || 'Despesas Gerais',
          1,
          1,
          'Ãšnica',
          parseFloat(body.valor) || 0,
          body.data_vencimento,
          body.forma_pagamento || 'PIX',
          body.dados_pagamento || '',
          'Pendente',
          body.observacoes || ''
        );

        return jsonResponse(res, { success: true, id: resIns.lastInsertRowid });
      }

      // EXCLUSÃƒO DE CONTA A PAGAR AVULSA
      if (pathname.match(/^\/api\/financeiro\/contas-pagar\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[4], 10);
        const conta = db.prepare('SELECT * FROM contas_pagar WHERE id = ?').get(id);
        if (!conta) return errorResponse(res, 'Conta nÃ£o encontrada', 404);
        if (conta.origem_tipo === 'compra' && conta.origem_id) {
          return errorResponse(res, 'Contas vinculadas a pedidos de compra devem ser excluÃ­das ou alteradas no prÃ³prio pedido de compras.', 400);
        }
        db.prepare('DELETE FROM contas_pagar WHERE id = ?').run(id);
        return jsonResponse(res, { success: true });
      }

      // -----------------------------------------------------------
      // 9. IMPORTAÃ‡ÃƒO EM MASSA POR PLANILHA (.XLSX / .CSV)
      // -----------------------------------------------------------
      if (pathname === '/api/importar/clientes' && method === 'POST') {
        const { clientes } = await parseRequestBody(req);
        if (!Array.isArray(clientes) || clientes.length === 0) {
          return errorResponse(res, 'Lista de clientes invÃ¡lida', 400);
        }

        const stmt = db.prepare(`
          INSERT INTO clientes (nome_razao_social, nome_fantasia, cnpj, contato_responsavel, telefone, email, cota_mensal_insumos)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        let inseridos = 0;
        for (const c of clientes) {
          if (c.nome_razao_social) {
            stmt.run(
              c.nome_razao_social,
              c.nome_fantasia || c.nome_razao_social,
              c.cnpj || '',
              c.contato_responsavel || '',
              c.telefone || '',
              c.email || '',
              parseFloat(c.cota_mensal_insumos) || 0
            );
            inseridos++;
          }
        }

        return jsonResponse(res, { success: true, inseridos });
      }

      if (pathname === '/api/importar/colaboradores' && method === 'POST') {
        const { colaboradores } = await parseRequestBody(req);
        if (!Array.isArray(colaboradores) || colaboradores.length === 0) {
          return errorResponse(res, 'Lista de colaboradores invÃ¡lida', 400);
        }

        let inseridos = 0;
        let atualizados = 0;

        for (const col of colaboradores) {
          if (!col || !col.nome || !String(col.nome).trim()) continue;

          // 1. Resolver cargoId: aceita ID numÃ©rico ou nome da funÃ§Ã£o / cargo
          let cargoId = null;
          if (col.cargo_id !== undefined && col.cargo_id !== null && String(col.cargo_id).trim() !== '') {
            const rawCargo = String(col.cargo_id).trim();
            const cNum = parseInt(rawCargo, 10);
            if (!isNaN(cNum) && /^\d+$/.test(rawCargo)) {
              const cExists = db.prepare('SELECT id FROM cargos WHERE id = ?').get(cNum);
              if (cExists) cargoId = cExists.id;
            }
            if (!cargoId) {
              let cFound = db.prepare('SELECT id FROM cargos WHERE LOWER(TRIM(nome_cargo)) = LOWER(TRIM(?))').get(rawCargo);
              if (!cFound) {
                cFound = db.prepare('SELECT id FROM cargos WHERE LOWER(nome_cargo) LIKE LOWER(?)').get(`%${rawCargo}%`);
              }
              if (cFound) cargoId = cFound.id;
            }
          }
          if (!cargoId) {
            const defaultCargo = db.prepare('SELECT id FROM cargos ORDER BY id ASC LIMIT 1').get();
            cargoId = defaultCargo ? defaultCargo.id : 1;
          }

          // 2. Resolver clienteId: aceita ID numÃ©rico, Nome Fantasia, RazÃ£o Social ou CNPJ
          let clienteId = null;
          const rawCliVal = col.cliente_id || col.cliente || col.nome_cliente;
          if (rawCliVal !== undefined && rawCliVal !== null && String(rawCliVal).trim() !== '') {
            const rawCli = String(rawCliVal).trim();
            const cNum = parseInt(rawCli, 10);
            // Se for puramente nÃºmero ou iniciar com ID numÃ©rico
            if (!isNaN(cNum) && /^\d+$/.test(rawCli)) {
              const cliExists = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cNum);
              if (cliExists) clienteId = cliExists.id;
            }

            // Tentar por CNPJ se nÃ£o encontrou ainda
            if (!clienteId) {
              const cnpjLimpo = rawCli.replace(/\D/g, '');
              if (cnpjLimpo.length >= 8) {
                const cliCnpj = db.prepare(`
                  SELECT id FROM clientes 
                  WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), ' ', '') LIKE ?
                `).get(`%${cnpjLimpo}%`);
                if (cliCnpj) clienteId = cliCnpj.id;
              }
            }

            // Tentar por Nome Fantasia ou RazÃ£o Social
            if (!clienteId) {
              let cliFound = db.prepare(`
                SELECT id FROM clientes 
                WHERE LOWER(TRIM(nome_fantasia)) = LOWER(TRIM(?)) 
                   OR LOWER(TRIM(nome_razao_social)) = LOWER(TRIM(?))
              `).get(rawCli, rawCli);

              if (!cliFound) {
                cliFound = db.prepare(`
                  SELECT id FROM clientes 
                  WHERE LOWER(nome_fantasia) LIKE LOWER(?) 
                     OR LOWER(nome_razao_social) LIKE LOWER(?)
                `).get(`%${rawCli}%`, `%${rawCli}%`);
              }
              if (cliFound) clienteId = cliFound.id;
            }
          }

          // 3. Resolver posto_trabalho_id
          let postoTrabalhoId = null;
          const rawPostoVal = col.posto_id || col.posto_trabalho_id || col.posto || col.nome_posto;
          if (rawPostoVal !== undefined && rawPostoVal !== null && String(rawPostoVal).trim() !== '') {
            const pStr = String(rawPostoVal).trim();
            const pNum = parseInt(pStr, 10);
            if (!isNaN(pNum) && /^\d+$/.test(pStr)) {
              const pExists = db.prepare('SELECT id, cliente_id FROM postos_trabalho WHERE id = ?').get(pNum);
              if (pExists) {
                postoTrabalhoId = pExists.id;
                if (!clienteId) clienteId = pExists.cliente_id;
              }
            }
            if (!postoTrabalhoId) {
              let pFound = null;
              if (clienteId) {
                pFound = db.prepare('SELECT id, cliente_id FROM postos_trabalho WHERE cliente_id = ? AND LOWER(TRIM(nome_posto)) = LOWER(TRIM(?))').get(clienteId, pStr);
                if (!pFound) {
                  pFound = db.prepare('SELECT id, cliente_id FROM postos_trabalho WHERE cliente_id = ? AND LOWER(nome_posto) LIKE LOWER(?)').get(clienteId, `%${pStr}%`);
                }
              } else {
                pFound = db.prepare('SELECT id, cliente_id FROM postos_trabalho WHERE LOWER(TRIM(nome_posto)) = LOWER(TRIM(?))').get(pStr);
                if (!pFound) {
                  pFound = db.prepare('SELECT id, cliente_id FROM postos_trabalho WHERE LOWER(nome_posto) LIKE LOWER(?)').get(`%${pStr}%`);
                }
                if (pFound && !clienteId) clienteId = pFound.cliente_id;
              }
              if (pFound) postoTrabalhoId = pFound.id;
            }
          }

          // Se temos cliente_id mas NÃƒO temos postoTrabalhoId:
          // Vincular automaticamente ao posto do cliente para evitar que fique "sem posto fixo"
          if (clienteId && !postoTrabalhoId) {
            // Prioridade 1: Posto ativo do cliente com mesmo cargo e com vaga
            const postosCliente = db.prepare(`
              SELECT pt.id, pt.cargo_id, pt.quantidade_vagas_limite,
                     (SELECT COUNT(*) FROM colaboradores c WHERE c.posto_trabalho_id = pt.id AND c.ativo = 1) as ocupados
              FROM postos_trabalho pt
              WHERE pt.cliente_id = ? AND pt.ativo = 1 AND col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
              ORDER BY pt.id ASC
            `).all(clienteId);

            if (postosCliente.length > 0) {
              // Mesmo cargo com vaga livre
              const pComVagaMesmoCargo = postosCliente.find(p => p.cargo_id === cargoId && p.ocupados < p.quantidade_vagas_limite);
              if (pComVagaMesmoCargo) {
                postoTrabalhoId = pComVagaMesmoCargo.id;
              } else {
                // Qualquer posto do cliente com mesmo cargo
                const pMesmoCargo = postosCliente.find(p => p.cargo_id === cargoId);
                if (pMesmoCargo) {
                  postoTrabalhoId = pMesmoCargo.id;
                } else {
                  // Primeiro posto do cliente que tiver vaga
                  const pComVagaQualquer = postosCliente.find(p => p.ocupados < p.quantidade_vagas_limite);
                  if (pComVagaQualquer) {
                    postoTrabalhoId = pComVagaQualquer.id;
                  } else {
                    // Primeiro posto ativo do cliente
                    postoTrabalhoId = postosCliente[0].id;
                  }
                }
              }
            } else {
              // Cliente nÃ£o tem NENHUM posto cadastrado ainda:
              // Criar posto operacional automaticamente para o cliente!
              const cargoInfo = db.prepare('SELECT nome_cargo FROM cargos WHERE id = ?').get(cargoId);
              const nomePostoAuto = cargoInfo ? `Posto Operacional - ${cargoInfo.nome_cargo}` : 'Posto Operacional Principal';
              const novoP = db.prepare(`
                INSERT INTO postos_trabalho (cliente_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno, ativo)
                VALUES (?, ?, ?, 10, ?, 'Diurno', 1)
              `).run(clienteId, nomePostoAuto, cargoId, col.escala || '5x2');
              postoTrabalhoId = novoP.lastInsertRowid;
            }
          }

          const dataAdmFormatada = normalizarDataISO(col.data_admissao);
          const qtdPassagens = parseInt(col.quantidade_passagens_dia, 10) || 2;
          const valorVT = parseFloat(col.valor_passagem_unitaria) || 4.40;
          const valorVA = parseFloat(col.valor_diario_va) || 28.00;
          const escalaVal = col.escala || '5x2';
          const telefoneVal = col.telefone || '';
          const linhasVal = col.linhas_onibus || 'Municipal';
          const cpfVal = col.cpf ? String(col.cpf).trim() : '';

          let totalDiarioVT = col.total_diario_vt !== undefined && col.total_diario_vt !== null && col.total_diario_vt !== ''
            ? parseFloat(col.total_diario_vt)
            : (Math.round(qtdPassagens * valorVT * 100) / 100);
          let linhasTransporteJson = null;
          if (col.linhas_transporte_json) {
            linhasTransporteJson = typeof col.linhas_transporte_json === 'string'
              ? col.linhas_transporte_json
              : JSON.stringify(col.linhas_transporte_json);
          }

          // 4. Verificar se colaborador jÃ¡ existe (Prioridade 1: ID; Prioridade 2: CPF; Prioridade 3: Nome Exato)
          let colabExistente = null;
          const rawId = col.id || col.ID_Colaborador || col.colaborador_id || col.id_colaborador || col.ID;
          if (rawId) {
            const numId = parseInt(rawId, 10);
            if (!isNaN(numId) && numId > 0) {
              colabExistente = db.prepare('SELECT id FROM colaboradores WHERE id = ?').get(numId);
            }
          }
          if (!colabExistente) {
            const cpfLimpo = cpfVal.replace(/\D/g, '');
            if (cpfLimpo.length === 11) {
              colabExistente = db.prepare(`
                SELECT id FROM colaboradores 
                WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?
              `).get(cpfLimpo);
            }
          }
          if (!colabExistente && col.nome) {
            colabExistente = db.prepare('SELECT id FROM colaboradores WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?))').get(col.nome);
          }

          if (colabExistente) {
            db.prepare(`
              UPDATE colaboradores SET
                nome = ?,
                cpf = CASE WHEN ? != '' THEN ? ELSE cpf END,
                cargo_id = ?,
                cliente_id = ?,
                posto_trabalho_id = ?,
                escala = ?,
                data_admissao = COALESCE(?, data_admissao),
                telefone = CASE WHEN ? != '' THEN ? ELSE telefone END,
                linhas_onibus = ?,
                quantidade_passagens_dia = ?,
                valor_passagem_unitaria = ?,
                valor_diario_va = ?,
                total_diario_vt = ?,
                linhas_transporte_json = CASE WHEN ? IS NOT NULL THEN ? ELSE linhas_transporte_json END,
                status_colaborador = 'Ativo',
                ativo = 1
              WHERE id = ?
            `).run(
              col.nome.trim(),
              cpfVal, cpfVal,
              cargoId,
              clienteId,
              postoTrabalhoId,
              escalaVal,
              dataAdmFormatada,
              telefoneVal, telefoneVal,
              linhasVal,
              qtdPassagens,
              valorVT,
              valorVA,
              totalDiarioVT,
              linhasTransporteJson, linhasTransporteJson,
              colabExistente.id
            );
            atualizados++;
          } else {
            const resIns = db.prepare(`
              INSERT INTO colaboradores (
                nome, cpf, cargo_id, cliente_id, posto_trabalho_id, escala, data_admissao,
                telefone, linhas_onibus, quantidade_passagens_dia, valor_passagem_unitaria, valor_diario_va,
                total_diario_vt, linhas_transporte_json, status_colaborador, ativo
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo', 1)
            `).run(
              col.nome.trim(),
              cpfVal,
              cargoId,
              clienteId,
              postoTrabalhoId,
              escalaVal,
              dataAdmFormatada,
              telefoneVal,
              linhasVal,
              qtdPassagens,
              valorVT,
              valorVA,
              totalDiarioVT,
              linhasTransporteJson || '[]'
            );
            inseridos++;

            try {
              gerarDocumentosSSTParaColaborador(resIns.lastInsertRowid, cargoId);
            } catch (eSST) {}
          }
        }

        return jsonResponse(res, { success: true, inseridos, atualizados, total: inseridos + atualizados });
      }

      // -----------------------------------------------------------
      // 10. DEMAIS ROTAS EXISTENTES (CLIENTES, UNIDADES, FREELANCERS, COMPRAS, ETC)
      // -----------------------------------------------------------
      if (pathname === '/api/clientes' && method === 'GET') {
        const clientes = db.prepare(`
          SELECT c.*, 
                 (SELECT COUNT(*) FROM unidades u WHERE u.cliente_id = c.id AND u.ativo = 1) as total_unidades,
                 (SELECT COUNT(*) FROM postos_trabalho pt WHERE pt.cliente_id = c.id AND pt.ativo = 1) as total_postos,
                 (SELECT COUNT(*) FROM colaboradores col WHERE col.cliente_id = c.id AND col.ativo = 1) as total_colaboradores,
                 (SELECT COALESCE(SUM(pt.quantidade_vagas_limite), 0) FROM postos_trabalho pt WHERE pt.cliente_id = c.id AND pt.ativo = 1) as total_vagas_contratadas,
                 (SELECT COUNT(*) FROM colaboradores col JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id WHERE pt.cliente_id = c.id AND col.ativo = 1) as total_vagas_ocupadas
          FROM clientes c 
          WHERE c.ativo = 1
          ORDER BY COALESCE(NULLIF(c.nome_fantasia, ''), c.nome_razao_social) ASC
        `).all();

        for (const c of clientes) {
          // Buscar postos de trabalho do cliente
          const postos = db.prepare(`
            SELECT pt.*, cg.nome_cargo, u.nome_unidade
            FROM postos_trabalho pt
            JOIN cargos cg ON pt.cargo_id = cg.id
            LEFT JOIN unidades u ON pt.unidade_id = u.id
            WHERE pt.cliente_id = ? AND pt.ativo = 1 AND col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
            ORDER BY pt.nome_posto ASC
          `).all(c.id);

          for (const p of postos) {
            // 1. Colaboradores diretos
            const diretos = db.prepare(`
              SELECT col.id, col.nome, col.status_colaborador, col.data_admissao, col.escala, cg.nome_cargo,
                     0 as is_multi_cliente, '' as dias_atendimento, '' as carga_horaria
              FROM colaboradores col
              LEFT JOIN cargos cg ON col.cargo_id = cg.id
              WHERE col.posto_trabalho_id = ? AND col.ativo = 1
              ORDER BY col.nome ASC
            `).all(p.id);

            // 2. Colaboradores multi-cliente compartilhados
            const compartilhados = db.prepare(`
              SELECT col.id, col.nome, col.status_colaborador, col.data_admissao, col.escala, cg.nome_cargo,
                     1 as is_multi_cliente, ccc.dias_semana as dias_atendimento, ccc.carga_horaria_semanal as carga_horaria,
                     ccc.id as vinculo_multi_id, ccc.roteiro_id
              FROM colaborador_clientes_compartilhados ccc
              JOIN colaboradores col ON ccc.colaborador_id = col.id
              LEFT JOIN cargos cg ON col.cargo_id = cg.id
              WHERE (ccc.posto_trabalho_id = ? OR (ccc.cliente_id = ? AND ccc.posto_trabalho_id IS NULL))
                AND ccc.ativo = 1 AND col.ativo = 1
              ORDER BY col.nome ASC
            `).all(p.id, c.id);

            // Enriquecer colaboradores compartilhados com informaÃ§Ãµes dos outros clientes do roteiro
            for (const comp of compartilhados) {
              const outros = db.prepare(`
                SELECT cl.id, COALESCE(NULLIF(cl.nome_fantasia, ''), cl.nome_razao_social) as cliente_nome,
                       c2.dias_semana, c2.carga_horaria_semanal
                FROM colaborador_clientes_compartilhados c2
                JOIN clientes cl ON c2.cliente_id = cl.id
                WHERE c2.colaborador_id = ? AND c2.ativo = 1 AND c2.cliente_id != ?
              `).all(comp.id, c.id);
              comp.outros_clientes = outros;
              comp.total_clientes_roteiro = outros.length + 1;
            }

            const todosAlocados = [...diretos, ...compartilhados];
            p.total_ocupados = todosAlocados.length;
            p.vagas_disponiveis = Math.max(0, p.quantidade_vagas_limite - p.total_ocupados);
            p.vagas_abertas = Math.max(0, p.quantidade_vagas_limite - p.total_ocupados);
            p.requer_contratacao = p.vagas_abertas > 0;
            p.esta_lotado = p.total_ocupados >= p.quantidade_vagas_limite;
            p.colaboradores_alocados = todosAlocados;
          }

          // Buscar roteiros multi-cliente ativos que contemplem este cliente
          const roteirosAtivos = db.prepare(`
            SELECT rm.id, rm.nome_roteiro, rm.carga_total_semanal, rm.escala_nome,
                   col.id as colaborador_id, col.nome as colaborador_nome,
                   ccc.dias_semana as dias_neste_cliente, ccc.carga_horaria_semanal as horas_neste_cliente
            FROM colaborador_clientes_compartilhados ccc
            JOIN roteiros_multi_clientes rm ON ccc.roteiro_id = rm.id
            JOIN colaboradores col ON ccc.colaborador_id = col.id
            WHERE ccc.cliente_id = ? AND ccc.ativo = 1 AND rm.ativo = 1 AND col.ativo = 1
          `).all(c.id);

          c.roteiros_multi_cliente = roteirosAtivos;
          c.postos = postos;
          c.total_vagas_ocupadas = postos.reduce((acc, p) => acc + (p.total_ocupados || 0), 0);
          c.total_vagas_abertas = Math.max(0, c.total_vagas_contratadas - c.total_vagas_ocupadas);
          c.possui_vagas_abertas = c.total_vagas_abertas > 0;
        }

        return jsonResponse(res, clientes);
      }

      if (pathname === '/api/clientes' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome_razao_social && !body.nome_fantasia) return errorResponse(res, 'Nome do cliente Ã© obrigatÃ³rio', 400);
        const stmt = db.prepare(`
          INSERT INTO clientes (nome_razao_social, nome_fantasia, cnpj, contato_responsavel, telefone, email, cota_mensal_insumos, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.nome_razao_social || body.nome_fantasia,
          body.nome_fantasia || body.nome_razao_social,
          body.cnpj || '',
          body.contato_responsavel || '',
          body.telefone || '',
          body.email || '',
          parseFloat(body.cota_mensal_insumos) || 0,
          body.observacoes || ''
        );
        const clienteId = result.lastInsertRowid;

        // Se foram enviados postos no cadastro do cliente, criar todos
        if (Array.isArray(body.postos) && body.postos.length > 0) {
          const stmtPosto = db.prepare(`
            INSERT INTO postos_trabalho (cliente_id, unidade_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of body.postos) {
            if (p.nome_posto && p.cargo_id) {
              stmtPosto.run(
                clienteId,
                p.unidade_id ? parseInt(p.unidade_id, 10) : null,
                p.nome_posto,
                parseInt(p.cargo_id, 10),
                parseInt(p.quantidade_vagas_limite, 10) || 1,
                p.escala || '5x2',
                p.turno || 'Diurno',
                p.observacoes || ''
              );
            }
          }
        }

        return jsonResponse(res, { success: true, id: clienteId });
      }

      if (pathname.startsWith('/api/clientes/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        db.prepare(`
          UPDATE clientes SET 
            nome_razao_social = ?, nome_fantasia = ?, cnpj = ?, contato_responsavel = ?,
            telefone = ?, email = ?, cota_mensal_insumos = ?, observacoes = ?, ativo = ?
          WHERE id = ?
        `).run(
          body.nome_razao_social,
          body.nome_fantasia,
          body.cnpj,
          body.contato_responsavel,
          body.telefone,
          body.email,
          parseFloat(body.cota_mensal_insumos) || 0,
          body.observacoes,
          body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1,
          id
        );
        return jsonResponse(res, { success: true });
      }

      if (pathname === '/api/unidades' && method === 'GET') {
        let sql = `
          SELECT u.*, c.nome_fantasia as cliente_nome, c.nome_razao_social,
                 (SELECT COUNT(*) FROM colaboradores col WHERE col.unidade_id = u.id AND col.ativo = 1) as total_colaboradores,
                 (SELECT pus.token_acesso FROM pedido_unidade_status pus WHERE pus.unidade_id = u.id ORDER BY pus.id DESC LIMIT 1) as ultimo_token_acesso
          FROM unidades u
          JOIN clientes c ON u.cliente_id = c.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];
        if (query.cliente_id) {
          sql += ` AND u.cliente_id = ? `;
          params.push(parseInt(query.cliente_id, 10));
        }
        if (query.ativo !== undefined && query.ativo !== '' && query.ativo !== 'all') {
          sql += ` AND u.ativo = ? `;
          params.push(parseInt(query.ativo, 10));
        } else if (!query.ativo && query.ativo !== 'all') {
          sql += ` AND u.ativo = 1 `;
        }
        if (query.busca && query.busca.trim()) {
          const t = `%${query.busca.trim()}%`;
          sql += ` AND (u.nome_unidade LIKE ? OR u.endereco LIKE ? OR u.bairro LIKE ? OR u.cidade LIKE ? OR u.responsavel_local LIKE ? OR u.telefone_local LIKE ? OR c.nome_fantasia LIKE ? OR c.nome_razao_social LIKE ?) `;
          params.push(t, t, t, t, t, t, t, t);
        }
        sql += ` ORDER BY u.ativo DESC, u.nome_unidade ASC `;
        const unidades = db.prepare(sql).all(...params);
        return jsonResponse(res, unidades);
      }

      if (pathname === '/api/unidades' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.cliente_id || !body.nome_unidade) return errorResponse(res, 'Cliente e Nome do PrÃ©dio/Unidade sÃ£o obrigatÃ³rios', 400);
        const stmt = db.prepare(`
          INSERT INTO unidades (cliente_id, nome_unidade, endereco, bairro, cidade, cep, responsavel_local, telefone_local, cota_limite_insumos, observacoes, fornecedores_permitidos_json, ativo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          parseInt(body.cliente_id, 10),
          body.nome_unidade.trim(),
          body.endereco || '',
          body.bairro || '',
          body.cidade || '',
          body.cep || '',
          body.responsavel_local || '',
          body.telefone_local || '',
          parseFloat(body.cota_limite_insumos) || 0,
          body.observacoes || '',
          body.fornecedores_permitidos_json || '[]',
          body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1
        );
        const unidadeId = result.lastInsertRowid;

        // Sincronizar automaticamente com pedidos mensais existentes do cliente
        try {
          const pedidosAtivos = db.prepare('SELECT id FROM pedidos_compras_mensal WHERE cliente_id = ?').all(parseInt(body.cliente_id, 10));
          for (const ped of pedidosAtivos) {
            const tokenAcesso = crypto.randomBytes(12).toString('hex');
            db.prepare(`
              INSERT OR IGNORE INTO pedido_unidade_status (pedido_id, unidade_id, status, responsavel_nome, responsavel_telefone, token_acesso)
              VALUES (?, ?, 'Pendente', ?, ?, ?)
            `).run(ped.id, unidadeId, body.responsavel_local || '', body.telefone_local || '', tokenAcesso);
          }
        } catch (e) {}

        return jsonResponse(res, { success: true, id: unidadeId });
      }

      if (pathname.startsWith('/api/unidades/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        if (!body.nome_unidade) return errorResponse(res, 'Nome do PrÃ©dio Ã© obrigatÃ³rio', 400);

        db.prepare(`
          UPDATE unidades SET
            cliente_id = COALESCE(?, cliente_id),
            nome_unidade = ?,
            endereco = ?,
            bairro = ?,
            cidade = ?,
            cep = ?,
            responsavel_local = ?,
            telefone_local = ?,
            cota_limite_insumos = ?,
            observacoes = ?,
            fornecedores_permitidos_json = ?,
            ativo = ?
          WHERE id = ?
        `).run(
          body.cliente_id ? parseInt(body.cliente_id, 10) : null,
          body.nome_unidade.trim(),
          body.endereco || '',
          body.bairro || '',
          body.cidade || '',
          body.cep || '',
          body.responsavel_local || '',
          body.telefone_local || '',
          parseFloat(body.cota_limite_insumos) || 0,
          body.observacoes || '',
          body.fornecedores_permitidos_json || '[]',
          body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1,
          id
        );

        try {
          db.prepare(`
            UPDATE pedido_unidade_status SET
              responsavel_nome = CASE WHEN status = 'Pendente' THEN ? ELSE responsavel_nome END,
              responsavel_telefone = CASE WHEN status = 'Pendente' THEN ? ELSE responsavel_telefone END
            WHERE unidade_id = ?
          `).run(body.responsavel_local || '', body.telefone_local || '', id);
        } catch (e) {}

        return jsonResponse(res, { success: true });
      }

      if (pathname.startsWith('/api/unidades/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        const countColabs = db.prepare('SELECT COUNT(*) as c FROM colaboradores WHERE unidade_id = ?').get(id)?.c || 0;
        const countPedidos = db.prepare('SELECT COUNT(*) as c FROM pedido_itens_unidade WHERE unidade_id = ?').get(id)?.c || 0;
        const countFaltas = db.prepare('SELECT COUNT(*) as c FROM faltas_coberturas WHERE unidade_id = ?').get(id)?.c || 0;

        if (countColabs > 0 || countPedidos > 0 || countFaltas > 0) {
          db.prepare('UPDATE unidades SET ativo = 0 WHERE id = ?').run(id);
          db.prepare('UPDATE postos_trabalho SET ativo = 0 WHERE unidade_id = ?').run(id);
          return jsonResponse(res, { success: true, message: 'PrÃ©dio inativado para manter histÃ³rico financeiro e operacional.', inativado: true });
        } else {
          db.prepare('DELETE FROM faltas_coberturas WHERE unidade_id = ?').run(id);
          db.prepare('DELETE FROM postos_trabalho WHERE unidade_id = ?').run(id);
          db.prepare('DELETE FROM pedido_unidade_status WHERE unidade_id = ?').run(id);
          db.prepare('DELETE FROM unidades WHERE id = ?').run(id);
          return jsonResponse(res, { success: true, message: 'PrÃ©dio removido com sucesso.', excluido: true });
        }
      }

      if (pathname === '/api/unidades/importar-lote' && method === 'POST') {
        const body = await parseRequestBody(req);
        const lista = body.unidades || [];
        if (!Array.isArray(lista) || lista.length === 0) {
          return errorResponse(res, 'Nenhum prÃ©dio informado para importaÃ§Ã£o.', 400);
        }

        let inseridos = 0;
        let atualizados = 0;
        const clientesTodos = db.prepare('SELECT id, nome_fantasia, nome_razao_social, cnpj FROM clientes').all();

        for (const u of lista) {
          if (!u.nome_unidade || !String(u.nome_unidade).trim()) continue;

          let clienteId = parseInt(u.cliente_id, 10);
          if (!clienteId && u.cliente) {
            const cBusca = String(u.cliente).trim().toLowerCase();
            const match = clientesTodos.find(cl => 
              String(cl.id) === cBusca ||
              (cl.nome_fantasia && cl.nome_fantasia.toLowerCase().includes(cBusca)) ||
              (cl.nome_razao_social && cl.nome_razao_social.toLowerCase().includes(cBusca)) ||
              (cl.cnpj && cl.cnpj.replace(/\D/g, '').includes(cBusca.replace(/\D/g, '')))
            );
            if (match) clienteId = match.id;
          }

          if (!clienteId) clienteId = clientesTodos[0]?.id || 1;

          const existente = db.prepare('SELECT id FROM unidades WHERE cliente_id = ? AND LOWER(TRIM(nome_unidade)) = LOWER(TRIM(?))').get(clienteId, u.nome_unidade.trim());

          if (existente) {
            db.prepare(`
              UPDATE unidades SET
                endereco = COALESCE(NULLIF(?, ''), endereco),
                bairro = COALESCE(NULLIF(?, ''), bairro),
                cidade = COALESCE(NULLIF(?, ''), cidade),
                cep = COALESCE(NULLIF(?, ''), cep),
                responsavel_local = COALESCE(NULLIF(?, ''), responsavel_local),
                telefone_local = COALESCE(NULLIF(?, ''), telefone_local),
                cota_limite_insumos = CASE WHEN ? > 0 THEN ? ELSE cota_limite_insumos END,
                observacoes = COALESCE(NULLIF(?, ''), observacoes),
                ativo = 1
              WHERE id = ?
            `).run(
              u.endereco || '',
              u.bairro || '',
              u.cidade || '',
              u.cep || '',
              u.responsavel_local || '',
              u.telefone_local || '',
              parseFloat(u.cota_limite_insumos) || 0,
              parseFloat(u.cota_limite_insumos) || 0,
              u.observacoes || '',
              existente.id
            );
            atualizados++;
          } else {
            const resIns = db.prepare(`
              INSERT INTO unidades (cliente_id, nome_unidade, endereco, bairro, cidade, cep, responsavel_local, telefone_local, cota_limite_insumos, observacoes, ativo)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `).run(
              clienteId,
              u.nome_unidade.trim(),
              u.endereco || '',
              u.bairro || '',
              u.cidade || '',
              u.cep || '',
              u.responsavel_local || '',
              u.telefone_local || '',
              parseFloat(u.cota_limite_insumos) || 0,
              u.observacoes || ''
            );
            const novaUnidadeId = resIns.lastInsertRowid;
            inseridos++;

            try {
              const pedidosAtivos = db.prepare('SELECT id FROM pedidos_compras_mensal WHERE cliente_id = ?').all(clienteId);
              for (const ped of pedidosAtivos) {
                const tokenAcesso = crypto.randomBytes(12).toString('hex');
                db.prepare(`
                  INSERT OR IGNORE INTO pedido_unidade_status (pedido_id, unidade_id, status, responsavel_nome, responsavel_telefone, token_acesso)
                  VALUES (?, ?, 'Pendente', ?, ?, ?)
                `).run(ped.id, novaUnidadeId, u.responsavel_local || '', u.telefone_local || '', tokenAcesso);
              }
            } catch (e) {}
          }
        }

        return jsonResponse(res, { success: true, inseridos, atualizados, total: inseridos + atualizados });
      }

      if (pathname === '/api/cargos' && method === 'GET') {
        const cargos = db.prepare(`
          SELECT cg.*,
                 (SELECT COUNT(*) FROM postos_trabalho pt WHERE pt.cargo_id = cg.id AND pt.ativo = 1) as total_postos,
                 (SELECT COUNT(*) FROM colaboradores col WHERE col.cargo_id = cg.id AND col.ativo = 1) as total_colaboradores
          FROM cargos cg
          WHERE cg.ativo = 1
          ORDER BY cg.nome_cargo ASC
        `).all();
        return jsonResponse(res, cargos);
      }

      if (pathname === '/api/cargos' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome_cargo || !body.nome_cargo.trim()) return errorResponse(res, 'Nome da funÃ§Ã£o / cargo Ã© obrigatÃ³rio', 400);
        const nomeCargo = body.nome_cargo.trim();
        const existe = db.prepare('SELECT id, ativo FROM cargos WHERE LOWER(nome_cargo) = LOWER(?)').get(nomeCargo);
        if (existe) {
          if (existe.ativo === 0) {
            db.prepare('UPDATE cargos SET ativo = 1, descricao = ?, valor_diaria_referencia = ? WHERE id = ?')
              .run(body.descricao || '', parseFloat(body.valor_diaria_referencia) || 0, existe.id);
            return jsonResponse(res, { success: true, id: existe.id, nome_cargo: nomeCargo, reativado: true });
          }
          return errorResponse(res, 'JÃ¡ existe uma funÃ§Ã£o/cargo cadastrada com este nome', 400);
        }
        const stmt = db.prepare('INSERT INTO cargos (nome_cargo, descricao, valor_diaria_referencia) VALUES (?, ?, ?)');
        const result = stmt.run(nomeCargo, body.descricao || '', parseFloat(body.valor_diaria_referencia) || 0);
        return jsonResponse(res, { success: true, id: result.lastInsertRowid, nome_cargo: nomeCargo });
      }

      if (pathname.startsWith('/api/cargos/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        const postosUso = db.prepare('SELECT COUNT(*) as count FROM postos_trabalho WHERE cargo_id = ? AND ativo = 1').get(id).count;
        const colabsUso = db.prepare('SELECT COUNT(*) as count FROM colaboradores WHERE cargo_id = ? AND ativo = 1').get(id).count;
        if (postosUso > 0 || colabsUso > 0) {
          return errorResponse(res, `Esta funÃ§Ã£o estÃ¡ em uso por ${postosUso} posto(s) e ${colabsUso} colaborador(es) ativo(s). Remova os vÃ­nculos antes de excluir.`, 400);
        }
        db.prepare('UPDATE cargos SET ativo = 0 WHERE id = ?').run(id);
        return jsonResponse(res, { success: true });
      }

      if (pathname === '/api/freelancers' && method === 'GET') {
        const freelancers = db.prepare(`
          SELECT f.*, cg.nome_cargo as cargo_preferencial_nome,
                 (SELECT COUNT(*) FROM faltas_coberturas fc WHERE fc.freelancer_id = f.id) as total_coberturas_historico
          FROM freelancers f
          LEFT JOIN cargos cg ON f.cargo_preferencial_id = cg.id
          WHERE f.ativo = 1
          ORDER BY f.nome ASC
        `).all();
        return jsonResponse(res, freelancers);
      }

      if (pathname === '/api/freelancers' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome) return errorResponse(res, 'Nome do freelancer Ã© obrigatÃ³rio', 400);
        const stmt = db.prepare(`
          INSERT INTO freelancers (nome, cpf, cargo_preferencial_id, telefone, tipo_chave_pix, chave_pix, banco, valor_diaria_padrao, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          body.nome,
          body.cpf || '',
          body.cargo_preferencial_id ? parseInt(body.cargo_preferencial_id, 10) : null,
          body.telefone || '',
          body.tipo_chave_pix || 'Chave PIX',
          body.chave_pix || '',
          body.banco || '',
          parseFloat(body.valor_diaria_padrao) || 140.00,
          body.observacoes || ''
        );
        return jsonResponse(res, { success: true, id: result.lastInsertRowid });
      }

      // ATUALIZAR FREELANCER (EDITAR CADASTRO)
      if (pathname.startsWith('/api/freelancers/') && !pathname.endsWith('/dossie') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        if (!id) return errorResponse(res, 'ID de freelancer invÃ¡lido', 400);
        const body = await parseRequestBody(req);
        if (!body.nome) return errorResponse(res, 'Nome do freelancer Ã© obrigatÃ³rio', 400);

        db.prepare(`
          UPDATE freelancers SET
            nome = ?,
            cpf = ?,
            cargo_preferencial_id = ?,
            telefone = ?,
            tipo_chave_pix = ?,
            chave_pix = ?,
            banco = ?,
            valor_diaria_padrao = ?,
            observacoes = ?
          WHERE id = ?
        `).run(
          body.nome,
          body.cpf || '',
          body.cargo_preferencial_id ? parseInt(body.cargo_preferencial_id, 10) : null,
          body.telefone || '',
          body.tipo_chave_pix || 'Chave PIX',
          body.chave_pix || '',
          body.banco || '',
          parseFloat(body.valor_diaria_padrao) || 140.00,
          body.observacoes || '',
          id
        );
        return jsonResponse(res, { success: true, message: 'Dados do freelancer atualizados com sucesso!' });
      }

      // DOSSIÃŠ COMPLETO DO FREELANCER (HISTÃ“RICO DE SERVIÃ‡OS, QUEM LANÃ‡OU E EXCLUÃDOS)
      if (pathname.match(/^\/api\/freelancers\/\d+\/dossie$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[3], 10);
        const free = db.prepare(`
          SELECT f.*, cg.nome_cargo as cargo_preferencial_nome
          FROM freelancers f
          LEFT JOIN cargos cg ON f.cargo_preferencial_id = cg.id
          WHERE f.id = ?
        `).get(id);
        if (!free) return errorResponse(res, 'Freelancer nÃ£o encontrado', 404);

        // EstatÃ­sticas do DossiÃª
        const stats = db.prepare(`
          SELECT 
            COUNT(fc.id) as total_diarias_historico,
            COALESCE(SUM(fc.valor_pago_freelance), 0) as total_valor_historico,
            COALESCE(SUM(CASE WHEN fc.status_pagamento_freelance = 'Pago' THEN fc.valor_pago_freelance ELSE 0 END), 0) as total_pago,
            COALESCE(SUM(CASE WHEN fc.status_pagamento_freelance = 'Pendente' THEN fc.valor_pago_freelance ELSE 0 END), 0) as total_pendente
          FROM faltas_coberturas fc
          WHERE fc.freelancer_id = ? AND (fc.excluido = 0 OR fc.excluido IS NULL)
        `).get(id);

        // ServiÃ§os ativos prestados por este freelancer
        const servicos = db.prepare(`
          SELECT 
            fc.id, fc.data_falta, fc.valor_pago_freelance, fc.status_pagamento_freelance, fc.data_pagamento_freelance,
            c.id as cliente_id, c.nome_fantasia as cliente_nome,
            u.id as unidade_id, u.nome_unidade,
            cg.id as cargo_id, cg.nome_cargo,
            col.id as colaborador_id, col.nome as faltante_nome,
            fc.turno, fc.motivo_falta, fc.observacoes_operacao,
            fc.origem_lancamento, fc.created_at,
            COALESCE(s.nome, fc.supervisor_nome, fc.criado_por, 'Sistema') as quem_lancou,
            fc.supervisor_nome, fc.criado_por,
            fc.atualizado_por, fc.atualizado_em
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          LEFT JOIN supervisores s ON fc.supervisor_id = s.id
          WHERE fc.freelancer_id = ? AND (fc.excluido = 0 OR fc.excluido IS NULL)
          ORDER BY fc.data_falta DESC, fc.id DESC
        `).all(id);

        // DiÃ¡rias excluÃ­das deste freelancer (Auditoria / Lixeira)
        const excluidos = db.prepare(`
          SELECT 
            fc.id, fc.data_falta, fc.valor_pago_freelance,
            c.nome_fantasia as cliente_nome, u.nome_unidade, cg.nome_cargo, col.nome as faltante_nome,
            fc.turno, fc.motivo_falta,
            COALESCE(s.nome, fc.supervisor_nome, fc.criado_por, 'Sistema') as quem_lancou,
            fc.origem_lancamento,
            fc.excluido_por, fc.excluido_em, fc.motivo_exclusao
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          LEFT JOIN supervisores s ON fc.supervisor_id = s.id
          WHERE fc.freelancer_id = ? AND fc.excluido = 1
          ORDER BY fc.excluido_em DESC, fc.id DESC
        `).all(id);

        return jsonResponse(res, {
          freelancer: free,
          estatisticas: stats,
          servicos,
          excluidos
        });
      }

      // LIXEIRA GLOBAL DE DIÃRIAS EXCLUÃDAS (AUDITORIA DO SISTEMA)
      if (pathname === '/api/freelancers/lixeira' && method === 'GET') {
        const excluidos = db.prepare(`
          SELECT 
            fc.id, fc.freelancer_id, free.nome as freelancer_nome,
            fc.data_falta, c.nome_fantasia as cliente_nome, u.nome_unidade, cg.nome_cargo, col.nome as faltante_nome,
            fc.valor_pago_freelance,
            COALESCE(s.nome, fc.supervisor_nome, fc.criado_por, 'Sistema') as quem_lancou,
            fc.origem_lancamento, fc.excluido_por, fc.excluido_em, fc.motivo_exclusao
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          LEFT JOIN freelancers free ON fc.freelancer_id = free.id
          LEFT JOIN supervisores s ON fc.supervisor_id = s.id
          WHERE fc.excluido = 1
          ORDER BY fc.excluido_em DESC, fc.id DESC
        `).all();
        return jsonResponse(res, excluidos);
      }

      if (pathname === '/api/fornecedores' && method === 'GET') {
        const fornecedores = db.prepare(`
          SELECT f.*,
                 (SELECT COUNT(*) FROM produtos_insumos WHERE fornecedor_id = f.id AND ativo = 1) as total_produtos
          FROM fornecedores f
          WHERE f.ativo = 1
          ORDER BY f.nome_empresa ASC
        `).all();
        return jsonResponse(res, fornecedores);
      }

      if (pathname.startsWith('/api/fornecedores/') && pathname.endsWith('/produtos') && method === 'GET') {
        const id = parseInt(pathname.split('/')[3], 10);
        const produtos = db.prepare(`
          SELECT p.*, f.nome_empresa as fornecedor_nome
          FROM produtos_insumos p
          JOIN fornecedores f ON p.fornecedor_id = f.id
          WHERE p.fornecedor_id = ? AND p.ativo = 1
          ORDER BY p.categoria ASC, p.descricao ASC
        `).all(id);
        return jsonResponse(res, produtos);
      }

      if (pathname.startsWith('/api/fornecedores/') && method === 'GET') {
        const id = parseInt(pathname.split('/')[3], 10);
        const fornecedor = db.prepare(`
          SELECT f.*,
                 (SELECT COUNT(*) FROM produtos_insumos WHERE fornecedor_id = f.id AND ativo = 1) as total_produtos
          FROM fornecedores f
          WHERE f.id = ? AND f.ativo = 1
        `).get(id);
        if (!fornecedor) return errorResponse(res, 'Fornecedor nÃ£o encontrado', 404);
        const produtos = db.prepare('SELECT * FROM produtos_insumos WHERE fornecedor_id = ? AND ativo = 1 ORDER BY categoria ASC, descricao ASC').all(id);
        return jsonResponse(res, { ...fornecedor, produtos });
      }

      if (pathname === '/api/fornecedores' && method === 'POST') {
        const body = await parseRequestBody(req);
        const nomeEmpresa = body.nome_empresa || body.nome_fantasia || body.razao_social || body.nome;
        if (!nomeEmpresa) return errorResponse(res, 'Nome da empresa Ã© obrigatÃ³rio', 400);
        const stmt = db.prepare(`
          INSERT INTO fornecedores (
            nome_empresa, cnpj, tipo_fornecedor, contato, telefone, email,
            prazo_entrega_dias, condicoes_pagamento, chave_pix, dados_bancarios, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          nomeEmpresa,
          body.cnpj || '',
          body.tipo_fornecedor || body.categoria || 'Limpeza & QuÃ­micos',
          body.contato || body.contato_nome || '',
          body.telefone || '',
          body.email || '',
          parseInt(body.prazo_entrega_dias, 10) || 3,
          body.condicoes_pagamento || '30 dias',
          body.chave_pix || '',
          body.dados_bancarios || '',
          body.observacoes || ''
        );
        return jsonResponse(res, { success: true, id: result.lastInsertRowid, message: 'Fornecedor cadastrado com sucesso!' });
      }

      if (pathname.startsWith('/api/fornecedores/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        const nomeEmpresa = body.nome_empresa || body.nome_fantasia || body.razao_social || body.nome;
        if (!nomeEmpresa) return errorResponse(res, 'Nome da empresa Ã© obrigatÃ³rio', 400);
        db.prepare(`
          UPDATE fornecedores SET
            nome_empresa = ?, cnpj = ?, tipo_fornecedor = ?, contato = ?,
            telefone = ?, email = ?, prazo_entrega_dias = ?,
            condicoes_pagamento = ?, chave_pix = ?, dados_bancarios = ?, observacoes = ?
          WHERE id = ?
        `).run(
          nomeEmpresa,
          body.cnpj || '',
          body.tipo_fornecedor || body.categoria || 'Limpeza & QuÃ­micos',
          body.contato || body.contato_nome || '',
          body.telefone || '',
          body.email || '',
          parseInt(body.prazo_entrega_dias, 10) || 3,
          body.condicoes_pagamento || '30 dias',
          body.chave_pix || '',
          body.dados_bancarios || '',
          body.observacoes || '',
          id
        );
        return jsonResponse(res, { success: true, message: 'Dados do fornecedor atualizados com sucesso!' });
      }

      if (pathname.startsWith('/api/fornecedores/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        db.prepare('UPDATE fornecedores SET ativo = 0 WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Fornecedor inativado com sucesso!' });
      }

      if (pathname === '/api/produtos' && method === 'GET') {
        let sql = `
          SELECT p.*, f.nome_empresa as fornecedor_nome, f.tipo_fornecedor
          FROM produtos_insumos p
          LEFT JOIN fornecedores f ON p.fornecedor_id = f.id
          WHERE p.ativo = 1
        `;
        const params = [];
        if (query.fornecedor_id) {
          sql += ' AND p.fornecedor_id = ?';
          params.push(parseInt(query.fornecedor_id, 10));
        }
        if (query.categoria) {
          sql += ' AND p.categoria = ?';
          params.push(query.categoria);
        }
        if (query.q) {
          sql += ' AND (p.descricao LIKE ? OR p.codigo_referencia LIKE ? OR p.marca LIKE ?)';
          const termo = `%${query.q}%`;
          params.push(termo, termo, termo);
        }
        sql += ' ORDER BY p.categoria ASC, p.descricao ASC';
        const produtos = db.prepare(sql).all(...params);
        return jsonResponse(res, produtos);
      }

      if (pathname === '/api/produtos' && method === 'POST') {
        const body = await parseRequestBody(req);
        const descricao = body.descricao || body.nome;
        const preco = body.preco_anual_fechado !== undefined ? body.preco_anual_fechado : body.preco_unitario;
        if (!descricao || preco === undefined) {
          return errorResponse(res, 'DescriÃ§Ã£o e PreÃ§o sÃ£o obrigatÃ³rios', 400);
        }
        const stmt = db.prepare(`
          INSERT INTO produtos_insumos (
            fornecedor_id, codigo_referencia, descricao, unidade_medida,
            preco_anual_fechado, categoria, marca, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        const result = stmt.run(
          body.fornecedor_id ? parseInt(body.fornecedor_id, 10) : null,
          body.codigo_referencia || body.codigo_sku || '',
          descricao,
          body.unidade_medida || 'UN',
          parseFloat(preco) || 0,
          body.categoria || 'Limpeza Geral',
          body.marca || ''
        );
        return jsonResponse(res, { success: true, id: result.lastInsertRowid, message: 'Produto adicionado Ã  cartela com sucesso!' });
      }

      if (pathname === '/api/produtos/lote' && method === 'POST') {
        const body = await parseRequestBody(req);
        const listaProdutos = Array.isArray(body) ? body : (body.produtos || []);
        const defaultFornecedorId = body.fornecedor_id ? parseInt(body.fornecedor_id, 10) : null;

        if (!Array.isArray(listaProdutos) || listaProdutos.length === 0) {
          return errorResponse(res, 'Nenhum produto enviado para cadastro em lote.', 400);
        }

        // Cache dos fornecedores para resoluÃ§Ã£o por nome ou ID
        const fornecedoresMap = new Map();
        const todosFornecedores = db.prepare('SELECT id, nome_empresa FROM fornecedores').all();
        todosFornecedores.forEach(f => {
          fornecedoresMap.set(f.id, f.id);
          fornecedoresMap.set(f.nome_empresa.trim().toLowerCase(), f.id);
        });

        const stmt = db.prepare(`
          INSERT INTO produtos_insumos (
            fornecedor_id, codigo_referencia, descricao, unidade_medida,
            preco_anual_fechado, categoria, marca, updated_at, ativo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
        `);

        let inseridos = 0;
        const erros = [];

        db.exec('BEGIN TRANSACTION;');
        try {
          for (let i = 0; i < listaProdutos.length; i++) {
            const item = listaProdutos[i];
            const descricao = (item.descricao || item.nome || item.produto || '').trim();
            const rawPreco = item.preco_anual_fechado !== undefined ? item.preco_anual_fechado : (item.preco_unitario !== undefined ? item.preco_unitario : (item.preco !== undefined ? item.preco : item.valor));
            const preco = parseFloat(String(rawPreco).replace('R$', '').replace(/\s+/g, '').replace(',', '.'));

            if (!descricao) {
              erros.push(`Linha ${i + 1}: DescriÃ§Ã£o do produto em branco.`);
              continue;
            }
            if (isNaN(preco) || preco < 0) {
              erros.push(`Linha ${i + 1}: PreÃ§o invÃ¡lido para "${descricao}".`);
              continue;
            }

            // ResoluÃ§Ã£o de fornecedor
            let fornId = defaultFornecedorId;
            if (item.fornecedor_id) {
              fornId = parseInt(item.fornecedor_id, 10);
            } else if (item.fornecedor || item.fornecedor_nome) {
              const fNome = String(item.fornecedor || item.fornecedor_nome).trim().toLowerCase();
              if (fornecedoresMap.has(fNome)) {
                fornId = fornecedoresMap.get(fNome);
              } else {
                const match = todosFornecedores.find(f => f.nome_empresa.toLowerCase().includes(fNome) || fNome.includes(f.nome_empresa.toLowerCase()));
                if (match) fornId = match.id;
              }
            }

            stmt.run(
              fornId || null,
              (item.codigo_referencia || item.codigo_sku || item.sku || item.codigo || '').trim(),
              descricao,
              (item.unidade_medida || item.unidade || 'UN').trim().toUpperCase(),
              preco,
              (item.categoria || 'Limpeza Geral').trim(),
              (item.marca || '').trim()
            );
            inseridos++;
          }

          db.exec('COMMIT;');
        } catch (err) {
          try { db.exec('ROLLBACK;'); } catch (e) {}
          return errorResponse(res, 'Erro ao processar lote no banco de dados: ' + err.message, 500);
        }

        return jsonResponse(res, {
          success: true,
          count: inseridos,
          totalEnviados: listaProdutos.length,
          erros: erros.length > 0 ? erros : null,
          message: `${inseridos} produto(s) cadastrado(s) com sucesso na cartela!`
        });
      }

      if (pathname.startsWith('/api/produtos/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        const descricao = body.descricao || body.nome;
        const preco = body.preco_anual_fechado !== undefined ? body.preco_anual_fechado : body.preco_unitario;
        db.prepare(`
          UPDATE produtos_insumos SET
            codigo_referencia = COALESCE(?, codigo_referencia),
            descricao = COALESCE(?, descricao),
            unidade_medida = COALESCE(?, unidade_medida),
            preco_anual_fechado = COALESCE(?, preco_anual_fechado),
            categoria = COALESCE(?, categoria),
            marca = COALESCE(?, marca),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          body.codigo_referencia || body.codigo_sku || null,
          descricao || null,
          body.unidade_medida || null,
          preco !== undefined ? parseFloat(preco) : null,
          body.categoria || null,
          body.marca || null,
          id
        );
        return jsonResponse(res, { success: true, message: 'Produto atualizado com sucesso!' });
      }

      if (pathname.startsWith('/api/produtos/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        db.prepare('UPDATE produtos_insumos SET ativo = 0 WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Produto removido da cartela com sucesso!' });
      }


      // FALTAS
      if (pathname === '/api/faltas' && method === 'GET') {
        let sql = `
          SELECT fc.*,
                 COALESCE(NULLIF(c.nome_fantasia, ''), NULLIF(c.nome_razao_social, ''), 'Cliente #' || c.id) as cliente_nome,
                 COALESCE(NULLIF(c.nome_fantasia, ''), NULLIF(c.nome_razao_social, ''), 'Cliente #' || c.id) as cliente_fantasia,
                 c.nome_razao_social as cliente_razao_social,
                 u.nome_unidade,
                 cg.nome_cargo,
                 col.nome as colaborador_nome,
                 col.cpf as colaborador_cpf,
                 pt.nome_posto,
                 cobertor.nome as cobertor_efetivo_nome,
                 free.nome as freelancer_nome,
                 free.chave_pix as freelancer_pix,
                 free.telefone as freelancer_telefone,
                 COALESCE(s.nome, fc.supervisor_nome) as supervisor_exibicao
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          LEFT JOIN colaboradores cobertor ON fc.cobertor_colaborador_id = cobertor.id
          LEFT JOIN freelancers free ON fc.freelancer_id = free.id
          LEFT JOIN supervisores s ON fc.supervisor_id = s.id
          WHERE (fc.excluido = 0 OR fc.excluido IS NULL)
        `;
        const params = [];
        if (query.mes) {
          sql += ` AND strftime('%Y-%m', fc.data_falta) = ? `;
          params.push(query.mes);
        }
        if (query.cliente_id) {
          sql += ` AND fc.cliente_id = ? `;
          params.push(parseInt(query.cliente_id, 10));
        }
        if (query.tipo_cobertura) {
          if (query.tipo_cobertura === 'descoberto') {
            sql += ` AND fc.houve_cobertura = 0 `;
          } else if (query.tipo_cobertura === 'freelancer') {
            sql += ` AND fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') `;
          } else if (query.tipo_cobertura === 'efetivo') {
            sql += ` AND fc.houve_cobertura = 1 AND fc.tipo_cobertura = 'efetivo' `;
          }
        } else if (query.houve_cobertura !== undefined && query.houve_cobertura !== '') {
          sql += ` AND fc.houve_cobertura = ? `;
          params.push(parseInt(query.houve_cobertura, 10));
        }
        if (query.supervisor_id) {
          sql += ` AND fc.supervisor_id = ? `;
          params.push(parseInt(query.supervisor_id, 10));
        }
        if (query.origem) {
          sql += ` AND fc.origem_lancamento = ? `;
          params.push(query.origem);
        }
        sql += ` ORDER BY fc.data_falta DESC, fc.id DESC `;
        const faltas = db.prepare(sql).all(...params);
        return jsonResponse(res, faltas);
      }

      if (pathname === '/api/faltas' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.data_falta || !body.cliente_id || !body.colaborador_id) {
          return errorResponse(res, 'Data, Cliente e Colaborador sÃ£o obrigatÃ³rios', 400);
        }

        let unidadeId = parseInt(body.unidade_id, 10);
        if (!unidadeId || isNaN(unidadeId)) {
          const uni = db.prepare('SELECT id FROM unidades WHERE cliente_id = ? LIMIT 1').get(parseInt(body.cliente_id, 10));
          if (uni) {
            unidadeId = uni.id;
          } else {
            const cli = db.prepare('SELECT nome_fantasia, nome_razao_social FROM clientes WHERE id = ?').get(parseInt(body.cliente_id, 10));
            const nomeCli = cli ? (cli.nome_fantasia || cli.nome_razao_social) : 'Geral';
            const insUni = db.prepare('INSERT INTO unidades (cliente_id, nome_unidade) VALUES (?, ?)').run(parseInt(body.cliente_id, 10), 'Unidade Principal - ' + nomeCli);
            unidadeId = insUni.lastInsertRowid;
          }
        }

        let cargoId = body.cargo_id;
        if (!cargoId) {
          const colab = db.prepare('SELECT cargo_id FROM colaboradores WHERE id = ?').get(parseInt(body.colaborador_id, 10));
          cargoId = colab ? colab.cargo_id : 1;
        }

        const houveCobertura = body.houve_cobertura ? 1 : 0;
        let tipoCobertura = null;
        let cobertorColabId = null;
        let freelancerId = null;
        let valorPagoFreelance = 0;
        let statusPagamentoFreelance = 'N/A';
        let statusFaturamento = 'N/A';
        let valorDescontoSugerido = 0;

        if (houveCobertura === 1) {
          tipoCobertura = body.tipo_cobertura || 'efetivo';
          if (tipoCobertura === 'efetivo') {
            cobertorColabId = body.cobertor_colaborador_id ? parseInt(body.cobertor_colaborador_id, 10) : null;
          } else if (tipoCobertura === 'freelancer') {
            freelancerId = body.freelancer_id ? parseInt(body.freelancer_id, 10) : null;
            valorPagoFreelance = parseFloat(body.valor_pago_freelance) || 0;
            statusPagamentoFreelance = 'Pendente';
          } else if (tipoCobertura === 'efetivo_dobra') {
            cobertorColabId = body.cobertor_colaborador_id ? parseInt(body.cobertor_colaborador_id, 10) : null;
            valorPagoFreelance = parseFloat(body.valor_pago_freelance) || 0;
            statusPagamentoFreelance = 'Pendente';
            
            if (cobertorColabId) {
               const colab = db.prepare('SELECT nome, cpf, cargo_id, telefone FROM colaboradores WHERE id = ?').get(cobertorColabId);
               if (colab) {
                 const cpfFmt = colab.cpf ? colab.cpf.replace(/\D/g, '') : null;
                 let freeMatch = null;
                 if (cpfFmt) {
                   freeMatch = db.prepare("SELECT id FROM freelancers WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?").get(cpfFmt);
                 }
                 if (!freeMatch) {
                   freeMatch = db.prepare('SELECT id FROM freelancers WHERE LOWER(nome) = LOWER(?)').get(colab.nome);
                 }
                 if (freeMatch) {
                   freelancerId = freeMatch.id;
                 } else {
                   const resFree = db.prepare("INSERT INTO freelancers (nome, cpf, telefone, cargo_preferencial_id, chave_pix, observacoes, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)").run(colab.nome, colab.cpf || '', colab.telefone || '', colab.cargo_id || 1, 'Pix nÃ£o informado', 'Sincronizado via Dobra');
                   freelancerId = resFree.lastInsertRowid;
                 }
               }
            }
          }
        } else {
          statusFaturamento = 'Pendente';
          const cargoInfo = db.prepare('SELECT valor_diaria_referencia FROM cargos WHERE id = ?').get(cargoId);
          valorDescontoSugerido = parseFloat(body.valor_desconto_sugerido) || (cargoInfo ? cargoInfo.valor_diaria_referencia * 1.3 : 150.00);
        }

        let supNome = body.supervisor_nome || null;
        if (body.supervisor_id && !supNome) {
          const s = db.prepare('SELECT nome FROM supervisores WHERE id = ?').get(parseInt(body.supervisor_id, 10));
          if (s) supNome = s.nome;
        }

        const criadoPor = body.criado_por || body.usuario_nome || supNome || 'Sistema';

        const stmt = db.prepare(`
          INSERT INTO faltas_coberturas (
            data_falta, cliente_id, unidade_id, cargo_id, colaborador_id, motivo_falta,
            dias_afastamento, cid_atestado, houve_cobertura, tipo_cobertura,
            cobertor_colaborador_id, freelancer_id, valor_pago_freelance, status_pagamento_freelance,
            status_faturamento, valor_desconto_sugerido, observacoes_operacao,
            supervisor_id, supervisor_nome, origem_lancamento, turno, motivo_nao_cobertura,
            criado_por
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          body.data_falta,
          parseInt(body.cliente_id, 10),
          unidadeId,
          cargoId,
          parseInt(body.colaborador_id, 10),
          body.motivo_falta || 'Injustificada',
          parseInt(body.dias_afastamento, 10) || 1,
          body.cid_atestado || '',
          houveCobertura,
          tipoCobertura,
          cobertorColabId,
          freelancerId,
          valorPagoFreelance,
          statusPagamentoFreelance,
          statusFaturamento,
          valorDescontoSugerido,
          body.observacoes_operacao || '',
          body.supervisor_id ? parseInt(body.supervisor_id, 10) : null,
          supNome,
          body.origem_lancamento || 'web',
          body.turno || '',
          body.motivo_nao_cobertura || '',
          criadoPor
        );

        return jsonResponse(res, { success: true, id: result.lastInsertRowid });
      }

      // ATUALIZAR DIÃRIA / FALTA / COBERTURA (TUDO EDITÃVEL)
      if (pathname.startsWith('/api/faltas/') && !pathname.endsWith('/purgar') && !pathname.endsWith('/restaurar') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        if (!id) return errorResponse(res, 'ID invÃ¡lido', 400);
        const body = await parseRequestBody(req);

        let cargoId = body.cargo_id ? parseInt(body.cargo_id, 10) : null;
        if (!cargoId && body.colaborador_id) {
          const colab = db.prepare('SELECT cargo_id FROM colaboradores WHERE id = ?').get(parseInt(body.colaborador_id, 10));
          cargoId = colab ? colab.cargo_id : 1;
        }

        const atualizadoPor = body.atualizado_por || body.usuario_nome || 'Sistema';

        db.prepare(`
          UPDATE faltas_coberturas SET
            data_falta = COALESCE(?, data_falta),
            cliente_id = COALESCE(?, cliente_id),
            unidade_id = COALESCE(?, unidade_id),
            cargo_id = COALESCE(?, cargo_id),
            colaborador_id = COALESCE(?, colaborador_id),
            motivo_falta = COALESCE(?, motivo_falta),
            turno = COALESCE(?, turno),
            freelancer_id = COALESCE(?, freelancer_id),
            valor_pago_freelance = COALESCE(?, valor_pago_freelance),
            status_pagamento_freelance = COALESCE(?, status_pagamento_freelance),
            data_pagamento_freelance = ?,
            observacoes_operacao = COALESCE(?, observacoes_operacao),
            atualizado_por = ?,
            atualizado_em = datetime('now', 'localtime')
          WHERE id = ?
        `).run(
          body.data_falta || null,
          body.cliente_id ? parseInt(body.cliente_id, 10) : null,
          body.unidade_id ? parseInt(body.unidade_id, 10) : null,
          cargoId,
          body.colaborador_id ? parseInt(body.colaborador_id, 10) : null,
          body.motivo_falta || null,
          body.turno || null,
          body.freelancer_id !== undefined ? (body.freelancer_id ? parseInt(body.freelancer_id, 10) : null) : null,
          body.valor_pago_freelance !== undefined ? parseFloat(body.valor_pago_freelance) : null,
          body.status_pagamento_freelance || null,
          body.data_pagamento_freelance || (body.status_pagamento_freelance === 'Pago' ? new Date().toISOString().split('T')[0] : null),
          body.observacoes_operacao || null,
          atualizadoPor,
          id
        );
        return jsonResponse(res, { success: true, message: 'Dados da diÃ¡ria atualizados com sucesso!' });
      }

      // EXCLUSÃƒO SUAVE (SOFT DELETE) - MOVE PARA A LIXEIRA COM AUDITORIA
      if (pathname.startsWith('/api/faltas/') && !pathname.endsWith('/purgar') && !pathname.endsWith('/restaurar') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        let body = {};
        try { body = await parseRequestBody(req); } catch(e) {}
        const usuarioNome = query.usuario_nome || body.usuario_nome || 'Sistema';
        const motivo = query.motivo || body.motivo_exclusao || body.motivo || 'ExcluÃ­do pelo usuÃ¡rio';

        db.prepare(`
          UPDATE faltas_coberturas SET
            excluido = 1,
            excluido_por = ?,
            excluido_em = datetime('now', 'localtime'),
            motivo_exclusao = ?
          WHERE id = ?
        `).run(usuarioNome, motivo, id);

        return jsonResponse(res, { success: true, soft_delete: true, message: 'DiÃ¡ria movida para a lixeira com sucesso!' });
      }

      // RESTAURAR REGISTRO EXCLUÃDO DA LIXEIRA
      if (pathname.match(/^\/api\/faltas\/\d+\/restaurar$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        db.prepare(`
          UPDATE faltas_coberturas SET
            excluido = 0,
            excluido_por = NULL,
            excluido_em = NULL,
            motivo_exclusao = NULL
          WHERE id = ?
        `).run(id);

        return jsonResponse(res, { success: true, message: 'DiÃ¡ria restaurada com sucesso!' });
      }

      // EXCLUIR DEFINITIVAMENTE (HARD DELETE / PURGAR) - SOMENTE ADMIN MASTER
      if (pathname.match(/^\/api\/faltas\/\d+\/purgar$/) && (method === 'DELETE' || method === 'POST')) {
        const id = parseInt(pathname.split('/')[3], 10);
        let body = {};
        try { body = await parseRequestBody(req); } catch(e) {}

        const usuarioLogin = query.usuario_login || body.usuario_login;
        const usuarioSetor = query.usuario_setor || body.usuario_setor;

        // Verificar autorizaÃ§Ã£o do Admin Master
        let isAdmin = false;
        if (usuarioSetor === 'admin') {
          isAdmin = true;
        } else if (usuarioLogin) {
          const u = db.prepare('SELECT setor FROM usuarios WHERE login = ? AND ativo = 1').get(usuarioLogin);
          if (u && (u.setor === 'admin' || u.setor === 'Administrador Master')) {
            isAdmin = true;
          }
        }

        if (!isAdmin) {
          return errorResponse(res, 'Acesso Negado: Apenas o Administrador Master tem autorizaÃ§Ã£o para excluir definitivamente registros da lixeira.', 403);
        }

        db.prepare('DELETE FROM faltas_coberturas WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, hard_delete: true, message: 'Registro excluÃ­do definitivamente do banco de dados pelo Admin Master.' });
      }

      // -------------------------------------------------------------
      // SUPERVISORES DE CAMPO & PORTAL MOBILE
      // -------------------------------------------------------------
      if (pathname === '/api/supervisores' && method === 'GET') {
        const anoMes = query.mes || new Date().toISOString().slice(0, 7);
        const ipLocal = obterIpLocal();
        const sups = db.prepare('SELECT id, nome, login, senha, telefone, pin, token_acesso, ativo, created_at FROM supervisores ORDER BY id ASC').all();
        const lista = sups.map(s => {
          const stats = db.prepare(`
            SELECT 
              COUNT(*) as total_lancamentos,
              SUM(CASE WHEN houve_cobertura = 1 THEN 1 ELSE 0 END) as total_cobertos,
              SUM(CASE WHEN houve_cobertura = 0 THEN 1 ELSE 0 END) as total_descobertos
            FROM faltas_coberturas
            WHERE supervisor_id = ? AND strftime('%Y-%m', data_falta) = ?
          `).get(s.id, anoMes);
          return {
            ...s,
            stats_mes: {
              total: stats?.total_lancamentos || 0,
              cobertos: stats?.total_cobertos || 0,
              descobertos: stats?.total_descobertos || 0
            },
            link_mobile: `/supervisor.html?token=${s.token_acesso}`,
            link_mobile_rede: `http://${ipLocal}:${PORT}/supervisor.html?token=${s.token_acesso}`,
            link_mobile_global: `${obterUrlTunnel()}/supervisor.html?token=${s.token_acesso}`
          };
        });
        return jsonResponse(res, {
          supervisores: lista,
          ip_local: ipLocal,
          porta: PORT,
          url_portal_rede: `http://${ipLocal}:${PORT}/supervisor`,
          url_portal_global: `${obterUrlTunnel()}/supervisor`,
          url_tunnel_raiz: obterUrlTunnel()
        });
      }

      // Status do TÃºnel de Acesso Externo
      if (pathname === '/api/tunnel-status' && method === 'GET') {
        const tunnelUrl = obterUrlTunnel();
        const ipLocal = obterIpLocal();
        return jsonResponse(res, {
          online: true,
          url_tunnel: tunnelUrl,
          url_supervisor: `${tunnelUrl}/supervisor`,
          url_rede_local: `http://${ipLocal}:${PORT}/supervisor`
        });
      }

      // Cadastrar Novo Supervisor pelo Administrador
      if (pathname === '/api/supervisores' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome || !body.nome.trim()) return errorResponse(res, 'Nome do supervisor Ã© obrigatÃ³rio', 400);

        let login = (body.login || '').trim().toLowerCase();
        if (!login) {
          login = body.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_').slice(0, 15);
        }

        const existente = db.prepare('SELECT id FROM supervisores WHERE LOWER(login) = ?').get(login);
        if (existente) {
          return errorResponse(res, `O login "${login}" jÃ¡ estÃ¡ em uso por outro supervisor. Escolha outro nome de usuÃ¡rio.`, 400);
        }

        const senha = (body.senha || '').trim() || '123';
        const telefone = (body.telefone || '').trim();
        const pin = (body.pin || '').trim() || '1001';
        const tokenAcesso = crypto.randomBytes(12).toString('hex');
        const ativo = body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1;

        const resIns = db.prepare(`
          INSERT INTO supervisores (nome, login, senha, telefone, pin, token_acesso, ativo)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(body.nome.trim(), login, senha, telefone, pin, tokenAcesso, ativo);

        return jsonResponse(res, {
          success: true,
          message: 'Supervisor cadastrado com sucesso!',
          id: resIns.lastInsertRowid
        });
      }

      // Editar Supervisor Existente
      if (pathname.startsWith('/api/supervisores/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        if (!body.nome || !body.nome.trim()) return errorResponse(res, 'Nome do supervisor Ã© obrigatÃ³rio', 400);

        const login = (body.login || '').trim().toLowerCase();
        if (login) {
          const existente = db.prepare('SELECT id FROM supervisores WHERE LOWER(login) = ? AND id != ?').get(login, id);
          if (existente) {
            return errorResponse(res, `O login "${login}" jÃ¡ estÃ¡ em uso por outro supervisor.`, 400);
          }
        }

        const senha = (body.senha || '').trim() || '123';
        const telefone = (body.telefone || '').trim();
        const pin = (body.pin || '').trim() || '1001';
        const ativo = body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1;

        db.prepare(`
          UPDATE supervisores 
          SET nome = ?, login = ?, senha = ?, telefone = ?, pin = ?, ativo = ?
          WHERE id = ?
        `).run(
          body.nome.trim(),
          login,
          senha,
          telefone,
          pin,
          ativo,
          id
        );
        return jsonResponse(res, { success: true, message: 'Supervisor atualizado com sucesso!' });
      }

      // Excluir ou Inativar Supervisor
      if (pathname.startsWith('/api/supervisores/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        const vinculos = db.prepare('SELECT COUNT(*) as total FROM faltas_coberturas WHERE supervisor_id = ?').get(id);
        if (vinculos && vinculos.total > 0) {
          db.prepare('UPDATE supervisores SET ativo = 0 WHERE id = ?').run(id);
          return jsonResponse(res, { success: true, message: 'Supervisor inativado com sucesso (histÃ³rico preservado).' });
        } else {
          db.prepare('DELETE FROM supervisores WHERE id = ?').run(id);
          return jsonResponse(res, { success: true, message: 'Supervisor excluÃ­do com sucesso!' });
        }
      }

      // ValidaÃ§Ã£o de login mobile por UsuÃ¡rio e Senha, PIN ou Token
      if (pathname === '/api/supervisor/login' && method === 'POST') {
        const body = await parseRequestBody(req);
        let sup = null;

        // 1. Login por UsuÃ¡rio e Senha
        if (body.login && body.senha !== undefined) {
          const loginBusca = String(body.login).trim().toLowerCase();
          const senhaBusca = String(body.senha).trim();
          sup = db.prepare(`
            SELECT id, nome, login, telefone, token_acesso, ativo 
            FROM supervisores 
            WHERE LOWER(TRIM(login)) = ? AND TRIM(senha) = ? AND ativo = 1
          `).get(loginBusca, senhaBusca);
        }
        // 2. Login por Token direto (link mÃ³vel)
        else if (body.token) {
          sup = db.prepare('SELECT id, nome, login, telefone, pin, token_acesso, ativo FROM supervisores WHERE token_acesso = ? AND ativo = 1').get(body.token);
        }
        // 3. Login por PIN de 4 dÃ­gitos
        else if (body.supervisor_id && body.pin) {
          sup = db.prepare('SELECT id, nome, login, telefone, pin, token_acesso, ativo FROM supervisores WHERE id = ? AND pin = ? AND ativo = 1').get(parseInt(body.supervisor_id, 10), String(body.pin).trim());
        }

        if (!sup) {
          return errorResponse(res, 'UsuÃ¡rio ou senha incorretos. Verifique com o administrador.', 401);
        }
        return jsonResponse(res, { success: true, supervisor: sup });
      }

      // Dados iniciais leves para o smartphone do supervisor
      if (pathname === '/api/supervisor/dados-iniciais' && method === 'GET') {
        const token = query.token;
        const supervisorId = query.supervisor_id ? parseInt(query.supervisor_id, 10) : null;
        let sup = null;
        if (token) {
          sup = db.prepare('SELECT id, nome, login, telefone, pin, token_acesso FROM supervisores WHERE token_acesso = ? AND ativo = 1').get(token);
        } else if (supervisorId) {
          sup = db.prepare('SELECT id, nome, login, telefone, pin, token_acesso FROM supervisores WHERE id = ? AND ativo = 1').get(supervisorId);
        }

        const supervisoresAtivos = db.prepare('SELECT id, nome, login, telefone, token_acesso FROM supervisores WHERE ativo = 1 ORDER BY nome ASC').all();
        const clientes = db.prepare('SELECT id, nome_fantasia, nome_razao_social, cnpj FROM clientes WHERE ativo = 1 ORDER BY nome_fantasia ASC').all();
        const unidades = db.prepare('SELECT id, cliente_id, nome_unidade, endereco, responsavel_local FROM unidades WHERE ativo = 1 ORDER BY nome_unidade ASC').all();
        const colaboradores = db.prepare(`
          SELECT c.id, c.nome, c.cliente_id, c.cargo_id, cg.nome_cargo,
                 COALESCE(c.escala, p.escala, '12x36') as escala,
                 COALESCE(c.unidade_id, p.unidade_id) as unidade_id,
                 c.posto_trabalho_id,
                 p.nome_posto,
                 p.turno as turno_posto,
                 p.escala as escala_posto
          FROM colaboradores c
          LEFT JOIN cargos cg ON c.cargo_id = cg.id
          LEFT JOIN postos_trabalho p ON c.posto_trabalho_id = p.id
          WHERE c.status_colaborador = 'Ativo'
          ORDER BY c.nome ASC
        `).all();
        const freelancers = db.prepare('SELECT id, nome, chave_pix, valor_diaria_padrao FROM freelancers WHERE ativo = 1 ORDER BY nome ASC').all();

        return jsonResponse(res, {
          supervisor: sup || null,
          supervisores: supervisoresAtivos,
          clientes,
          unidades,
          colaboradores,
          freelancers,
          motivos_padrao: [
            'Falta Injustificada',
            'Atestado MÃ©dico / LicenÃ§a',
            'Falta Justificada (Problema Familiar / Pessoal)',
            'Atraso Excessivo / NÃ£o Comparecimento',
            'SuspensÃ£o Disciplinar',
            'Outro'
          ],
          turnos_padrao: [
            '12x36',
            'Comercial 5x2 (08h Ã s 17h)',
            'Escala 6x1',
            'Outro'
          ],
          motivos_nao_cobertura_padrao: [
            'Reserva TÃ©cnica 100% alocada em outros postos',
            'Aviso de falta recebido em cima da hora (sem tempo hÃ¡bil)',
            'Cliente dispensou cobertura neste plantÃ£o',
            'Nenhum colaborador disponÃ­vel para dobra',
            'Outro'
          ]
        });
      }

      // LanÃ§amento da falta pelo supervisor de campo
      if (pathname === '/api/supervisor/lancar-falta' && method === 'POST') {
        const body = await parseRequestBody(req);
        const {
          supervisor_id, data_falta, cliente_id, unidade_id, colaborador_id,
          turno, motivo_falta, dias_afastamento, cid_atestado,
          houve_cobertura, tipo_cobertura, cobertor_colaborador_id, cobertor_nome_manual,
          freelancer_id, valor_pago_freelance, motivo_nao_cobertura, observacoes_operacao
        } = body;

        if (!data_falta || !cliente_id || !unidade_id || !colaborador_id) {
          return errorResponse(res, 'Data, Cliente, Unidade e Colaborador Ausente sÃ£o obrigatÃ³rios', 400);
        }

        let supNome = 'Supervisor de Campo';
        if (supervisor_id) {
          const sup = db.prepare('SELECT nome FROM supervisores WHERE id = ?').get(parseInt(supervisor_id, 10));
          if (sup) supNome = sup.nome;
        }

        const colab = db.prepare('SELECT cargo_id FROM colaboradores WHERE id = ?').get(parseInt(colaborador_id, 10));
        const cargoId = colab ? colab.cargo_id : 1;

        const houveCob = houve_cobertura ? 1 : 0;
        let tipoCob = null;
        let cobColabId = null;
        let freeId = null;
        let valorFreelance = 0;
        let statusPagFree = 'N/A';
        let statusFat = 'N/A';
        let valorDescontoSugerido = 0;

        if (houveCob === 1) {
          tipoCob = tipo_cobertura || 'efetivo';
          if (tipoCob === 'efetivo') {
            cobColabId = cobertor_colaborador_id ? parseInt(cobertor_colaborador_id, 10) : null;
          } else if (tipoCob === 'freelancer') {
            freeId = freelancer_id ? parseInt(freelancer_id, 10) : null;
            valorFreelance = parseFloat(valor_pago_freelance) || 0;
            statusPagFree = 'Pendente';
          }
        } else {
          statusFat = 'Pendente';
          const cargoInfo = db.prepare('SELECT valor_diaria_referencia FROM cargos WHERE id = ?').get(cargoId);
          valorDescontoSugerido = cargoInfo ? cargoInfo.valor_diaria_referencia * 1.3 : 150.00;
        }

        let obsFinal = observacoes_operacao || '';
        if (cobertor_nome_manual && !cobColabId && houveCob === 1) {
          obsFinal = `Cobertura realizada por: ${cobertor_nome_manual}. ` + obsFinal;
        }

        const stmt = db.prepare(`
          INSERT INTO faltas_coberturas (
            data_falta, cliente_id, unidade_id, cargo_id, colaborador_id, motivo_falta,
            dias_afastamento, cid_atestado, houve_cobertura, tipo_cobertura,
            cobertor_colaborador_id, freelancer_id, valor_pago_freelance, status_pagamento_freelance,
            status_faturamento, valor_desconto_sugerido, observacoes_operacao,
            supervisor_id, supervisor_nome, origem_lancamento, turno, motivo_nao_cobertura
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          data_falta,
          parseInt(cliente_id, 10),
          parseInt(unidade_id, 10),
          cargoId,
          parseInt(colaborador_id, 10),
          motivo_falta || 'Falta Injustificada',
          parseInt(dias_afastamento, 10) || 1,
          cid_atestado || '',
          houveCob,
          tipoCob,
          cobColabId,
          freeId,
          valorFreelance,
          statusPagFree,
          statusFat,
          valorDescontoSugerido,
          obsFinal,
          supervisor_id ? parseInt(supervisor_id, 10) : null,
          supNome,
          'mobile_supervisor',
          turno || '',
          motivo_nao_cobertura || ''
        );

        return jsonResponse(res, {
          success: true,
          id: result.lastInsertRowid,
          message: 'OcorrÃªncia registrada com sucesso e transmitida ao sistema!'
        });
      }

      // HistÃ³rico dos Ãºltimos lanÃ§amentos do supervisor
      if (pathname === '/api/supervisor/minhas-faltas' && method === 'GET') {
        const supervisorId = query.supervisor_id ? parseInt(query.supervisor_id, 10) : null;
        let sql = `
          SELECT fc.*,
                 c.nome_fantasia as cliente_nome,
                 u.nome_unidade,
                 cg.nome_cargo,
                 col.nome as colaborador_nome,
                 cobertor.nome as cobertor_efetivo_nome,
                 free.nome as freelancer_nome
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          LEFT JOIN colaboradores cobertor ON fc.cobertor_colaborador_id = cobertor.id
          LEFT JOIN freelancers free ON fc.freelancer_id = free.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];
        if (supervisorId) {
          sql += ` AND fc.supervisor_id = ? `;
          params.push(supervisorId);
        } else {
          sql += ` AND fc.origem_lancamento = 'mobile_supervisor' `;
        }
        sql += ` ORDER BY fc.id DESC LIMIT 25 `;
        const rows = db.prepare(sql).all(...params);
        return jsonResponse(res, rows);
      }

      // FATURAMENTO
      if (pathname === '/api/faturamento' && method === 'GET') {
        let sql = `
          SELECT fc.*,
                 c.nome_fantasia as cliente_nome,
                 c.cnpj as cliente_cnpj,
                 u.nome_unidade,
                 cg.nome_cargo,
                 col.nome as colaborador_faltante_nome
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          WHERE fc.houve_cobertura = 0
        `;
        const params = [];
        if (query.mes) {
          sql += ` AND strftime('%Y-%m', fc.data_falta) = ? `;
          params.push(query.mes);
        }
        if (query.status_faturamento) {
          sql += ` AND fc.status_faturamento = ? `;
          params.push(query.status_faturamento);
        }
        sql += ` ORDER BY fc.data_falta DESC `;
        const itens = db.prepare(sql).all(...params);
        return jsonResponse(res, itens);
      }

      if (pathname.startsWith('/api/faturamento/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        db.prepare(`
          UPDATE faltas_coberturas SET 
            status_faturamento = ?,
            numero_fatura_desconto = ?,
            valor_desconto_sugerido = ?,
            data_desconto_faturamento = ?,
            observacao_faturamento = ?
          WHERE id = ? AND houve_cobertura = 0
        `).run(
          body.status_faturamento || 'Descontado na Fatura',
          body.numero_fatura_desconto || '',
          parseFloat(body.valor_desconto_sugerido) || 0,
          body.data_desconto_faturamento || new Date().toISOString().split('T')[0],
          body.observacao_faturamento || '',
          id
        );
        return jsonResponse(res, { success: true });
      }

      // FREELANCERS FECHAMENTO
      if (pathname === '/api/freelancers/fechamento' && method === 'GET') {
        const mesFiltro = query.mes || new Date().toISOString().slice(0, 7);
        const fechamento = db.prepare(`
          SELECT 
            f.id as freelancer_id,
            f.nome,
            f.telefone,
            f.tipo_chave_pix,
            f.chave_pix,
            f.banco,
            f.valor_diaria_padrao,
            COUNT(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL) THEN fc.id END) as total_diarias_mes,
            COALESCE(SUM(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL) THEN fc.valor_pago_freelance ELSE 0 END), 0) as valor_total_mes,
            COALESCE(SUM(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL) AND fc.status_pagamento_freelance = 'Pendente' THEN fc.valor_pago_freelance ELSE 0 END), 0) as valor_pendente,
            COALESCE(SUM(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL) AND fc.status_pagamento_freelance = 'Pago' THEN fc.valor_pago_freelance ELSE 0 END), 0) as valor_pago
          FROM freelancers f
          LEFT JOIN faltas_coberturas fc ON fc.freelancer_id = f.id
          WHERE f.ativo = 1
          GROUP BY f.id
          ORDER BY valor_total_mes DESC, f.nome ASC
        `).all(mesFiltro, mesFiltro, mesFiltro, mesFiltro);

        for (const free of fechamento) {
          free.coberturas = db.prepare(`
            SELECT fc.id, fc.data_falta, fc.valor_pago_freelance, fc.status_pagamento_freelance,
                   c.nome_fantasia as cliente_nome, u.nome_unidade, cg.nome_cargo, col.nome as faltante_nome
            FROM faltas_coberturas fc
            JOIN clientes c ON fc.cliente_id = c.id
            JOIN unidades u ON fc.unidade_id = u.id
            JOIN cargos cg ON fc.cargo_id = cg.id
            JOIN colaboradores col ON fc.colaborador_id = col.id
            WHERE fc.freelancer_id = ? AND strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL)
            ORDER BY fc.data_falta ASC
          `).all(free.freelancer_id, mesFiltro);
        }

        return jsonResponse(res, fechamento);
      }

      if (pathname === '/api/freelancers/pagar' && method === 'POST') {
        const { freelancer_id, mes, falta_id } = await parseRequestBody(req);
        const dataPagamento = new Date().toISOString().split('T')[0];

        if (falta_id) {
          db.prepare(`
            UPDATE faltas_coberturas 
            SET status_pagamento_freelance = 'Pago', data_pagamento_freelance = ?
            WHERE id = ?
          `).run(dataPagamento, parseInt(falta_id, 10));
        } else if (freelancer_id && mes) {
          db.prepare(`
            UPDATE faltas_coberturas 
            SET status_pagamento_freelance = 'Pago', data_pagamento_freelance = ?
            WHERE freelancer_id = ? AND strftime('%Y-%m', data_falta) = ?
          `).run(dataPagamento, parseInt(freelancer_id, 10), mes);
        }

        return jsonResponse(res, { success: true });
      }

      // DIRETORIA DASHBOARD
      if (pathname === '/api/diretoria/dashboard' && method === 'GET') {
        const mesFiltro = query.mes || new Date().toISOString().slice(0, 7);

        const stats = db.prepare(`
          SELECT 
            COUNT(*) as total_faltas,
            SUM(CASE WHEN houve_cobertura = 1 THEN 1 ELSE 0 END) as total_cobertas,
            SUM(CASE WHEN houve_cobertura = 1 AND tipo_cobertura = 'efetivo' THEN 1 ELSE 0 END) as cobertas_efetivo,
            SUM(CASE WHEN houve_cobertura = 1 AND tipo_cobertura IN ('freelancer', 'efetivo_dobra') THEN 1 ELSE 0 END) as cobertas_freelance,
            SUM(CASE WHEN houve_cobertura = 0 THEN 1 ELSE 0 END) as total_descobertas,
            SUM(CASE WHEN houve_cobertura = 1 AND tipo_cobertura IN ('freelancer', 'efetivo_dobra') THEN valor_pago_freelance ELSE 0 END) as custo_total_freelance,
            SUM(CASE WHEN houve_cobertura = 0 THEN valor_desconto_sugerido ELSE 0 END) as total_desconto_faturamento
          FROM faltas_coberturas
          WHERE strftime('%Y-%m', data_falta) = ? AND (excluido = 0 OR excluido IS NULL)
        `).get(mesFiltro);

        const porCliente = db.prepare(`
          SELECT 
            c.id as cliente_id,
            COALESCE(NULLIF(c.nome_fantasia, ''), NULLIF(c.nome_razao_social, ''), 'Cliente #' || c.id) as cliente_nome,
            COALESCE(NULLIF(c.nome_fantasia, ''), NULLIF(c.nome_razao_social, ''), 'Cliente #' || c.id) as nome_fantasia,
            COUNT(fc.id) as total_faltas
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          WHERE strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL)
          GROUP BY c.id
          ORDER BY total_faltas DESC
        `).all(mesFiltro);

        const relatorioDiretoria = db.prepare(`
          SELECT 
            fc.data_falta, c.nome_fantasia as cliente, u.nome_unidade as unidade,
            cg.nome_cargo as posto, col.nome as faltante, fc.houve_cobertura, fc.tipo_cobertura,
            CASE 
              WHEN fc.houve_cobertura = 0 THEN 'POSTO DESCOBERTO'
              WHEN fc.tipo_cobertura = 'efetivo' THEN 'Colaborador: ' || cobertor.nome
              WHEN fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') THEN 'Freelance: ' || free.nome
            END as quem_cobriu,
            fc.valor_pago_freelance as custo_cobertura,
            fc.valor_desconto_sugerido as valor_glosa
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          LEFT JOIN colaboradores cobertor ON fc.cobertor_colaborador_id = cobertor.id
          LEFT JOIN freelancers free ON fc.freelancer_id = free.id
          WHERE strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL)
          ORDER BY fc.data_falta DESC
        `).all(mesFiltro);

        return jsonResponse(res, {
          mes: mesFiltro,
          stats: stats || {},
          porCliente,
          relatorioDiretoria
        });
      }

      // ===========================================================
      // 10. DASHBOARD EXECUTIVO & CENTRAL DE RELATÃ“RIOS MULTISETORIAL
      // ===========================================================

      // DASHBOARD EXECUTIVO CONSOLIDADO
      if (pathname === '/api/dashboard/executivo' && method === 'GET') {
        const mes = query.mes || new Date().toISOString().slice(0, 7);

        // 1. Clientes e Postos
        const totalClientes = db.prepare('SELECT COUNT(*) as count FROM clientes WHERE ativo = 1').get().count;
        const totalUnidades = db.prepare('SELECT COUNT(*) as count FROM unidades WHERE ativo = 1').get().count;
        const postosStats = db.prepare(`
          SELECT 
            COUNT(*) as total_postos,
            COALESCE(SUM(quantidade_vagas_limite), 0) as total_vagas_contratadas
          FROM postos_trabalho 
          WHERE ativo = 1
        `).get();
        const vagasOcupadas = db.prepare('SELECT COUNT(*) as count FROM colaboradores WHERE posto_trabalho_id IS NOT NULL AND ativo = 1').get().count;
        const vagasAbertas = Math.max(0, postosStats.total_vagas_contratadas - vagasOcupadas);

        // 2. Colaboradores
        const totalColabAtivos = db.prepare('SELECT COUNT(*) as count FROM colaboradores WHERE ativo = 1').get().count;
        const totalAdmitidosMes = db.prepare("SELECT COUNT(*) as count FROM colaboradores WHERE strftime('%Y-%m', data_admissao) = ?").get(mes).count;
        const totalDemitidosMes = db.prepare("SELECT COUNT(*) as count FROM colaboradores WHERE strftime('%Y-%m', data_demissao) = ?").get(mes).count;
        const totalEmFeriasMes = db.prepare(`
          SELECT COUNT(DISTINCT colaborador_id) as count 
          FROM historico_ferias 
          WHERE (strftime('%Y-%m', data_inicio) = ? OR strftime('%Y-%m', data_fim) = ? OR (? BETWEEN strftime('%Y-%m', data_inicio) AND strftime('%Y-%m', data_fim)))
        `).get(mes, mes, mes).count;

        // FÃ©rias vencendo em 60 dias
        const hoje = new Date();
        const colabsParaFerias = db.prepare('SELECT data_admissao FROM colaboradores WHERE ativo = 1 AND data_admissao IS NOT NULL').all();
        let totalFeriasVencer60d = 0;
        colabsParaFerias.forEach(c => {
          const adm = new Date(c.data_admissao);
          const limite = new Date(adm);
          limite.setMonth(limite.getMonth() + 23);
          const diffDias = Math.ceil((limite - hoje) / (1000 * 60 * 60 * 24));
          if (diffDias <= 60) totalFeriasVencer60d++;
        });

        // 3. Faltas e Postos Descobertos
        const faltasStats = db.prepare(`
          SELECT 
            COUNT(*) as total_faltas,
            SUM(CASE WHEN houve_cobertura = 1 THEN 1 ELSE 0 END) as cobertas,
            SUM(CASE WHEN houve_cobertura = 0 THEN 1 ELSE 0 END) as descobertas,
            SUM(CASE WHEN houve_cobertura = 1 AND tipo_cobertura IN ('freelancer', 'efetivo_dobra') THEN valor_pago_freelance ELSE 0 END) as custo_freelancer_faltas,
            SUM(CASE WHEN houve_cobertura = 0 THEN valor_desconto_sugerido ELSE 0 END) as glosas_faltas
          FROM faltas_coberturas
          WHERE strftime('%Y-%m', data_falta) = ?
        `).get(mes);

        // 4. Freelancers FÃ©rias
        const custoFeriasFreelance = db.prepare(`
          SELECT COALESCE(SUM(valor_acordado_mensal), 0) as total
          FROM coberturas_ferias_mensal
          WHERE ano_mes = ? OR strftime('%Y-%m', data_inicio) = ?
        `).get(mes, mes).total;
        const totalCustoFreelancers = (faltasStats.custo_freelancer_faltas || 0) + custoFeriasFreelance;

        // 5. BenefÃ­cios (VT e VA)
        let configDias = db.prepare('SELECT * FROM beneficios_config_mes WHERE ano_mes = ?').get(mes) || { dias_uteis_5x2: 22, dias_uteis_6x1: 26, dias_uteis_12x36: 15 };
        const colabsBenef = db.prepare(`
          SELECT id, escala, quantidade_passagens_dia, valor_passagem_unitaria, valor_diario_va 
          FROM colaboradores WHERE ativo = 1
        `).all();

        let totalVT = 0;
        let totalVA = 0;
        let faltasAbatidas = 0;
        colabsBenef.forEach(col => {
          let dias = configDias.dias_uteis_5x2;
          if (col.escala.includes('6x1')) dias = configDias.dias_uteis_6x1;
          else if (col.escala.includes('12x36')) dias = configDias.dias_uteis_12x36;
          const faltas = db.prepare("SELECT COUNT(*) as c FROM faltas_coberturas WHERE colaborador_id = ? AND strftime('%Y-%m', data_falta) = ?").get(col.id, mes).c;
          const efetivos = Math.max(0, dias - faltas);
          faltasAbatidas += faltas;
          totalVT += efetivos * (col.quantidade_passagens_dia || 2) * (col.valor_passagem_unitaria || 0);
          totalVA += efetivos * (col.valor_diario_va || 0);
        });

        // 6. Glosas
        const glosasStats = db.prepare(`
          SELECT 
            COALESCE(SUM(valor_desconto_sugerido), 0) as total_glosado,
            COALESCE(SUM(CASE WHEN status_faturamento = 'Descontado na Fatura' THEN valor_desconto_sugerido ELSE 0 END), 0) as total_descontado
          FROM faltas_coberturas
          WHERE houve_cobertura = 0 AND strftime('%Y-%m', data_falta) = ?
        `).get(mes);

        // 7. Compras
        const comprasStats = db.prepare(`
          SELECT 
            COALESCE(SUM(valor_total), 0) as total_pedidos,
            COALESCE(SUM(CASE WHEN status_aprovacao = 'Aprovado' THEN valor_total ELSE 0 END), 0) as total_aprovado
          FROM pedidos_orcamentos_compras
          WHERE ano_mes = ?
        `).get(mes);

        // 8. Comparativos Visuais
        const clientesLota = db.prepare(`
          SELECT 
            c.id, c.nome_fantasia,
            COALESCE((SELECT SUM(quantidade_vagas_limite) FROM postos_trabalho WHERE cliente_id = c.id AND ativo = 1), 0) as contratadas,
            COALESCE((SELECT COUNT(*) FROM colaboradores WHERE cliente_id = c.id AND ativo = 1), 0) as ocupadas
          FROM clientes c
          WHERE c.ativo = 1
          ORDER BY contratadas DESC
          LIMIT 6
        `).all();

        const topFaltasClientes = db.prepare(`
          SELECT 
            c.id as cliente_id,
            COALESCE(NULLIF(c.nome_fantasia, ''), NULLIF(c.nome_razao_social, ''), 'Cliente #' || c.id) as cliente_nome,
            COALESCE(NULLIF(c.nome_fantasia, ''), NULLIF(c.nome_razao_social, ''), 'Cliente #' || c.id) as nome_fantasia,
            COUNT(fc.id) as total_faltas,
            SUM(CASE WHEN fc.houve_cobertura = 0 THEN 1 ELSE 0 END) as faltas_glosa,
            SUM(CASE WHEN fc.houve_cobertura = 1 THEN 1 ELSE 0 END) as faltas_cobertas,
            SUM(CASE WHEN fc.houve_cobertura = 0 THEN fc.valor_desconto_sugerido ELSE 0 END) as total_glosa,
            SUM(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') THEN fc.valor_pago_freelance ELSE 0 END) as total_custo_freelance
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          WHERE strftime('%Y-%m', fc.data_falta) = ? AND (fc.excluido = 0 OR fc.excluido IS NULL)
          GROUP BY c.id
          ORDER BY total_faltas DESC
          LIMIT 10
        `).all(mes);

        return jsonResponse(res, {
          mes,
          kpis: {
            clientes_ativos: totalClientes,
            unidades_totais: totalUnidades,
            postos_totais: postosStats.total_postos,
            vagas_contratadas: postosStats.total_vagas_contratadas,
            vagas_ocupadas: vagasOcupadas,
            vagas_abertas: vagasAbertas,
            colaboradores_ativos: totalColabAtivos,
            colaboradores_admitidos_mes: totalAdmitidosMes,
            colaboradores_demitidos_mes: totalDemitidosMes,
            colaboradores_em_ferias: totalEmFeriasMes,
            ferias_vencer_60d: totalFeriasVencer60d,
            faltas_total_mes: faltasStats.total_faltas || 0,
            faltas_cobertas: faltasStats.cobertas || 0,
            postos_descobertos: faltasStats.descobertas || 0,
            custo_total_freelancers: totalCustoFreelancers,
            beneficios_vt: totalVT,
            beneficios_va: totalVA,
            beneficios_total_geral: totalVT + totalVA,
            faltas_descontadas_beneficios: faltasAbatidas,
            glosas_total: glosasStats.total_glosado,
            glosas_descontadas: glosasStats.total_descontado,
            compras_pedidos_total: comprasStats.total_pedidos,
            compras_pedidos_aprovados: comprasStats.total_aprovado
          },
          clientesLota,
          topFaltasClientes
        });
      }

      // RELATÃ“RIO 1: ADMITIDOS E DEMITIDOS (TURNOVER)
      if (pathname === '/api/relatorios/admitidos-demitidos' && method === 'GET') {
        const mes = query.mes;
        const tipo = query.tipo || 'todos'; // 'todos', 'admitidos', 'demitidos'
        const clienteId = query.cliente_id ? parseInt(query.cliente_id, 10) : null;

        let sql = `
          SELECT col.id, col.nome, col.cpf, col.escala, col.data_admissao, col.data_demissao,
                 col.motivo_demissao, col.status_colaborador, col.ativo,
                 cg.nome_cargo,
                 c.nome_fantasia as cliente_nome,
                 pt.nome_posto
          FROM colaboradores col
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];

        if (mes) {
          if (tipo === 'admitidos') {
            sql += " AND strftime('%Y-%m', col.data_admissao) = ? ";
            params.push(mes);
          } else if (tipo === 'demitidos') {
            sql += " AND strftime('%Y-%m', col.data_demissao) = ? ";
            params.push(mes);
          } else {
            sql += " AND (strftime('%Y-%m', col.data_admissao) = ? OR strftime('%Y-%m', col.data_demissao) = ? OR col.ativo = 1) ";
            params.push(mes, mes);
          }
        } else {
          if (tipo === 'admitidos') sql += " AND col.data_admissao IS NOT NULL ";
          else if (tipo === 'demitidos') sql += " AND (col.status_colaborador = 'Demitido' OR col.ativo = 0) ";
        }

        if (clienteId) {
          sql += " AND col.cliente_id = ? ";
          params.push(clienteId);
        }

        sql += " ORDER BY col.data_admissao DESC, col.nome ASC ";
        const lista = db.prepare(sql).all(...params);

        // Totais e Turnover
        let totalAdmitidos = 0;
        let totalDemitidos = 0;
        let totalAtivos = 0;

        lista.forEach(col => {
          const admMes = col.data_admissao && (!mes || col.data_admissao.startsWith(mes));
          const demMes = col.data_demissao && (!mes || col.data_demissao.startsWith(mes));
          if (admMes) totalAdmitidos++;
          if (demMes) totalDemitidos++;
          if (col.ativo === 1) totalAtivos++;
        });

        const taxaTurnover = totalAtivos > 0 ? (((totalAdmitidos + totalDemitidos) / 2) / totalAtivos) * 100 : 0;

        return jsonResponse(res, {
          mes: mes || 'Geral',
          tipo,
          total_registros: lista.length,
          total_admitidos: totalAdmitidos,
          total_demitidos: totalDemitidos,
          total_ativos: totalAtivos,
          taxa_turnover: parseFloat(taxaTurnover.toFixed(1)),
          colaboradores: lista
        });
      }

      // RELATÃ“RIO 2: FÃ‰RIAS MENSAIS & COBERTURAS
      if (pathname === '/api/relatorios/ferias-mensais' && method === 'GET') {
        const mes = query.mes || new Date().toISOString().slice(0, 7);
        const clienteId = query.cliente_id ? parseInt(query.cliente_id, 10) : null;

        let sql = `
          SELECT hf.id, hf.data_inicio, hf.data_fim, hf.dias_ferias, hf.tipo_ferias,
                 hf.havera_cobertura, hf.tipo_cobertura, hf.valor_cobertura, hf.observacoes,
                 col.id as colaborador_id, col.nome as titular_nome, col.cpf,
                 cg.nome_cargo,
                 c.id as cliente_id, c.nome_fantasia as cliente_nome,
                 pt.nome_posto,
                 free.nome as freelancer_nome, free.chave_pix as freelancer_pix
          FROM historico_ferias hf
          JOIN colaboradores col ON hf.colaborador_id = col.id
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes c ON hf.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON hf.posto_trabalho_id = pt.id
          LEFT JOIN freelancers free ON hf.freelancer_id = free.id
          WHERE (strftime('%Y-%m', hf.data_inicio) = ? OR strftime('%Y-%m', hf.data_fim) = ? OR (? BETWEEN strftime('%Y-%m', hf.data_inicio) AND strftime('%Y-%m', hf.data_fim)))
        `;
        const params = [mes, mes, mes];

        if (clienteId) {
          sql += " AND hf.cliente_id = ? ";
          params.push(clienteId);
        }

        sql += " ORDER BY hf.data_inicio ASC ";
        const ferias = db.prepare(sql).all(...params);

        const totalEmFerias = ferias.length;
        const totalComFreelancer = ferias.filter(f => f.havera_cobertura === 1 && f.freelancer_nome).length;
        const custoTotalCobertura = ferias.reduce((acc, cur) => acc + (cur.valor_cobertura || 0), 0);

        return jsonResponse(res, {
          mes,
          total_em_ferias: totalEmFerias,
          total_cobertos_freelance: totalComFreelancer,
          custo_total_cobertura: custoTotalCobertura,
          ferias
        });
      }

      // RELATÃ“RIO 3: VALOR DOS FREELANCERS & DIÃRIAS
      if (pathname === '/api/relatorios/freelancers' && method === 'GET') {
        const mes = query.mes || new Date().toISOString().slice(0, 7);
        const statusPagamento = query.status_pagamento;

        let sql = `
          SELECT 
            f.id as freelancer_id,
            f.nome,
            f.telefone,
            f.tipo_chave_pix,
            f.chave_pix,
            f.banco,
            f.valor_diaria_padrao,
            COUNT(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? THEN fc.id END) as total_diarias_mes,
            COALESCE(SUM(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? THEN fc.valor_pago_freelance ELSE 0 END), 0) as valor_total_mes,
            COALESCE(SUM(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? AND fc.status_pagamento_freelance = 'Pendente' THEN fc.valor_pago_freelance ELSE 0 END), 0) as valor_pendente,
            COALESCE(SUM(CASE WHEN fc.houve_cobertura = 1 AND fc.tipo_cobertura IN ('freelancer', 'efetivo_dobra') AND strftime('%Y-%m', fc.data_falta) = ? AND fc.status_pagamento_freelance = 'Pago' THEN fc.valor_pago_freelance ELSE 0 END), 0) as valor_pago
          FROM freelancers f
          LEFT JOIN faltas_coberturas fc ON fc.freelancer_id = f.id
          WHERE f.ativo = 1
          GROUP BY f.id
        `;

        if (statusPagamento === 'pendentes') {
          sql += " HAVING valor_pendente > 0 ";
        } else if (statusPagamento === 'pagos') {
          sql += " HAVING valor_pago > 0 ";
        } else {
          sql += " HAVING total_diarias_mes > 0 ";
        }

        sql += " ORDER BY valor_total_mes DESC, f.nome ASC ";
        const freelancers = db.prepare(sql).all(mes, mes, mes, mes);

        // Incluir detalhes dos plantÃµes de cada um
        for (const free of freelancers) {
          free.detalhes_plantoes = db.prepare(`
            SELECT fc.id, fc.data_falta, fc.valor_pago_freelance, fc.status_pagamento_freelance,
                   c.nome_fantasia as cliente_nome, u.nome_unidade, cg.nome_cargo, col.nome as titular_nome
            FROM faltas_coberturas fc
            JOIN clientes c ON fc.cliente_id = c.id
            JOIN unidades u ON fc.unidade_id = u.id
            JOIN cargos cg ON fc.cargo_id = cg.id
            JOIN colaboradores col ON fc.colaborador_id = col.id
            WHERE fc.freelancer_id = ? AND strftime('%Y-%m', fc.data_falta) = ?
            ORDER BY fc.data_falta ASC
          `).all(free.freelancer_id, mes);
        }

        const totalGeral = freelancers.reduce((acc, cur) => acc + cur.valor_total_mes, 0);
        const totalPago = freelancers.reduce((acc, cur) => acc + cur.valor_pago, 0);
        const totalPendente = freelancers.reduce((acc, cur) => acc + cur.valor_pendente, 0);
        const totalDiarias = freelancers.reduce((acc, cur) => acc + cur.total_diarias_mes, 0);

        return jsonResponse(res, {
          mes,
          total_freelancers_acionados: freelancers.length,
          total_diarias_geral: totalDiarias,
          valor_total_geral: totalGeral,
          valor_total_pago: totalPago,
          valor_total_pendente: totalPendente,
          freelancers
        });
      }

      // RELATÃ“RIO 4: GLOSAS E DESCONTOS DE FATURAMENTO
      if (pathname === '/api/relatorios/glosas' && method === 'GET') {
        const mes = query.mes || new Date().toISOString().slice(0, 7);
        const clienteId = query.cliente_id ? parseInt(query.cliente_id, 10) : null;

        let sql = `
          SELECT fc.id, fc.data_falta, fc.motivo_falta, fc.dias_afastamento,
                 fc.valor_desconto_sugerido as valor_glosa,
                 fc.status_faturamento, fc.numero_fatura_desconto, fc.data_desconto_faturamento,
                 c.id as cliente_id, c.nome_fantasia as cliente_nome, c.cnpj as cliente_cnpj,
                 u.nome_unidade, cg.nome_cargo, col.nome as faltante_nome
          FROM faltas_coberturas fc
          JOIN clientes c ON fc.cliente_id = c.id
          JOIN unidades u ON fc.unidade_id = u.id
          JOIN cargos cg ON fc.cargo_id = cg.id
          JOIN colaboradores col ON fc.colaborador_id = col.id
          WHERE fc.houve_cobertura = 0
        `;
        const params = [];

        if (mes) {
          sql += " AND strftime('%Y-%m', fc.data_falta) = ? ";
          params.push(mes);
        }

        if (clienteId) {
          sql += " AND fc.cliente_id = ? ";
          params.push(clienteId);
        }

        sql += " ORDER BY fc.data_falta DESC ";
        const glosas = db.prepare(sql).all(...params);

        const totalGlosas = glosas.length;
        const valorTotalGlosado = glosas.reduce((acc, cur) => acc + (cur.valor_glosa || 0), 0);
        const valorDescontado = glosas.filter(g => g.status_faturamento === 'Descontado na Fatura').reduce((acc, cur) => acc + (cur.valor_glosa || 0), 0);
        const valorPendente = valorTotalGlosado - valorDescontado;

        return jsonResponse(res, {
          mes,
          total_glosas_ocorrencias: totalGlosas,
          valor_total_glosado: valorTotalGlosado,
          valor_descontado_fatura: valorDescontado,
          valor_pendente_glosas: valorPendente,
          glosas
        });
      }

      // RELATÃ“RIO 5: BENEFÃCIOS (VA E VT CALCULADOS SEPARADAMENTE)
      if (pathname === '/api/relatorios/beneficios' && method === 'GET') {
        const mes = query.mes || new Date().toISOString().slice(0, 7);
        const clienteId = query.cliente_id ? parseInt(query.cliente_id, 10) : null;

        let configDias = db.prepare('SELECT * FROM beneficios_config_mes WHERE ano_mes = ?').get(mes);
        if (!configDias) configDias = { dias_uteis_5x2: 22, dias_uteis_6x1: 26, dias_uteis_12x36: 15 };

        let sql = `
          SELECT col.id, col.nome, col.cpf, col.escala, col.linhas_onibus,
                 col.quantidade_passagens_dia, col.valor_passagem_unitaria, col.valor_diario_va,
                 c.id as cliente_id, c.nome_fantasia as cliente_nome, pt.nome_posto
          FROM colaboradores col
          LEFT JOIN clientes c ON col.cliente_id = c.id
          LEFT JOIN postos_trabalho pt ON col.posto_trabalho_id = pt.id
          WHERE col.ativo = 1
        `;
        const params = [];

        if (clienteId) {
          sql += " AND col.cliente_id = ? ";
          params.push(clienteId);
        }

        sql += " ORDER BY col.nome ASC ";
        const colaboradores = db.prepare(sql).all(...params);

        let totalGeralVT = 0;
        let totalGeralVA = 0;
        let totalFaltasAbatidas = 0;
        const itens = [];

        for (const col of colaboradores) {
          const custom = db.prepare('SELECT * FROM beneficios_colaborador_mes WHERE ano_mes = ? AND colaborador_id = ?').get(mes, col.id);
          const faltas = db.prepare("SELECT COUNT(*) as count FROM faltas_coberturas WHERE colaborador_id = ? AND strftime('%Y-%m', data_falta) = ?").get(col.id, mes).count;

          let diasVT, diasVA, passagensDia, tarifaVT, diariaVA, faltasDescontadas = faltas;
          let diasPrevistos = configDias.dias_uteis_5x2;
          if (col.escala.includes('6x1')) diasPrevistos = configDias.dias_uteis_6x1;
          else if (col.escala.includes('12x36')) diasPrevistos = configDias.dias_uteis_12x36;

          if (custom && custom.customizado) {
            diasVT = custom.dias_vt !== null && custom.dias_vt !== undefined ? custom.dias_vt : Math.max(0, diasPrevistos - faltas);
            diasVA = custom.dias_va !== null && custom.dias_va !== undefined ? custom.dias_va : Math.max(0, diasPrevistos - faltas);
            passagensDia = custom.passagens_dia !== null && custom.passagens_dia !== undefined ? custom.passagens_dia : (col.quantidade_passagens_dia || 2);
            tarifaVT = custom.tarifa_vt !== null && custom.tarifa_vt !== undefined ? custom.tarifa_vt : (col.valor_passagem_unitaria || 4.40);
            diariaVA = custom.diaria_va !== null && custom.diaria_va !== undefined ? custom.diaria_va : (col.valor_diario_va || 28.00);
            faltasDescontadas = custom.faltas_descontadas !== null && custom.faltas_descontadas !== undefined ? custom.faltas_descontadas : faltas;
          } else {
            const diasEfetivos = Math.max(0, diasPrevistos - faltas);
            diasVT = diasEfetivos;
            diasVA = diasEfetivos;
            passagensDia = col.quantidade_passagens_dia || 2;
            tarifaVT = col.valor_passagem_unitaria || 4.40;
            diariaVA = col.valor_diario_va || 28.00;
          }

          // CÃ¡lculo SEPARADO estrito de VT e VA
          const valorVTTotal = diasVT * passagensDia * tarifaVT;
          const valorVATotal = diasVA * diariaVA;
          const totalColaborador = valorVTTotal + valorVATotal;

          totalGeralVT += valorVTTotal;
          totalGeralVA += valorVATotal;
          totalFaltasAbatidas += faltasDescontadas;

          itens.push({
            colaborador_id: col.id,
            nome: col.nome,
            cpf: col.cpf || '',
            cliente_nome: col.cliente_nome || 'Reserva TÃ©cnica',
            nome_posto: col.nome_posto || 'Sem posto',
            escala: col.escala,
            linhas_onibus: col.linhas_onibus || 'Municipal',
            quantidade_passagens_dia: passagensDia,
            valor_passagem_unitaria: tarifaVT,
            valor_diario_va: diariaVA,
            dias_previstos: diasPrevistos,
            faltas_mes: faltasDescontadas,
            dias_efetivos: diasVT,
            total_vt: parseFloat(valorVTTotal.toFixed(2)),
            total_va: parseFloat(valorVATotal.toFixed(2)),
            total_beneficios_colaborador: parseFloat(totalColaborador.toFixed(2)),
            customizado: !!(custom && custom.customizado)
          });
        }

        const totalBeneficiosGeral = totalGeralVT + totalGeralVA;
        const mediaPorColaborador = itens.length > 0 ? (totalBeneficiosGeral / itens.length) : 0;

        return jsonResponse(res, {
          mes,
          total_colaboradores: itens.length,
          total_geral_vt: parseFloat(totalGeralVT.toFixed(2)),
          total_geral_va: parseFloat(totalGeralVA.toFixed(2)),
          total_geral_beneficios: parseFloat(totalBeneficiosGeral.toFixed(2)),
          total_faltas_descontadas: totalFaltasAbatidas,
          media_por_colaborador: parseFloat(mediaPorColaborador.toFixed(2)),
          itens
        });
      }

      // COMPRAS MATRIZ E GESTÃƒO MULTI-PRÃ‰DIOS
      if (pathname === '/api/compras/matriz' && method === 'GET') {
        const clienteId = parseInt(query.cliente_id, 10);
        const anoMes = query.ano_mes || new Date().toISOString().slice(0, 7);
        if (!clienteId) return errorResponse(res, 'cliente_id Ã© obrigatÃ³rio', 400);

        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);
        if (!cliente) return errorResponse(res, 'Cliente nÃ£o encontrado', 404);

        const pedido = obterOuCriarPedidoCompras(clienteId, anoMes);
        const unidades = db.prepare('SELECT * FROM unidades WHERE cliente_id = ? AND ativo = 1 ORDER BY nome_unidade ASC').all(clienteId);
        const produtos = db.prepare("SELECT * FROM produtos_insumos WHERE ativo = 1 AND categoria IN ('QuÃ­micos', 'AcessÃ³rios', 'DescartÃ¡veis', 'Higiene', 'Limpeza Geral', 'EPIs', 'Uniformes') ORDER BY categoria ASC, descricao ASC").all();

        const itens = db.prepare('SELECT unidade_id, produto_id, quantidade, preco_unitario_aplicado FROM pedido_itens_unidade WHERE pedido_id = ?').all(pedido.id);
        const statusUnidades = db.prepare('SELECT * FROM pedido_unidade_status WHERE pedido_id = ?').all(pedido.id);

        return jsonResponse(res, {
          cliente,
          ano_mes: anoMes,
          pedido,
          unidades,
          produtos,
          itens,
          status_unidades: statusUnidades
        });
      }

      if (pathname === '/api/compras/links-unidades' && method === 'GET') {
        const clienteId = parseInt(query.cliente_id, 10);
        const anoMes = query.ano_mes || new Date().toISOString().slice(0, 7);
        if (!clienteId) return errorResponse(res, 'cliente_id Ã© obrigatÃ³rio', 400);

        const cliente = db.prepare('SELECT id, nome_fantasia, nome_razao_social, cnpj FROM clientes WHERE id = ?').get(clienteId);
        if (!cliente) return errorResponse(res, 'Cliente nÃ£o encontrado', 404);

        const pedido = obterOuCriarPedidoCompras(clienteId, anoMes);

        const unidades = db.prepare(`
          SELECT 
            u.id as unidade_id,
            u.nome_unidade,
            u.endereco,
            u.responsavel_local,
            u.telefone_local,
            COALESCE(pus.status, 'Pendente') as status_preenchimento,
            pus.responsavel_nome,
            pus.responsavel_telefone,
            pus.data_envio,
            pus.observacoes,
            pus.token_acesso,
            COALESCE((SELECT SUM(piu.quantidade) FROM pedido_itens_unidade piu WHERE piu.pedido_id = ? AND piu.unidade_id = u.id), 0) as total_itens,
            COALESCE((SELECT SUM(piu.quantidade * piu.preco_unitario_aplicado) FROM pedido_itens_unidade piu WHERE piu.pedido_id = ? AND piu.unidade_id = u.id), 0) as valor_total
          FROM unidades u
          LEFT JOIN pedido_unidade_status pus ON pus.unidade_id = u.id AND pus.pedido_id = ?
          WHERE u.cliente_id = ? AND u.ativo = 1
          ORDER BY u.nome_unidade ASC
        `).all(pedido.id, pedido.id, pedido.id, clienteId);

        const totalUnidades = unidades.length;
        const preenchidas = unidades.filter(u => u.status_preenchimento !== 'Pendente').length;
        const pendentes = totalUnidades - preenchidas;
        const totalItensGeral = unidades.reduce((acc, u) => acc + u.total_itens, 0);
        const valorTotalGeral = unidades.reduce((acc, u) => acc + u.valor_total, 0);

        return jsonResponse(res, {
          cliente,
          ano_mes: anoMes,
          pedido_id: pedido.id,
          token_publico: pedido.token_publico,
          kpis: {
            total_unidades: totalUnidades,
            total_preenchidas: preenchidas,
            total_pendentes: pendentes,
            total_itens_geral: totalItensGeral,
            valor_total_geral: parseFloat(valorTotalGeral.toFixed(2))
          },
          unidades
        });
      }

      if (pathname === '/api/compras/consolidado-cliente' && method === 'GET') {
        const clienteId = parseInt(query.cliente_id, 10);
        const anoMes = query.ano_mes || new Date().toISOString().slice(0, 7);
        if (!clienteId) return errorResponse(res, 'cliente_id Ã© obrigatÃ³rio', 400);

        const cliente = db.prepare('SELECT id, nome_fantasia, nome_razao_social, cnpj FROM clientes WHERE id = ?').get(clienteId);
        if (!cliente) return errorResponse(res, 'Cliente nÃ£o encontrado', 404);

        const pedido = obterOuCriarPedidoCompras(clienteId, anoMes);

        // Produtos consolidados com somatÃ³rio de quantidades em todos os prÃ©dios
        const produtos = db.prepare(`
          SELECT 
            pi.id as produto_id,
            pi.codigo_referencia,
            pi.descricao,
            pi.unidade_medida,
            pi.categoria,
            pi.preco_anual_fechado,
            f.nome_empresa as fornecedor_nome,
            COALESCE(SUM(piu.quantidade), 0) as quantidade_total,
            COALESCE(SUM(piu.quantidade * piu.preco_unitario_aplicado), 0) as valor_total
          FROM produtos_insumos pi
          LEFT JOIN pedido_itens_unidade piu ON piu.produto_id = pi.id AND piu.pedido_id = ?
          LEFT JOIN fornecedores f ON pi.fornecedor_id = f.id
          WHERE pi.ativo = 1 AND pi.categoria IN ('QuÃ­micos', 'AcessÃ³rios', 'DescartÃ¡veis', 'Higiene', 'Limpeza Geral', 'EPIs', 'Uniformes')
          GROUP BY pi.id
          ORDER BY pi.categoria ASC, pi.descricao ASC
        `).all(pedido.id);

        // Resumo de cada um dos prÃ©dios/unidades
        const unidadesResumo = db.prepare(`
          SELECT 
            u.id as unidade_id,
            u.nome_unidade,
            u.responsavel_local,
            COALESCE(pus.status, 'Pendente') as status_preenchimento,
            pus.responsavel_nome,
            pus.data_envio,
            COALESCE((SELECT SUM(piu.quantidade) FROM pedido_itens_unidade piu WHERE piu.pedido_id = ? AND piu.unidade_id = u.id), 0) as total_itens,
            COALESCE((SELECT SUM(piu.quantidade * piu.preco_unitario_aplicado) FROM pedido_itens_unidade piu WHERE piu.pedido_id = ? AND piu.unidade_id = u.id), 0) as valor_total
          FROM unidades u
          LEFT JOIN pedido_unidade_status pus ON pus.unidade_id = u.id AND pus.pedido_id = ?
          WHERE u.cliente_id = ? AND u.ativo = 1
          ORDER BY u.nome_unidade ASC
        `).all(pedido.id, pedido.id, pedido.id, clienteId);

        // Grade de itens
        const todosItens = db.prepare('SELECT unidade_id, produto_id, quantidade, preco_unitario_aplicado FROM pedido_itens_unidade WHERE pedido_id = ?').all(pedido.id);

        const totalItensGeral = produtos.reduce((acc, p) => acc + p.quantidade_total, 0);
        const valorTotalGeral = produtos.reduce((acc, p) => acc + p.valor_total, 0);

        return jsonResponse(res, {
          cliente,
          ano_mes: anoMes,
          pedido_id: pedido.id,
          kpis: {
            total_predios: unidadesResumo.length,
            predios_preenchidos: unidadesResumo.filter(u => u.status_preenchimento !== 'Pendente').length,
            total_itens_geral: totalItensGeral,
            valor_total_geral: parseFloat(valorTotalGeral.toFixed(2))
          },
          produtos,
          unidades: unidadesResumo,
          itens_matriz: todosItens
        });
      }

      if (pathname === '/api/compras/unidade-pedido' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { cliente_id, ano_mes, unidade_id, responsavel_nome, responsavel_telefone, observacoes, itens } = body;
        if (!cliente_id || !ano_mes || !unidade_id) {
          return errorResponse(res, 'cliente_id, ano_mes e unidade_id sÃ£o obrigatÃ³rios', 400);
        }

        const pedido = obterOuCriarPedidoCompras(cliente_id, ano_mes);

        // Limpar itens anteriores dessa unidade neste pedido
        db.prepare('DELETE FROM pedido_itens_unidade WHERE pedido_id = ? AND unidade_id = ?').run(pedido.id, unidade_id);

        const prods = db.prepare('SELECT id, preco_anual_fechado FROM produtos_insumos').all();
        const mapPrecos = new Map(prods.map(p => [p.id, p.preco_anual_fechado]));

        const stmtInsert = db.prepare(`
          INSERT INTO pedido_itens_unidade (pedido_id, unidade_id, produto_id, quantidade, preco_unitario_aplicado)
          VALUES (?, ?, ?, ?, ?)
        `);

        let totalItens = 0;
        for (const it of (itens || [])) {
          const qtd = parseInt(it.quantidade, 10) || 0;
          if (qtd > 0) {
            stmtInsert.run(pedido.id, unidade_id, it.produto_id, qtd, mapPrecos.get(it.produto_id) || 0);
            totalItens += qtd;
          }
        }

        const statusFinal = totalItens > 0 ? 'Preenchido Manualmente' : 'Pendente';
        db.prepare(`
          INSERT INTO pedido_unidade_status (pedido_id, unidade_id, status, responsavel_nome, responsavel_telefone, data_envio, observacoes)
          VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)
          ON CONFLICT(pedido_id, unidade_id) DO UPDATE SET
            status = excluded.status,
            responsavel_nome = COALESCE(NULLIF(excluded.responsavel_nome, ''), pedido_unidade_status.responsavel_nome),
            responsavel_telefone = COALESCE(NULLIF(excluded.responsavel_telefone, ''), pedido_unidade_status.responsavel_telefone),
            data_envio = datetime('now', 'localtime'),
            observacoes = excluded.observacoes
        `).run(pedido.id, unidade_id, statusFinal, responsavel_nome || '', responsavel_telefone || '', observacoes || '');

        return jsonResponse(res, { success: true, message: 'Pedido da unidade salvo com sucesso!', total_itens: totalItens });
      }

      if (pathname === '/api/publico/pedido-unidade' && method === 'GET') {
        const token = query.token;
        const clienteIdParam = query.cliente_id ? parseInt(query.cliente_id, 10) : null;
        const anoMesParam = query.ano_mes;
        const unidadeIdParam = query.unidade_id ? parseInt(query.unidade_id, 10) : null;

        let pedido = null;
        let unidadeFixa = null;
        let tipoAcesso = 'geral';

        if (token) {
          const pus = db.prepare(`
            SELECT pus.*, pcm.ano_mes, pcm.cliente_id 
            FROM pedido_unidade_status pus
            JOIN pedidos_compras_mensal pcm ON pus.pedido_id = pcm.id
            WHERE pus.token_acesso = ?
          `).get(token);

          if (pus) {
            pedido = { id: pus.pedido_id, ano_mes: pus.ano_mes, cliente_id: pus.cliente_id };
            unidadeFixa = db.prepare('SELECT * FROM unidades WHERE id = ?').get(pus.unidade_id);
            tipoAcesso = 'individual';
          } else {
            pedido = db.prepare('SELECT * FROM pedidos_compras_mensal WHERE token_publico = ?').get(token);
            if (pedido && unidadeIdParam) {
              unidadeFixa = db.prepare('SELECT * FROM unidades WHERE id = ? AND cliente_id = ?').get(unidadeIdParam, pedido.cliente_id);
              if (unidadeFixa) tipoAcesso = 'individual';
            }
          }
        } else if (clienteIdParam && anoMesParam) {
          pedido = obterOuCriarPedidoCompras(clienteIdParam, anoMesParam);
          if (unidadeIdParam) {
            unidadeFixa = db.prepare('SELECT * FROM unidades WHERE id = ? AND cliente_id = ?').get(unidadeIdParam, clienteIdParam);
            if (unidadeFixa) tipoAcesso = 'individual';
          }
        }

        if (!pedido) {
          return errorResponse(res, 'Link invÃ¡lido ou nÃ£o localizado. Entre em contato com a administraÃ§Ã£o.', 404);
        }

        const cliente = db.prepare('SELECT id, nome_fantasia, nome_razao_social, cnpj FROM clientes WHERE id = ?').get(pedido.cliente_id);
        const unidades = db.prepare('SELECT id, nome_unidade, endereco, responsavel_local, telefone_local FROM unidades WHERE cliente_id = ? AND ativo = 1 ORDER BY nome_unidade ASC').all(pedido.cliente_id);

        let produtos = db.prepare(`
          SELECT id, codigo_referencia, descricao, unidade_medida, categoria, preco_anual_fechado, fornecedor_id
          FROM produtos_insumos
          WHERE ativo = 1 AND categoria IN ('QuÃ­micos', 'AcessÃ³rios', 'DescartÃ¡veis', 'Higiene', 'Limpeza Geral', 'EPIs', 'Uniformes')
          ORDER BY categoria ASC, descricao ASC
        `).all();

        if (unidadeFixa && unidadeFixa.fornecedores_permitidos_json) {
          try {
            const permitidos = JSON.parse(unidadeFixa.fornecedores_permitidos_json);
            if (Array.isArray(permitidos) && permitidos.length > 0) {
              produtos = produtos.filter(p => permitidos.includes(p.fornecedor_id) || permitidos.includes(String(p.fornecedor_id)));
            }
          } catch(e) {}
        }

        let itensSalvos = [];
        let statusUnidade = null;
        if (unidadeFixa) {
          itensSalvos = db.prepare('SELECT produto_id, quantidade FROM pedido_itens_unidade WHERE pedido_id = ? AND unidade_id = ?').all(pedido.id, unidadeFixa.id);
          statusUnidade = db.prepare('SELECT * FROM pedido_unidade_status WHERE pedido_id = ? AND unidade_id = ?').get(pedido.id, unidadeFixa.id);
        }

        return jsonResponse(res, {
          cliente,
          ano_mes: pedido.ano_mes,
          pedido_id: pedido.id,
          tipo_acesso: tipoAcesso,
          unidade_fixa: unidadeFixa,
          status_unidade: statusUnidade,
          unidades,
          produtos,
          itens_salvos: itensSalvos
        });
      }

      if (pathname === '/api/publico/pedido-unidade' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { token, pedido_id, unidade_id, responsavel_nome, responsavel_telefone, observacoes, itens } = body;

        let pedidoId = pedido_id;
        let unidadeId = unidade_id;

        if (token) {
          const pus = db.prepare('SELECT pedido_id, unidade_id FROM pedido_unidade_status WHERE token_acesso = ?').get(token);
          if (pus) {
            pedidoId = pus.pedido_id;
            unidadeId = pus.unidade_id;
          } else {
            const pcm = db.prepare('SELECT id FROM pedidos_compras_mensal WHERE token_publico = ?').get(token);
            if (pcm) {
              pedidoId = pcm.id;
            }
          }
        }

        if (!pedidoId || !unidadeId) {
          return errorResponse(res, 'IdentificaÃ§Ã£o do pedido ou prÃ©dio nÃ£o informada', 400);
        }

        // Limpar itens anteriores dessa unidade
        db.prepare('DELETE FROM pedido_itens_unidade WHERE pedido_id = ? AND unidade_id = ?').run(pedidoId, unidadeId);

        const prods = db.prepare('SELECT id, preco_anual_fechado FROM produtos_insumos').all();
        const mapPrecos = new Map(prods.map(p => [p.id, p.preco_anual_fechado]));

        const stmtInsert = db.prepare(`
          INSERT INTO pedido_itens_unidade (pedido_id, unidade_id, produto_id, quantidade, preco_unitario_aplicado)
          VALUES (?, ?, ?, ?, ?)
        `);

        let totalItens = 0;
        for (const it of (itens || [])) {
          const qtd = parseInt(it.quantidade, 10) || 0;
          if (qtd > 0) {
            stmtInsert.run(pedidoId, unidadeId, it.produto_id, qtd, mapPrecos.get(it.produto_id) || 0);
            totalItens += qtd;
          }
        }

        db.prepare(`
          INSERT INTO pedido_unidade_status (pedido_id, unidade_id, status, responsavel_nome, responsavel_telefone, data_envio, observacoes)
          VALUES (?, ?, 'Enviado pelo ResponsÃ¡vel', ?, ?, datetime('now', 'localtime'), ?)
          ON CONFLICT(pedido_id, unidade_id) DO UPDATE SET
            status = 'Enviado pelo ResponsÃ¡vel',
            responsavel_nome = excluded.responsavel_nome,
            responsavel_telefone = excluded.responsavel_telefone,
            data_envio = datetime('now', 'localtime'),
            observacoes = excluded.observacoes
        `).run(pedidoId, unidadeId, responsavel_nome || 'ResponsÃ¡vel do PrÃ©dio', responsavel_telefone || '', observacoes || '');

        const uni = db.prepare('SELECT nome_unidade FROM unidades WHERE id = ?').get(unidadeId);

        return jsonResponse(res, {
          success: true,
          message: `Pedido do ${uni ? uni.nome_unidade : 'prÃ©dio'} enviado com sucesso!`,
          total_itens: totalItens,
          data_envio: new Date().toLocaleString('pt-BR')
        });
      }

      if (pathname === '/api/compras/matriz' && method === 'POST') {
        const { cliente_id, ano_mes, itens, status } = await parseRequestBody(req);
        let pedido = db.prepare('SELECT id FROM pedidos_compras_mensal WHERE ano_mes = ? AND cliente_id = ?').get(ano_mes, cliente_id);
        let pedidoId;

        if (!pedido) {
          const insertPed = db.prepare('INSERT INTO pedidos_compras_mensal (ano_mes, cliente_id, status) VALUES (?, ?, ?)');
          pedidoId = insertPed.run(ano_mes, cliente_id, status || 'Rascunho').lastInsertRowid;
        } else {
          pedidoId = pedido.id;
          db.prepare('UPDATE pedidos_compras_mensal SET status = ? WHERE id = ?').run(status || 'Rascunho', pedidoId);
        }

        db.prepare('DELETE FROM pedido_itens_unidade WHERE pedido_id = ?').run(pedidoId);
        const prods = db.prepare('SELECT id, preco_anual_fechado FROM produtos_insumos').all();
        const mapPrecos = new Map(prods.map(p => [p.id, p.preco_anual_fechado]));

        const insertItem = db.prepare('INSERT INTO pedido_itens_unidade (pedido_id, unidade_id, produto_id, quantidade, preco_unitario_aplicado) VALUES (?, ?, ?, ?, ?)');
        for (const item of (itens || [])) {
          if (item.quantidade > 0) {
            insertItem.run(pedidoId, item.unidade_id, item.produto_id, item.quantidade, mapPrecos.get(item.produto_id) || 0);
          }
        }

        return jsonResponse(res, { success: true, pedido_id: pedidoId });
      }

      if (pathname === '/api/compras/copiar-mes-anterior' && method === 'POST') {
        const { cliente_id, ano_mes_atual } = await parseRequestBody(req);
        const [ano, mes] = ano_mes_atual.split('-').map(Number);
        const dataAnt = new Date(ano, mes - 2, 1);
        const anoMesAnt = `${dataAnt.getFullYear()}-${String(dataAnt.getMonth() + 1).padStart(2, '0')}`;

        const pedidoAnt = db.prepare('SELECT id FROM pedidos_compras_mensal WHERE ano_mes = ? AND cliente_id = ?').get(anoMesAnt, cliente_id);
        if (!pedidoAnt) return errorResponse(res, `Nenhum pedido anterior encontrado em ${anoMesAnt}`, 404);

        const itens = db.prepare('SELECT unidade_id, produto_id, quantidade FROM pedido_itens_unidade WHERE pedido_id = ?').all(pedidoAnt.id);
        return jsonResponse(res, { copiado_de: anoMesAnt, itens });
      }

      if (pathname === '/api/compras/romaneios' && method === 'GET') {
        const clienteId = parseInt(query.cliente_id, 10);
        const anoMes = query.ano_mes;
        const pedido = db.prepare('SELECT * FROM pedidos_compras_mensal WHERE ano_mes = ? AND cliente_id = ?').get(anoMes, clienteId);
        if (!pedido) return errorResponse(res, 'Nenhum pedido encontrado', 404);

        const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);
        const unidades = db.prepare('SELECT * FROM unidades WHERE cliente_id = ? AND ativo = 1 ORDER BY nome_unidade ASC').all(clienteId);

        const romaneios = [];
        for (const uni of unidades) {
          const itens = db.prepare(`
            SELECT pi.id, pi.codigo_referencia, pi.descricao, pi.unidade_medida, piu.quantidade, piu.preco_unitario_aplicado,
                   (piu.quantidade * piu.preco_unitario_aplicado) as subtotal
            FROM pedido_itens_unidade piu
            JOIN produtos_insumos pi ON piu.produto_id = pi.id
            WHERE piu.pedido_id = ? AND piu.unidade_id = ? AND piu.quantidade > 0
            ORDER BY pi.descricao ASC
          `).all(pedido.id, uni.id);

          const totalUnidade = itens.reduce((acc, cur) => acc + cur.subtotal, 0);
          romaneios.push({ unidade: uni, itens, total_unidade: totalUnidade });
        }

        return jsonResponse(res, { cliente, pedido, ano_mes: anoMes, romaneios });
      }

      if (pathname === '/api/compras/consolidado' && method === 'GET') {
        const anoMes = query.ano_mes || new Date().toISOString().slice(0, 7);
        const consolidado = db.prepare(`
          SELECT 
            pi.id as produto_id, pi.codigo_referencia, pi.descricao, pi.unidade_medida, pi.preco_anual_fechado,
            f.nome_empresa as fornecedor_nome,
            SUM(piu.quantidade) as quantidade_total_comprar,
            SUM(piu.quantidade * piu.preco_unitario_aplicado) as valor_total_compra
          FROM pedido_itens_unidade piu
          JOIN pedidos_compras_mensal pcm ON piu.pedido_id = pcm.id
          JOIN produtos_insumos pi ON piu.produto_id = pi.id
          LEFT JOIN fornecedores f ON pi.fornecedor_id = f.id
          WHERE pcm.ano_mes = ?
          GROUP BY pi.id
          HAVING quantidade_total_comprar > 0
          ORDER BY f.nome_empresa ASC, pi.descricao ASC
        `).all(anoMes);

        const valorTotalGeral = consolidado.reduce((acc, cur) => acc + cur.valor_total_compra, 0);
        return jsonResponse(res, { ano_mes: anoMes, itens: consolidado, valor_total_geral: valorTotalGeral });
      }

      // =============================================================
      // 12. MÃ“DULO COMERCIAL & CRM DE FACILITIES
      // =============================================================

      // LISTAR LEADS COM FILTROS
      if (pathname === '/api/comercial/leads' && method === 'GET') {
        let sql = 'SELECT * FROM leads_comercial WHERE ativo = 1';
        const params = [];
        if (query.etapa) {
          sql += ' AND etapa = ?';
          params.push(query.etapa);
        }
        if (query.segmento) {
          sql += ' AND segmento = ?';
          params.push(query.segmento);
        }
        if (query.busca) {
          sql += ' AND (nome_lead LIKE ? OR nome_fantasia LIKE ? OR contato_nome LIKE ? OR cidade LIKE ?)';
          const term = `%${query.busca}%`;
          params.push(term, term, term, term);
        }
        sql += ' ORDER BY created_at DESC';
        const leads = db.prepare(sql).all(...params);

        for (const l of leads) {
          l.razao_social = l.nome_lead;
          l.valor_mensal_estimado = l.valor_estimado_mensal;
          l.vagas_estimadas = l.quantidade_postos_estimada;
          l.contato_telefone = l.telefone || l.whatsapp;
          l.contato_email = l.email;
          l.origem = l.origem_lead;
          l.total_interacoes = db.prepare('SELECT COUNT(*) as c FROM leads_interacoes WHERE lead_id = ?').get(l.id).c;
          const ult = db.prepare('SELECT * FROM leads_interacoes WHERE lead_id = ? ORDER BY data_interacao DESC, id DESC LIMIT 1').get(l.id);
          l.ultima_interacao = ult ? ult.data_interacao : null;
          l.tipo_ultima_interacao = ult ? ult.tipo : null;
        }

        return jsonResponse(res, leads);
      }

      // OBTER DETALHES DE UM LEAD COM HISTÃ“RICO COMPLETO
      if (pathname.match(/^\/api\/comercial\/leads\/\d+$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[4], 10);
        const lead = db.prepare('SELECT * FROM leads_comercial WHERE id = ?').get(id);
        if (!lead) return errorResponse(res, 'Lead nÃ£o encontrado', 404);

        lead.razao_social = lead.nome_lead;
        lead.valor_mensal_estimado = lead.valor_estimado_mensal;
        lead.vagas_estimadas = lead.quantidade_postos_estimada;
        lead.contato_telefone = lead.telefone || lead.whatsapp;
        lead.contato_email = lead.email;
        lead.origem = lead.origem_lead;
        lead.interacoes = db.prepare('SELECT * FROM leads_interacoes WHERE lead_id = ? ORDER BY data_interacao DESC, id DESC').all(id);
        return jsonResponse(res, lead);
      }

      // CRIAR NOVO LEAD
      if (pathname === '/api/comercial/leads' && method === 'POST') {
        const body = await parseRequestBody(req);
        const nomeLead = body.nome_lead || body.razao_social;
        if (!nomeLead) {
          return errorResponse(res, 'Nome ou RazÃ£o Social do Prospect Ã© obrigatÃ³rio', 400);
        }

        const stmt = db.prepare(`
          INSERT INTO leads_comercial (
            nome_lead, nome_fantasia, cnpj, segmento, contato_nome, contato_cargo,
            telefone, whatsapp, email, cidade, bairro, endereco, origem_lead,
            etapa, probabilidade, valor_estimado_mensal, quantidade_postos_estimada,
            previsao_fechamento, data_inicio_prevista, responsavel_usuario_id, responsavel_nome, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const resLead = stmt.run(
          nomeLead,
          body.nome_fantasia || nomeLead,
          body.cnpj || null,
          body.segmento || 'Facilities & CondomÃ­nios',
          body.contato_nome || null,
          body.contato_cargo || null,
          body.telefone || body.contato_telefone || null,
          body.whatsapp || body.contato_telefone || null,
          body.email || body.contato_email || null,
          body.cidade || 'SÃ£o Paulo',
          body.bairro || null,
          body.endereco || null,
          body.origem_lead || body.origem || 'ProspecÃ§Ã£o Ativa',
          body.etapa || 'prospeccao',
          parseInt(body.probabilidade, 10) || 20,
          parseFloat(body.valor_estimado_mensal || body.valor_mensal_estimado) || 0,
          parseInt(body.quantidade_postos_estimada || body.vagas_estimadas, 10) || 1,
          body.previsao_fechamento || null,
          body.data_inicio_prevista || null,
          body.responsavel_usuario_id ? parseInt(body.responsavel_usuario_id, 10) : null,
          body.responsavel_nome || 'Consultor Comercial',
          body.observacoes || ''
        );

        const newId = resLead.lastInsertRowid;

        // Registrar interaÃ§Ã£o inicial
        db.prepare(`
          INSERT INTO leads_interacoes (lead_id, tipo, descricao, usuario_nome)
          VALUES (?, 'anotacao', 'Oportunidade cadastrada no sistema comercial.', ?)
        `).run(newId, body.responsavel_nome || 'Comercial');

        return jsonResponse(res, { success: true, id: newId, message: 'Lead comercial cadastrado com sucesso!' });
      }

      // ATUALIZAR LEAD (ETAPA, PROBABILIDADE, DADOS)
      if (pathname.match(/^\/api\/comercial\/leads\/\d+$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);
        const leadAtual = db.prepare('SELECT * FROM leads_comercial WHERE id = ?').get(id);
        if (!leadAtual) return errorResponse(res, 'Lead nÃ£o encontrado', 404);

        const stmt = db.prepare(`
          UPDATE leads_comercial SET
            nome_lead = ?, nome_fantasia = ?, cnpj = ?, segmento = ?,
            contato_nome = ?, contato_cargo = ?, telefone = ?, whatsapp = ?, email = ?,
            cidade = ?, bairro = ?, endereco = ?, origem_lead = ?,
            etapa = ?, probabilidade = ?, valor_estimado_mensal = ?, quantidade_postos_estimada = ?,
            previsao_fechamento = ?, data_inicio_prevista = ?, responsavel_nome = ?,
            motivo_perda = ?, observacoes = ?
          WHERE id = ?
        `);

        stmt.run(
          body.nome_lead || leadAtual.nome_lead,
          body.nome_fantasia || leadAtual.nome_fantasia,
          body.cnpj !== undefined ? body.cnpj : leadAtual.cnpj,
          body.segmento || leadAtual.segmento,
          body.contato_nome !== undefined ? body.contato_nome : leadAtual.contato_nome,
          body.contato_cargo !== undefined ? body.contato_cargo : leadAtual.contato_cargo,
          body.telefone !== undefined ? body.telefone : leadAtual.telefone,
          body.whatsapp !== undefined ? body.whatsapp : leadAtual.whatsapp,
          body.email !== undefined ? body.email : leadAtual.email,
          body.cidade !== undefined ? body.cidade : leadAtual.cidade,
          body.bairro !== undefined ? body.bairro : leadAtual.bairro,
          body.endereco !== undefined ? body.endereco : leadAtual.endereco,
          body.origem_lead || leadAtual.origem_lead,
          body.etapa || leadAtual.etapa,
          body.probabilidade !== undefined ? parseInt(body.probabilidade, 10) : leadAtual.probabilidade,
          body.valor_estimado_mensal !== undefined ? parseFloat(body.valor_estimado_mensal) : leadAtual.valor_estimado_mensal,
          body.quantidade_postos_estimada !== undefined ? parseInt(body.quantidade_postos_estimada, 10) : leadAtual.quantidade_postos_estimada,
          body.previsao_fechamento !== undefined ? body.previsao_fechamento : leadAtual.previsao_fechamento,
          body.data_inicio_prevista !== undefined ? body.data_inicio_prevista : leadAtual.data_inicio_prevista,
          body.responsavel_nome !== undefined ? body.responsavel_nome : leadAtual.responsavel_nome,
          body.motivo_perda !== undefined ? body.motivo_perda : leadAtual.motivo_perda,
          body.observacoes !== undefined ? body.observacoes : leadAtual.observacoes,
          id
        );

        // Se a etapa mudou, registrar interaÃ§Ã£o automÃ¡tica no histÃ³rico
        if (body.etapa && body.etapa !== leadAtual.etapa) {
          const etapasNomes = {
            prospeccao: '1. ProspecÃ§Ã£o Inicial',
            visita_tecnica: '2. Visita TÃ©cnica / Levantamento',
            proposta: '3. ElaboraÃ§Ã£o de Proposta',
            negociacao: '4. Em NegociaÃ§Ã£o',
            ganho: '5. Contrato Ganho / Fechado',
            perdido: 'Perdido / Declinado'
          };
          const de = etapasNomes[leadAtual.etapa] || leadAtual.etapa;
          const para = etapasNomes[body.etapa] || body.etapa;
          db.prepare(`
            INSERT INTO leads_interacoes (lead_id, tipo, descricao, usuario_nome)
            VALUES (?, 'followup', ?, ?)
          `).run(id, `Etapa alterada de "${de}" para "${para}".`, body.usuario_nome || 'Comercial');
        }

        return jsonResponse(res, { success: true, message: 'Lead atualizado com sucesso!' });
      }

      // EXCLUIR LEAD
      if (pathname.match(/^\/api\/comercial\/leads\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[4], 10);
        db.prepare('DELETE FROM leads_interacoes WHERE lead_id = ?').run(id);
        db.prepare('DELETE FROM leads_comercial WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Lead excluÃ­do com sucesso!' });
      }

      // ADICIONAR INTERAÃ‡ÃƒO / HISTÃ“RICO AO LEAD
      if (pathname.match(/^\/api\/comercial\/leads\/\d+\/interacoes$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);
        if (!body.descricao) return errorResponse(res, 'DescriÃ§Ã£o da interaÃ§Ã£o Ã© obrigatÃ³ria', 400);

        db.prepare(`
          INSERT INTO leads_interacoes (lead_id, tipo, descricao, usuario_nome)
          VALUES (?, ?, ?, ?)
        `).run(id, body.tipo || 'anotacao', body.descricao, body.usuario_nome || 'Comercial');

        return jsonResponse(res, { success: true, message: 'InteraÃ§Ã£o registrada no histÃ³rico!' });
      }

      // KPIS DO SETOR COMERCIAL
      if (pathname === '/api/comercial/kpis' && method === 'GET') {
        const leadsAtivos = db.prepare("SELECT * FROM leads_comercial WHERE ativo = 1 AND etapa NOT IN ('ganho', 'perdido')").all();
        const leadsGanhos = db.prepare("SELECT * FROM leads_comercial WHERE ativo = 1 AND etapa = 'ganho'").all();
        const leadsPerdidos = db.prepare("SELECT * FROM leads_comercial WHERE ativo = 1 AND etapa = 'perdido'").all();

        const totalAtivos = leadsAtivos.length;
        const totalPipelineValor = leadsAtivos.reduce((acc, l) => acc + (l.valor_estimado_mensal || 0), 0);
        const totalPipelinePonderado = leadsAtivos.reduce((acc, l) => acc + ((l.valor_estimado_mensal || 0) * (l.probabilidade || 0) / 100), 0);
        const totalPostosPipeline = leadsAtivos.reduce((acc, l) => acc + (l.quantidade_postos_estimada || 1), 0);

        const totalFinalizados = leadsGanhos.length + leadsPerdidos.length;
        const taxaConversao = totalFinalizados > 0 ? ((leadsGanhos.length / totalFinalizados) * 100).toFixed(1) : '100.0';
        const valorGanhosMes = leadsGanhos.reduce((acc, l) => acc + (l.valor_estimado_mensal || 0), 0);
        const ticketMedio = leadsGanhos.length > 0 ? valorGanhosMes / leadsGanhos.length : (totalAtivos > 0 ? totalPipelineValor / totalAtivos : 0);

        const porEtapa = {
          prospeccao: leadsAtivos.filter(l => l.etapa === 'prospeccao').length,
          visita_tecnica: leadsAtivos.filter(l => l.etapa === 'visita_tecnica').length,
          proposta: leadsAtivos.filter(l => l.etapa === 'proposta').length,
          negociacao: leadsAtivos.filter(l => l.etapa === 'negociacao').length,
          ganho: leadsGanhos.length,
          perdido: leadsPerdidos.length
        };

        return jsonResponse(res, {
          totalAtivos,
          totalPipelineValor,
          totalPipelinePonderado,
          totalPostosPipeline,
          taxaConversao,
          valorGanhosMes,
          ticketMedio,
          porEtapa
        });
      }

      // EFETIVAÃ‡ÃƒO DE CONTRATO PELO COMERCIAL & ORDEM DE IMPLANTAÃ‡ÃƒO
      if (pathname === '/api/comercial/efetivar-contrato' && method === 'POST') {
        const body = await parseRequestBody(req);
        const razaoSocial = body.nome_razao_social || body.razao_social;
        const dataInicioOperacao = body.data_inicio_operacao;

        if (!razaoSocial || !dataInicioOperacao) {
          return errorResponse(res, 'RazÃ£o Social e Data de InÃ­cio da OperaÃ§Ã£o sÃ£o obrigatÃ³rios', 400);
        }

        // 1. Cadastrar cliente ativo
        const stmtCli = db.prepare(`
          INSERT INTO clientes (nome_razao_social, nome_fantasia, cnpj, contato_responsavel, telefone, email, cota_mensal_insumos, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const resCli = stmtCli.run(
          razaoSocial,
          body.nome_fantasia || razaoSocial,
          body.cnpj || '',
          body.contato_responsavel || body.gestor_cliente || '',
          body.telefone || '',
          body.email || '',
          parseFloat(body.cota_mensal_insumos) || 0,
          body.observacoes || 'Cliente ativado pelo Setor Comercial'
        );
        const clienteId = resCli.lastInsertRowid;

        // Criar Unidade Matriz padrÃ£o para o cliente
        const resUnid = db.prepare(`
          INSERT INTO unidades (cliente_id, nome_unidade, responsavel_local, telefone_local)
          VALUES (?, 'Unidade Principal / Matriz', ?, ?)
        `).run(clienteId, body.contato_responsavel || body.gestor_cliente || '', body.telefone || '');
        const unidadePadraoId = resUnid.lastInsertRowid;

        // 2. Cadastrar os Postos de Trabalho Contratados
        let totalPostos = 0;
        let totalVagas = 0;
        const postosCriadosNomes = [];

        if (body.postos && Array.isArray(body.postos) && body.postos.length > 0) {
          const stmtPosto = db.prepare(`
            INSERT INTO postos_trabalho (cliente_id, unidade_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of body.postos) {
            const limite = parseInt(p.quantidade_vagas_limite || p.quantidade_vagas, 10) || 1;
            let cargoId = parseInt(p.cargo_id, 10);
            if (!cargoId && p.nome_cargo) {
              const c = db.prepare('SELECT id FROM cargos WHERE LOWER(nome_cargo) = LOWER(?)').get(p.nome_cargo);
              cargoId = c ? c.id : 1;
            }
            if (!cargoId) cargoId = 1;

            stmtPosto.run(
              clienteId,
              p.unidade_id ? parseInt(p.unidade_id, 10) : unidadePadraoId,
              p.nome_posto || 'Posto Geral',
              cargoId,
              limite,
              p.escala || '5x2',
              p.turno || 'Comercial',
              p.observacoes || ''
            );
            totalPostos++;
            totalVagas += limite;
            postosCriadosNomes.push(`${p.nome_posto} (${limite} vaga[s], escala ${p.escala || '5x2'})`);
          }
        } else {
          // Criar 1 posto padrÃ£o se nÃ£o informado
          db.prepare(`
            INSERT INTO postos_trabalho (cliente_id, unidade_id, nome_posto, cargo_id, quantidade_vagas_limite, escala, turno, observacoes)
            VALUES (?, ?, 'Portaria / RecepÃ§Ã£o Principal', 2, 2, '12x36', 'Diurno e Noturno', 'Posto gerado na implantaÃ§Ã£o')
          `).run(clienteId, unidadePadraoId);
          totalPostos = 1;
          totalVagas = 2;
          postosCriadosNomes.push('Portaria / RecepÃ§Ã£o Principal (2 vagas, escala 12x36)');
        }

        // 3. Atualizar Lead Comercial (se originado de um lead existente)
        if (body.lead_id) {
          db.prepare(`
            UPDATE leads_comercial SET
              etapa = 'ganho',
              probabilidade = 100,
              cliente_id_convertido = ?,
              data_conversao = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(clienteId, parseInt(body.lead_id, 10));

          db.prepare(`
            INSERT INTO leads_interacoes (lead_id, tipo, descricao, usuario_nome)
            VALUES (?, 'followup', ?, ?)
          `).run(parseInt(body.lead_id, 10), `Contrato efetivado com sucesso! Cliente ID #${clienteId} cadastrado no sistema.`, body.criado_por || 'Comercial');
        }

        // 4. Gerar Ordem de ImplantaÃ§Ã£o
        const anoAtual = new Date().getFullYear();
        const codImplantacao = `IMP-${anoAtual}-${String(clienteId).padStart(3, '0')}`;
        const resOrdem = db.prepare(`
          INSERT INTO ordens_implantacao (
            codigo_implantacao, cliente_id, lead_id, data_inicio_operacao,
            valor_mensal_contratado, total_postos, total_vagas, criado_por, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          codImplantacao,
          clienteId,
          body.lead_id ? parseInt(body.lead_id, 10) : null,
          body.data_inicio_operacao,
          parseFloat(body.valor_mensal_contratado) || 0,
          totalPostos,
          totalVagas,
          body.criado_por || 'Comercial',
          body.observacoes || ''
        );
        const ordemId = resOrdem.lastInsertRowid;

        // 5. Gerar Tarefas AutomÃ¡ticas para cada Setor (RH, BenefÃ­cios, Compras, Operacional, Faturamento)
        const dataInicio = new Date(body.data_inicio_operacao + 'T00:00:00');
        const subtrairDias = (dias) => {
          const d = new Date(dataInicio);
          d.setDate(d.getDate() - dias);
          return d.toISOString().slice(0, 10);
        };

        const tarefasPadrao = [
          {
            setor: 'rh',
            titulo: `Recrutar e selecionar colaboradores para ${totalVagas} vaga(s)`,
            descricao: `Fazer seleÃ§Ã£o, entrevistas, conferÃªncia de documentaÃ§Ã£o e alocaÃ§Ã£o nos postos: ${postosCriadosNomes.join(', ')}.`,
            prazo: subtrairDias(3)
          },
          {
            setor: 'beneficios',
            titulo: 'RoteirizaÃ§Ã£o de Vale Transporte e Vale AlimentaÃ§Ã£o',
            descricao: 'Mapear itinerÃ¡rios das linhas de Ã´nibus/metrÃ´ dos novos colaboradores e prever o valor de VA/VT no fechamento.',
            prazo: subtrairDias(2)
          },
          {
            setor: 'compras',
            titulo: 'Separar Uniformes, EPIs, CrachÃ¡s e Insumos Iniciais',
            descricao: `Providenciar fardamento completo, crachÃ¡s de identificaÃ§Ã£o e materiais iniciais do contrato para os postos: ${postosCriadosNomes.join('; ')}.`,
            prazo: subtrairDias(2)
          },
          {
            setor: 'operacional',
            titulo: 'Visita de Alinhamento com Cliente e ImplantaÃ§Ã£o Presencial',
            descricao: 'Realizar alinhamento operacional prÃ©vio com o gestor do cliente e acompanhar presencialmente a assunÃ§Ã£o dos postos no primeiro dia de trabalho.',
            prazo: body.data_inicio_operacao
          },
          {
            setor: 'faturamento',
            titulo: 'Cadastro Fiscal, Dados de MediÃ§Ã£o e Prazo de Fatura',
            descricao: `Cadastrar cliente na rotina de faturamento com valor mensal de R$ ${(parseFloat(body.valor_mensal_contratado) || 0).toFixed(2)}, definir dia de fechamento e emissÃ£o da Nota Fiscal.`,
            prazo: body.data_inicio_operacao
          }
        ];

        const stmtTar = db.prepare(`
          INSERT INTO ordens_implantacao_tarefas (ordem_id, setor_responsavel, titulo, descricao, prazo_limite, status)
          VALUES (?, ?, ?, ?, ?, 'Pendente')
        `);
        for (const t of tarefasPadrao) {
          stmtTar.run(ordemId, t.setor, t.titulo, t.descricao, t.prazo);
        }

        // 6. Criar Comunicado AutomÃ¡tico da Empresa Convocando os Setores
        const dataFormatadaBr = body.data_inicio_operacao.split('-').reverse().join('/');
        const nomeExibicaoCliente = body.nome_fantasia || body.nome_razao_social;
        const msgComunicado = `ðŸŽ‰ Temos a satisfaÃ§Ã£o de comunicar a contrataÃ§Ã£o do novo cliente: ${nomeExibicaoCliente}!\n\n` +
          `ðŸ“… Data Oficial de InÃ­cio da OperaÃ§Ã£o: ${dataFormatadaBr}\n` +
          `ðŸ¢ Quantidade de Postos: ${totalPostos} posto(s) | Total de Vagas: ${totalVagas} vaga(s)\n` +
          `ðŸ“ Postos Contratados:\n- ${postosCriadosNomes.join('\n- ')}\n\n` +
          `âš ï¸ ATENÃ‡ÃƒO SETORES (Ordem de ImplantaÃ§Ã£o ${codImplantacao}):\n` +
          `Cada departamento deve acessar suas tarefas e providenciar os preparativos atÃ© os prazos estabelecidos (RH: Recrutamento | BenefÃ­cios: VT/VA | Compras: Uniformes/EPIs | Operacional: Alinhamento | Faturamento: ParÃ¢metros Fiscais).`;

        db.prepare(`
          INSERT INTO comunicados (
            titulo, mensagem, categoria, setor_destino, autor_nome, autor_setor, ordem_implantacao_id
          ) VALUES (?, ?, 'Novos Contratos & ImplantaÃ§Ã£o', 'todos', ?, 'comercial', ?)
        `).run(
          `ðŸŽ‰ NOVO CLIENTE CONTRATADO: ${nomeExibicaoCliente} (InÃ­cio: ${dataFormatadaBr})`,
          msgComunicado,
          body.criado_por || 'Setor Comercial',
          ordemId
        );

        return jsonResponse(res, {
          success: true,
          cliente_id: clienteId,
          ordem_id: ordemId,
          codigo_implantacao: codImplantacao,
          message: `Contrato efetivado com sucesso! Cliente #${clienteId} ativado, ${totalPostos} postos gerados e Ordem de ImplantaÃ§Ã£o comunicada a todos os setores!`
        });
      }

      // LISTAR ORDENS DE IMPLANTAÃ‡ÃƒO
      if (pathname === '/api/comercial/implantacoes' && method === 'GET') {
        const implantacoes = db.prepare(`
          SELECT oi.*, c.nome_fantasia, c.nome_razao_social, c.cnpj
          FROM ordens_implantacao oi
          JOIN clientes c ON oi.cliente_id = c.id
          ORDER BY oi.data_inicio_operacao ASC, oi.id DESC
        `).all();

        for (const imp of implantacoes) {
          imp.cliente_nome = imp.nome_fantasia || imp.nome_razao_social;
          imp.tarefas = db.prepare('SELECT * FROM ordens_implantacao_tarefas WHERE ordem_id = ? ORDER BY prazo_limite ASC').all(imp.id);
          for (const t of imp.tarefas) {
            t.titulo_tarefa = t.titulo;
            t.data_limite = t.prazo_limite;
          }
          const concluidas = imp.tarefas.filter(t => t.status && (t.status.toLowerCase() === 'concluÃ­da' || t.status.toLowerCase() === 'concluido')).length;
          imp.progresso = imp.tarefas.length > 0 ? Math.round((concluidas / imp.tarefas.length) * 100) : 100;
        }

        return jsonResponse(res, implantacoes);
      }

      // ATUALIZAR STATUS / EDITAR TAREFA DA IMPLANTAÃ‡ÃƒO
      if (pathname.match(/^\/api\/comercial\/implantacoes\/tarefas\/\d+$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[5], 10);
        const body = await parseRequestBody(req);

        // Verificar se a tarefa existe e pegar ordem_id
        const tarefaAtual = db.prepare('SELECT * FROM ordens_implantacao_tarefas WHERE id = ?').get(id);
        if (!tarefaAtual) return errorResponse(res, 'Tarefa nÃ£o encontrada', 404);

        db.prepare(`
          UPDATE ordens_implantacao_tarefas SET
            titulo = COALESCE(?, titulo),
            descricao = COALESCE(?, descricao),
            setor_responsavel = COALESCE(?, setor_responsavel),
            responsavel_nome = COALESCE(?, responsavel_nome),
            prazo_limite = COALESCE(?, prazo_limite),
            status = COALESCE(?, status),
            concluido_por = COALESCE(?, concluido_por),
            concluido_em = CASE WHEN ? = 'ConcluÃ­da' THEN COALESCE(concluido_em, CURRENT_TIMESTAMP) ELSE concluido_em END,
            observacoes_conclusao = COALESCE(?, observacoes_conclusao)
          WHERE id = ?
        `).run(
          body.titulo || null,
          body.descricao !== undefined ? body.descricao : null,
          body.setor_responsavel || null,
          body.responsavel_nome !== undefined ? body.responsavel_nome : null,
          body.prazo_limite || null,
          body.status || null,
          body.concluido_por || null,
          body.status || tarefaAtual.status,
          body.observacoes_conclusao !== undefined ? body.observacoes_conclusao : null,
          id
        );

        // Verificar se todas as tarefas da ordem foram concluÃ­das
        const ordemId = tarefaAtual.ordem_id;
        const todasTarefas = db.prepare('SELECT * FROM ordens_implantacao_tarefas WHERE ordem_id = ?').all(ordemId);
        const todasConcluidas = todasTarefas.length > 0 && todasTarefas.every(t => {
          const status = (body.status && t.id === id) ? body.status : t.status;
          return status === 'ConcluÃ­da' || status === 'concluido';
        });

        let comunicadoParabensId = null;
        if (todasConcluidas) {
          // Verificar se jÃ¡ existe comunicado de conclusÃ£o para esta ordem
          const comExistente = db.prepare("SELECT id FROM comunicados WHERE ordem_implantacao_id = ? AND categoria = 'implantacao_concluida'").get(ordemId);
          if (!comExistente) {
            const ordem = db.prepare('SELECT oi.*, c.nome_fantasia, c.nome_razao_social FROM ordens_implantacao oi JOIN clientes c ON oi.cliente_id = c.id WHERE oi.id = ?').get(ordemId);
            if (ordem) {
              const nomeCliente = ordem.nome_fantasia || ordem.nome_razao_social;
              db.prepare("UPDATE ordens_implantacao SET status = 'ConcluÃ­da' WHERE id = ?").run(ordemId);

              const resCom = db.prepare(`
                INSERT INTO comunicados (titulo, mensagem, categoria, prioridade, setor_destino, autor_nome, autor_setor, ordem_implantacao_id)
                VALUES (?, ?, 'implantacao_concluida', 'importante', 'todos', 'Sistema SISFAC 2.0', 'sistema', ?)
              `).run(
                `ðŸŽŠ PARABÃ‰NS! ImplantaÃ§Ã£o de "${nomeCliente}" (${ordem.codigo_implantacao}) 100% CONCLUÃDA!`,
                `ðŸ† MISSÃƒO CUMPRIDA! Toda a equipe de implantaÃ§Ã£o merece um reconhecimento especial!\n\n` +
                `âœ… Todas as tarefas da Ordem de ImplantaÃ§Ã£o ${ordem.codigo_implantacao} foram finalizadas com sucesso!\n\n` +
                `ðŸ“‹ Cliente: ${nomeCliente}\n` +
                `ðŸ“… InÃ­cio da OperaÃ§Ã£o: ${ordem.data_inicio_operacao ? new Date(ordem.data_inicio_operacao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}\n` +
                `ðŸ¢ Postos Implantados: ${ordem.total_postos} posto(s) | ${ordem.total_vagas} vaga(s)\n\n` +
                `ðŸŽ¯ O setor jÃ¡ estÃ¡ 100% operacional! Obrigado RH, BenefÃ­cios, Compras, Operacional e Faturamento pela dedicaÃ§Ã£o e agilidade na execuÃ§Ã£o!\n\n` +
                `ðŸ‘ EXCELENTE TRABALHO DE TODA A EQUIPE!`,
                ordemId
              );
              comunicadoParabensId = resCom.lastInsertRowid;
            }
          }
        }

        return jsonResponse(res, {
          success: true,
          message: 'Tarefa de implantaÃ§Ã£o atualizada com sucesso!',
          todas_concluidas: todasConcluidas,
          comunicado_parabens_id: comunicadoParabensId
        });
      }

      // ADICIONAR NOVA TAREFA A UMA ORDEM DE IMPLANTAÃ‡ÃƒO
      if (pathname.match(/^\/api\/comercial\/implantacoes\/\d+\/tarefas$/) && method === 'POST') {
        const ordemId = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        if (!body.titulo || !body.setor_responsavel) {
          return errorResponse(res, 'TÃ­tulo e setor responsÃ¡vel sÃ£o obrigatÃ³rios', 400);
        }

        const res2 = db.prepare(`
          INSERT INTO ordens_implantacao_tarefas (ordem_id, setor_responsavel, responsavel_nome, titulo, descricao, prazo_limite, status)
          VALUES (?, ?, ?, ?, ?, ?, 'Pendente')
        `).run(ordemId, body.setor_responsavel, body.responsavel_nome || null, body.titulo, body.descricao || '', body.prazo_limite || null);

        return jsonResponse(res, { success: true, id: res2.lastInsertRowid, message: 'Tarefa adicionada Ã  ordem de implantaÃ§Ã£o!' });
      }

      // EXCLUIR TAREFA DA IMPLANTAÃ‡ÃƒO
      if (pathname.match(/^\/api\/comercial\/implantacoes\/tarefas\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[5], 10);
        db.prepare('DELETE FROM ordens_implantacao_tarefas WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Tarefa excluÃ­da da ordem de implantaÃ§Ã£o.' });
      }



      // =============================================================
      // 13. MURAL CORPORATIVO DE COMUNICADOS & CONFIRMAÃ‡ÃƒO DE LEITURA
      // =============================================================

      // LISTAR COMUNICADOS COM INDICADOR SE O USUÃRIO LOGADO JÃ LEU E FILTRAGEM POR AUDIÃŠNCIA
      if (pathname === '/api/comunicados' && method === 'GET') {
        const usuarioId = query.usuario_id ? parseInt(query.usuario_id, 10) : null;
        let usuario = null;
        if (usuarioId) {
          usuario = db.prepare('SELECT id, nome, login, setor FROM usuarios WHERE id = ?').get(usuarioId);
        }

        const todosComunicados = db.prepare('SELECT * FROM comunicados WHERE ativo = 1 ORDER BY created_at DESC').all();

        // Filtrar por destinatÃ¡rio/pÃºblico-alvo
        const comunicados = todosComunicados.filter(com => {
          if (!usuario) return true; // Sem usuÃ¡rio logado, exibe feed padrÃ£o
          const userSetorNorm = (usuario.setor || '').toLowerCase().trim();
          const userLoginNorm = (usuario.login || '').toLowerCase().trim();
          if (userSetorNorm === 'admin' || userSetorNorm === 'administrador master' || userLoginNorm === 'admin' || usuario.id === 1) {
            return true; // Administrador visualiza todos os comunicados
          }
          if (com.autor_id && com.autor_id === usuario.id) return true; // Autor sempre visualiza o prÃ³prio comunicado

          const tipo = (com.destinatarios_tipo || 'todos').toLowerCase();
          const destino = (com.setor_destino || 'todos').toLowerCase().trim();

          if (tipo === 'todos' || destino === 'todos') return true;

          if (tipo === 'setor' || destino !== 'todos') {
            if (destino && (userSetorNorm === destino || userSetorNorm.includes(destino) || destino.includes(userSetorNorm))) {
              return true;
            }
            if (com.destinatarios_alvo_json) {
              try {
                const alvos = JSON.parse(com.destinatarios_alvo_json);
                if (Array.isArray(alvos) && alvos.some(s => {
                  const sNorm = String(s).toLowerCase().trim();
                  return sNorm === userSetorNorm || userSetorNorm.includes(sNorm) || sNorm.includes(userSetorNorm);
                })) {
                  return true;
                }
              } catch(e) {}
            }
          }

          if (tipo === 'usuarios' && com.destinatarios_alvo_json) {
            try {
              const alvos = JSON.parse(com.destinatarios_alvo_json);
              if (Array.isArray(alvos) && alvos.map(Number).includes(usuario.id)) {
                return true;
              }
            } catch(e) {}
          }

          return false;
        });

        const totalUsuariosAtivos = db.prepare('SELECT COUNT(*) as c FROM usuarios WHERE ativo = 1').get().c;

        let naoLidosCount = 0;
        for (const com of comunicados) {
          const totalLeituras = db.prepare('SELECT COUNT(*) as c FROM comunicados_leituras WHERE comunicado_id = ?').get(com.id).c;
          com.total_leituras = totalLeituras;
          com.total_usuarios = totalUsuariosAtivos;
          com.percentual_leitura = totalUsuariosAtivos > 0 ? Math.round((totalLeituras / totalUsuariosAtivos) * 100) : 0;

          if (usuarioId) {
            const leitura = db.prepare('SELECT * FROM comunicados_leituras WHERE comunicado_id = ? AND usuario_id = ?').get(com.id, usuarioId);
            com.ja_leu = !!leitura;
            com.data_leitura = leitura ? leitura.data_leitura : null;
            if (!com.ja_leu) naoLidosCount++;
          } else {
            com.ja_leu = false;
          }

          // Buscar reaÃ§Ãµes consolidadas com emojis
          const reacoes = db.prepare(`
            SELECT emoji, COUNT(*) as count, GROUP_CONCAT(usuario_nome, ', ') as usuarios,
                   MAX(CASE WHEN usuario_id = ? THEN 1 ELSE 0 END) as user_reacted
            FROM comunicados_reacoes
            WHERE comunicado_id = ?
            GROUP BY emoji
            ORDER BY count DESC
          `).all(usuarioId || 0, com.id);

          com.reacoes = reacoes.map(r => ({
            emoji: r.emoji,
            count: r.count,
            usuarios: r.usuarios ? r.usuarios.split(', ') : [],
            user_reacted: r.user_reacted === 1
          }));
        }

        return jsonResponse(res, { comunicados, nao_lidos_count: naoLidosCount });
      }

      // CRIAR NOVO COMUNICADO
      if (pathname === '/api/comunicados' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.titulo || !body.mensagem) {
          return errorResponse(res, 'TÃ­tulo e mensagem sÃ£o obrigatÃ³rios', 400);
        }

        // Checar autorizaÃ§Ã£o (apenas admin ou quem tem flag pode_enviar_comunicados)
        const autorId = body.autor_id ? parseInt(body.autor_id, 10) : null;
        const autorLogin = body.autor_login || query.usuario_login || req.headers['x-usuario-login'];
        const autorSetor = body.autor_setor || query.usuario_setor || req.headers['x-usuario-setor'];

        let podeEnviar = autorSetor === 'admin' || autorSetor === 'Administrador Master';
        if (!podeEnviar && (autorId || autorLogin)) {
          let u = null;
          if (autorId) {
            u = db.prepare('SELECT id, login, setor, pode_enviar_comunicados FROM usuarios WHERE id = ? AND ativo = 1').get(autorId);
          } else if (autorLogin) {
            u = db.prepare('SELECT id, login, setor, pode_enviar_comunicados FROM usuarios WHERE login = ? AND ativo = 1').get(autorLogin);
          }
          if (u && (u.setor === 'admin' || u.setor === 'Administrador Master' || u.login === 'admin' || u.pode_enviar_comunicados === 1)) {
            podeEnviar = true;
          }
        }

        if (!podeEnviar) {
          return errorResponse(res, 'Acesso Negado: VocÃª nÃ£o possui autorizaÃ§Ã£o para emitir comunicados da empresa. Solicite permissÃ£o ao Administrador Master.', 403);
        }

        const stmt = db.prepare(`
          INSERT INTO comunicados (
            titulo, mensagem, categoria, prioridade, setor_destino, autor_id, autor_nome, autor_setor,
            destinatarios_tipo, destinatarios_alvo_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let destinatariosAlvo = body.destinatarios_alvo_json;
        if (destinatariosAlvo && typeof destinatariosAlvo !== 'string') {
          destinatariosAlvo = JSON.stringify(destinatariosAlvo);
        }

        const resCom = stmt.run(
          body.titulo,
          body.mensagem,
          body.categoria || 'geral',
          body.prioridade || 'normal',
          body.setor_destino || body.setor_alvo || 'todos',
          autorId || null,
          body.autor_nome || 'AdministraÃ§Ã£o',
          autorSetor || 'admin',
          body.destinatarios_tipo || (body.setor_destino && body.setor_destino !== 'todos' ? 'setor' : 'todos'),
          destinatariosAlvo || null
        );

        return jsonResponse(res, { success: true, id: resCom.lastInsertRowid, message: 'Comunicado publicado com sucesso no Mural da empresa!' });
      }

      // CONFIRMAR LEITURA DO COMUNICADO PELO USUÃRIO
      if (pathname.match(/^\/api\/comunicados\/\d+\/confirmar-leitura$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        let usuarioId = body.usuario_id ? parseInt(body.usuario_id, 10) : null;

        if (!usuarioId && (body.usuario_login || req.headers['x-usuario-login'])) {
          const loginBusca = body.usuario_login || req.headers['x-usuario-login'];
          const u = db.prepare('SELECT id, nome, setor FROM usuarios WHERE login = ?').get(loginBusca);
          if (u) {
            usuarioId = u.id;
            if (!body.usuario_nome) body.usuario_nome = u.nome;
            if (!body.usuario_setor) body.usuario_setor = u.setor;
          }
        }
        if (!usuarioId) {
          usuarioId = 1; // Default para o admin
        }

        db.prepare(`
          INSERT OR IGNORE INTO comunicados_leituras (comunicado_id, usuario_id, usuario_nome, usuario_setor)
          VALUES (?, ?, ?, ?)
        `).run(id, usuarioId, body.usuario_nome || 'Administrador Master', body.usuario_setor || 'AdministraÃ§Ã£o');

        return jsonResponse(res, { success: true, message: 'Leitura confirmada com sucesso!' });
      }

      // AUDITORIA DE LEITURAS (QUEM LEU E QUEM ESTÃ PENDENTE) PARA ADMINISTRADORES
      if (pathname.match(/^\/api\/comunicados\/\d+\/leituras$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[3], 10);
        const comunicado = db.prepare('SELECT * FROM comunicados WHERE id = ?').get(id);
        if (!comunicado) return errorResponse(res, 'Comunicado nÃ£o encontrado', 404);

        const todosUsuarios = db.prepare('SELECT id, nome, login, setor, email FROM usuarios WHERE ativo = 1 ORDER BY nome ASC').all();
        const leiturasRealizadas = db.prepare('SELECT * FROM comunicados_leituras WHERE comunicado_id = ?').all(id);

        const mapaLeituras = new Map();
        leiturasRealizadas.forEach(l => mapaLeituras.set(l.usuario_id, l.data_leitura));

        const relatorio = todosUsuarios.map(u => ({
          usuario_id: u.id,
          nome: u.nome,
          login: u.login,
          setor: u.setor,
          email: u.email,
          confirmou_leitura: mapaLeituras.has(u.id),
          data_leitura: mapaLeituras.get(u.id) || null
        }));

        const lidos = relatorio.filter(r => r.confirmou_leitura);
        const pendentes = relatorio.filter(r => !r.confirmou_leitura);
        const totalConfirmados = lidos.length;
        const totalPendentes = pendentes.length;
        const taxaAdesao = relatorio.length > 0 ? Math.round((totalConfirmados / relatorio.length) * 100) : 0;

        return jsonResponse(res, {
          comunicado,
          total_usuarios: relatorio.length,
          total_leituras: totalConfirmados,
          total_confirmados: totalConfirmados,
          total_pendentes: totalPendentes,
          taxa_adesao: taxaAdesao,
          lidos,
          pendentes,
          usuarios: relatorio
        });
      }

      // EXCLUIR / INATIVAR COMUNICADO
      if (pathname.match(/^\/api\/comunicados\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        db.prepare('UPDATE comunicados SET ativo = 0 WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Comunicado removido do mural com sucesso!' });
      }

      // EDITAR COMUNICADO (Admin Master pode editar tÃ­tulo, mensagem e categoria)
      if (pathname.match(/^\/api\/comunicados\/\d+$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);

        const comExistente = db.prepare('SELECT id FROM comunicados WHERE id = ?').get(id);
        if (!comExistente) return errorResponse(res, 'Comunicado nÃ£o encontrado', 404);

        db.prepare(`
          UPDATE comunicados SET
            titulo = COALESCE(?, titulo),
            mensagem = COALESCE(?, mensagem),
            categoria = COALESCE(?, categoria),
            prioridade = COALESCE(?, prioridade),
            editado_em = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          body.titulo || null,
          body.mensagem || null,
          body.categoria || null,
          body.prioridade || null,
          id
        );

        return jsonResponse(res, { success: true, message: 'Comunicado editado com sucesso!' });
      }


      // REAGIR COM EMOJI OU ALTERNAR REAÃ‡ÃƒO (JOINHA, CORAÃ‡ÃƒO, PALMAS, FOGUETE, ETC.)
      if (pathname.match(/^\/api\/comunicados\/\d+\/reacoes$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);
        const emoji = (body.emoji || '').trim();
        if (!emoji) return errorResponse(res, 'Emoji Ã© obrigatÃ³rio', 400);

        let usuarioId = body.usuario_id ? parseInt(body.usuario_id, 10) : null;
        let usuarioNome = body.usuario_nome;

        if (!usuarioId && (body.usuario_login || req.headers['x-usuario-login'])) {
          const loginBusca = body.usuario_login || req.headers['x-usuario-login'];
          const u = db.prepare('SELECT id, nome FROM usuarios WHERE login = ?').get(loginBusca);
          if (u) {
            usuarioId = u.id;
            if (!usuarioNome) usuarioNome = u.nome;
          }
        }
        if (!usuarioId) usuarioId = 1;
        if (!usuarioNome) usuarioNome = 'Colaborador';

        const existente = db.prepare('SELECT id FROM comunicados_reacoes WHERE comunicado_id = ? AND usuario_id = ? AND emoji = ?').get(id, usuarioId, emoji);

        let action = '';
        if (existente) {
          db.prepare('DELETE FROM comunicados_reacoes WHERE id = ?').run(existente.id);
          action = 'removed';
        } else {
          db.prepare('INSERT INTO comunicados_reacoes (comunicado_id, usuario_id, usuario_nome, emoji) VALUES (?, ?, ?, ?)').run(id, usuarioId, usuarioNome, emoji);
          action = 'added';
        }

        // Buscar reaÃ§Ãµes consolidadas atualizadas
        const reacoes = db.prepare(`
          SELECT emoji, COUNT(*) as count, GROUP_CONCAT(usuario_nome, ', ') as usuarios,
                 MAX(CASE WHEN usuario_id = ? THEN 1 ELSE 0 END) as user_reacted
          FROM comunicados_reacoes
          WHERE comunicado_id = ?
          GROUP BY emoji
          ORDER BY count DESC
        `).all(usuarioId, id);

        const reacoesFormatadas = reacoes.map(r => ({
          emoji: r.emoji,
          count: r.count,
          usuarios: r.usuarios ? r.usuarios.split(', ') : [],
          user_reacted: r.user_reacted === 1
        }));

        return jsonResponse(res, {
          success: true,
          action,
          emoji,
          reacoes: reacoesFormatadas
        });
      }

      // =============================================================
      // 14. MÃ“DULO DE SEGURANÃ‡A E SAÃšDE DO TRABALHO (SST)
      // =============================================================

      // LISTAR DOCUMENTOS DE SST DOS COLABORADORES
      if (pathname === '/api/sst/documentos' && method === 'GET') {
        let sql = `
          SELECT d.*, c.nome as colaborador_nome, c.cpf as colaborador_cpf,
                 c.data_admissao, c.escala, cg.nome_cargo, cli.nome_fantasia as cliente_nome,
                 pt.nome_posto, arq.localizacao_caixa, arq.localizacao_pasta, arq.localizacao_estante
          FROM sst_documentos_colaborador d
          JOIN colaboradores c ON d.colaborador_id = c.id
          LEFT JOIN cargos cg ON c.cargo_id = cg.id
          LEFT JOIN clientes cli ON c.cliente_id = cli.id
          LEFT JOIN postos_trabalho pt ON c.posto_trabalho_id = pt.id
          LEFT JOIN setor_arquivos_documentos arq ON d.arquivo_registro_id = arq.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];

        if (query.tipo) {
          sql += ' AND d.tipo_documento = ?';
          params.push(query.tipo);
        }
        if (query.colaborador_id) {
          sql += ' AND d.colaborador_id = ?';
          params.push(parseInt(query.colaborador_id, 10));
        }
        if (query.status_assinatura) {
          sql += ' AND d.status_assinatura = ?';
          params.push(query.status_assinatura);
        }
        if (query.arquivo_status) {
          sql += ' AND d.arquivo_status = ?';
          params.push(query.arquivo_status);
        }
        if (query.busca) {
          sql += ' AND (c.nome LIKE ? OR c.cpf LIKE ? OR cg.nome_cargo LIKE ? OR cli.nome_fantasia LIKE ?)';
          const b = `%${query.busca}%`;
          params.push(b, b, b, b);
        }

        sql += ' ORDER BY d.created_at DESC, d.id DESC';
        const docs = db.prepare(sql).all(...params);

        const formatados = docs.map(d => {
          let conteudo = {};
          try { conteudo = JSON.parse(d.conteudo_json); } catch (e) {}
          return {
            ...d,
            conteudo
          };
        });

        return jsonResponse(res, formatados);
      }

      // OBTER UM DOCUMENTO ESPECÃFICO DE SST
      if (pathname.match(/^\/api\/sst\/documentos\/\d+$/) && method === 'GET') {
        const id = parseInt(pathname.split('/')[4], 10);
        const doc = db.prepare(`
          SELECT d.*, c.nome as colaborador_nome, c.cpf as colaborador_cpf,
                 c.data_admissao, c.escala, cg.nome_cargo, cli.nome_fantasia as cliente_nome,
                 pt.nome_posto, arq.localizacao_caixa, arq.localizacao_pasta, arq.localizacao_estante
          FROM sst_documentos_colaborador d
          JOIN colaboradores c ON d.colaborador_id = c.id
          LEFT JOIN cargos cg ON c.cargo_id = cg.id
          LEFT JOIN clientes cli ON c.cliente_id = cli.id
          LEFT JOIN postos_trabalho pt ON c.posto_trabalho_id = pt.id
          LEFT JOIN setor_arquivos_documentos arq ON d.arquivo_registro_id = arq.id
          WHERE d.id = ?
        `).get(id);

        if (!doc) return errorResponse(res, 'Documento de SST nÃ£o encontrado', 404);
        try { doc.conteudo = JSON.parse(doc.conteudo_json); } catch (e) { doc.conteudo = {}; }

        return jsonResponse(res, doc);
      }

      // ATUALIZAR / EDITAR DOCUMENTO DE SST (Ex: Alterar cronograma do treinamento ou clÃ¡usulas da OS)
      if (pathname.match(/^\/api\/sst\/documentos\/\d+$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        const docAtual = db.prepare('SELECT * FROM sst_documentos_colaborador WHERE id = ?').get(id);
        if (!docAtual) return errorResponse(res, 'Documento de SST nÃ£o encontrado', 404);

        let novoConteudoJson = docAtual.conteudo_json;
        if (body.conteudo) {
          novoConteudoJson = typeof body.conteudo === 'string' ? body.conteudo : JSON.stringify(body.conteudo);
        } else if (body.conteudo_json) {
          novoConteudoJson = typeof body.conteudo_json === 'string' ? body.conteudo_json : JSON.stringify(body.conteudo_json);
        }

        const titulo = body.titulo || docAtual.titulo;
        const statusAssinatura = body.status_assinatura || docAtual.status_assinatura;
        const dataAssinatura = body.data_assinatura !== undefined ? body.data_assinatura : docAtual.data_assinatura;

        db.prepare(`
          UPDATE sst_documentos_colaborador SET
            titulo = ?,
            conteudo_json = ?,
            status_assinatura = ?,
            data_assinatura = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(titulo, novoConteudoJson, statusAssinatura, dataAssinatura, id);

        return jsonResponse(res, { success: true, message: 'Documento de SST atualizado com sucesso!' });
      }

      // ALTERAR STATUS DE ASSINATURA DO DOCUMENTO SST
      if (pathname.match(/^\/api\/sst\/documentos\/\d+\/status$/) && method === 'PATCH') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);
        const novoStatus = body.status_assinatura;
        if (!novoStatus) return errorResponse(res, 'Novo status_assinatura Ã© obrigatÃ³rio', 400);

        const dataAssinatura = novoStatus === 'Assinado' ? (body.data_assinatura || new Date().toISOString().split('T')[0]) : null;

        db.prepare(`
          UPDATE sst_documentos_colaborador SET
            status_assinatura = ?,
            data_assinatura = COALESCE(?, data_assinatura),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(novoStatus, dataAssinatura, id);

        return jsonResponse(res, { success: true, message: `Status alterado para "${novoStatus}" com sucesso!` });
      }

      // RE-GERAR DOCUMENTO SST COM BASE NO MODELO ATUALIZADO
      if (pathname.match(/^\/api\/sst\/documentos\/\d+\/gerar-novamente$/) && method === 'POST') {
        const id = parseInt(pathname.split('/')[4], 10);
        const docAtual = db.prepare('SELECT colaborador_id, tipo_documento FROM sst_documentos_colaborador WHERE id = ?').get(id);
        if (!docAtual) return errorResponse(res, 'Documento nÃ£o encontrado', 404);

        db.prepare('DELETE FROM sst_documentos_colaborador WHERE id = ?').run(id);
        const gerados = gerarDocumentosSSTParaColaborador(docAtual.colaborador_id);

        return jsonResponse(res, { success: true, message: 'Documento SST regerado com sucesso!', gerados });
      }

      // GERAR DOCUMENTOS SST PARA COLABORADOR MANUALMENTE
      if (pathname === '/api/sst/gerar-para-colaborador' && method === 'POST') {
        const body = await parseRequestBody(req);
        const colabId = parseInt(body.colaborador_id, 10);
        if (!colabId) return errorResponse(res, 'colaborador_id Ã© obrigatÃ³rio', 400);

        const gerados = gerarDocumentosSSTParaColaborador(colabId, body.cargo_id, body.modelo_os_id);
        return jsonResponse(res, { success: true, message: 'Documentos SST gerados com sucesso!', gerados });
      }

      // OBTER CRONOGRAMA PADRÃƒO DE TREINAMENTO ADMISSIONAL (SST)
      if (pathname === '/api/sst/cronograma-padrao' && method === 'GET') {
        let cfg = db.prepare('SELECT * FROM sst_config_treinamento_padrao ORDER BY id ASC LIMIT 1').get();
        if (cfg) {
          let modulos = [];
          try { modulos = JSON.parse(cfg.modulos_json); } catch (e) {}
          return jsonResponse(res, { ...cfg, modulos });
        }
        return jsonResponse(res, null);
      }

      // ATUALIZAR CRONOGRAMA PADRÃƒO DE TREINAMENTO ADMISSIONAL (SST)
      if (pathname === '/api/sst/cronograma-padrao' && method === 'PUT') {
        const body = await parseRequestBody(req);
        const titulo = (body.titulo || 'Estrutura do Treinamento IntrodutÃ³rio Admissional de SST (NR-01 & NR-06)').trim();
        const cargaHoraria = (body.carga_horaria_total || '6 Horas').trim();
        const local = (body.local_treinamento || 'Sede Operacional / Posto de ServiÃ§o').trim();
        const instrutor = (body.instrutor_nome || 'Cleverson Almeida').trim();
        const registro = (body.instrutor_registro || 'TST, DRT 0073086 / MG').trim();
        const observacoes = (body.observacoes || '').trim();
        const modulosJson = typeof body.modulos_json === 'string' ? body.modulos_json : JSON.stringify(body.modulos || []);

        const cfg = db.prepare('SELECT id FROM sst_config_treinamento_padrao ORDER BY id ASC LIMIT 1').get();
        if (cfg) {
          db.prepare(`
            UPDATE sst_config_treinamento_padrao SET
              titulo = ?, carga_horaria_total = ?, local_treinamento = ?,
              instrutor_nome = ?, instrutor_registro = ?, observacoes = ?,
              modulos_json = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(titulo, cargaHoraria, local, instrutor, registro, observacoes, modulosJson, cfg.id);
        } else {
          db.prepare(`
            INSERT INTO sst_config_treinamento_padrao (
              titulo, carga_horaria_total, local_treinamento, instrutor_nome, instrutor_registro, observacoes, modulos_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(titulo, cargaHoraria, local, instrutor, registro, observacoes, modulosJson);
        }

        return jsonResponse(res, { success: true, message: 'Cronograma padrÃ£o de treinamento atualizado com sucesso!' });
      }

      // LISTAR MODELOS DE OS POR FUNÃ‡ÃƒO
      if (pathname === '/api/sst/modelos-os' && method === 'GET') {
        const modelos = db.prepare(`
          SELECT m.*, cg.nome_cargo
          FROM sst_modelos_ordens_servico m
          LEFT JOIN cargos cg ON m.cargo_id = cg.id
          WHERE m.ativo = 1
          ORDER BY m.nome_funcao ASC
        `).all();

        const formatados = modelos.map(m => {
          let riscos = [];
          let epis = [];
          try { riscos = JSON.parse(m.riscos_ocupacionais_json); } catch (e) {}
          try { epis = JSON.parse(m.epis_obrigatorios_json); } catch (e) {}
          return {
            ...m,
            riscos_ocupacionais: riscos,
            epis_obrigatorios: epis
          };
        });

        return jsonResponse(res, formatados);
      }

      // CRIAR NOVO MODELO DE OS POR FUNÃ‡ÃƒO
      if (pathname === '/api/sst/modelos-os' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome_funcao || !body.descricao_atividades) {
          return errorResponse(res, 'Nome da funÃ§Ã£o e descriÃ§Ã£o de atividades sÃ£o obrigatÃ³rios', 400);
        }

        const tituloModelo = (body.titulo_modelo || body.nome_funcao || '').trim();

        const stmt = db.prepare(`
          INSERT INTO sst_modelos_ordens_servico (
            cargo_id, titulo_modelo, nome_funcao, descricao_atividades, riscos_ocupacionais_json,
            epis_obrigatorios_json, medidas_preventivas, normas_proibicoes, termo_compromisso, ativo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        const resM = stmt.run(
          body.cargo_id ? parseInt(body.cargo_id, 10) : null,
          tituloModelo,
          body.nome_funcao.trim(),
          body.descricao_atividades.trim(),
          typeof body.riscos_ocupacionais_json === 'string' ? body.riscos_ocupacionais_json : JSON.stringify(body.riscos_ocupacionais || []),
          typeof body.epis_obrigatorios_json === 'string' ? body.epis_obrigatorios_json : JSON.stringify(body.epis_obrigatorios || []),
          body.medidas_preventivas || '',
          body.normas_proibicoes || '',
          body.termo_compromisso || ''
        );

        return jsonResponse(res, { success: true, id: resM.lastInsertRowid, message: 'Modelo de OS cadastrado com sucesso!' });
      }

      // ATUALIZAR MODELO DE OS POR FUNÃ‡ÃƒO
      if (pathname.match(/^\/api\/sst\/modelos-os\/\d+$/) && method === 'PUT') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        const tituloModelo = (body.titulo_modelo || body.nome_funcao || '').trim();

        db.prepare(`
          UPDATE sst_modelos_ordens_servico SET
            cargo_id = ?,
            titulo_modelo = ?,
            nome_funcao = ?,
            descricao_atividades = ?,
            riscos_ocupacionais_json = ?,
            epis_obrigatorios_json = ?,
            medidas_preventivas = ?,
            normas_proibicoes = ?,
            termo_compromisso = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          body.cargo_id ? parseInt(body.cargo_id, 10) : null,
          tituloModelo,
          body.nome_funcao.trim(),
          body.descricao_atividades.trim(),
          typeof body.riscos_ocupacionais_json === 'string' ? body.riscos_ocupacionais_json : JSON.stringify(body.riscos_ocupacionais || []),
          typeof body.epis_obrigatorios_json === 'string' ? body.epis_obrigatorios_json : JSON.stringify(body.epis_obrigatorios || []),
          body.medidas_preventivas || '',
          body.normas_proibicoes || '',
          body.termo_compromisso || '',
          id
        );

        return jsonResponse(res, { success: true, message: 'Modelo de Ordem de ServiÃ§o atualizado com sucesso!' });
      }

      // EXCLUIR / INATIVAR MODELO DE OS
      if (pathname.match(/^\/api\/sst\/modelos-os\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[4], 10);
        db.prepare('UPDATE sst_modelos_ordens_servico SET ativo = 0 WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Modelo de OS inativado com sucesso!' });
      }

      // =============================================================
      // 15. SETOR DE ARQUIVOS & GESTÃƒO FÃSICA DE DOCUMENTOS
      // =============================================================

      // LISTAR DOCUMENTOS NO SETOR DE ARQUIVO
      if (pathname === '/api/arquivo/documentos' && method === 'GET') {
        let sql = `
          SELECT a.*,
                 a.status as status_arquivamento,
                 a.localizacao_caixa as caixa_arquivo,
                 a.localizacao_pasta as pasta_arquivo,
                 a.localizacao_estante as estante_prateleira,
                 c.nome as colaborador_nome, c.cpf as colaborador_cpf,
                 c.data_admissao, cg.nome_cargo, cli.nome_fantasia as cliente_nome,
                 pt.nome_posto, doc.titulo as doc_titulo, doc.tipo_documento as sst_tipo
          FROM setor_arquivos_documentos a
          JOIN colaboradores c ON a.colaborador_id = c.id
          LEFT JOIN cargos cg ON c.cargo_id = cg.id
          LEFT JOIN clientes cli ON c.cliente_id = cli.id
          LEFT JOIN postos_trabalho pt ON c.posto_trabalho_id = pt.id
          LEFT JOIN sst_documentos_colaborador doc ON a.documento_sst_id = doc.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];

        if (query.status && query.status !== 'todos') {
          if (query.status.toLowerCase().includes('pendente') || query.status.toLowerCase().includes('aguardando')) {
            sql += " AND (a.status = 'Aguardando_Arquivamento' OR a.status = 'Pendente' OR a.status = 'Solicitado')";
          } else if (query.status.toLowerCase().includes('arquivado')) {
            sql += " AND a.status = 'Arquivado'";
          } else {
            sql += ' AND a.status = ?';
            params.push(query.status);
          }
        }
        if (query.tipo_documento && query.tipo_documento !== 'todos') {
          sql += ' AND a.tipo_documento = ?';
          params.push(query.tipo_documento);
        }
        if (query.busca) {
          sql += ' AND (c.nome LIKE ? OR c.cpf LIKE ? OR a.descricao LIKE ? OR a.localizacao_caixa LIKE ? OR a.localizacao_pasta LIKE ? OR a.localizacao_estante LIKE ?)';
          const b = `%${query.busca}%`;
          params.push(b, b, b, b, b, b);
        }

        sql += ' ORDER BY a.data_solicitacao DESC, a.id DESC';
        const lista = db.prepare(sql).all(...params);

        const totalPendente = lista.filter(x => {
          const s = (x.status || '').toLowerCase();
          return s === 'aguardando_arquivamento' || s === 'pendente' || s === 'solicitado';
        }).length;
        const totalArquivado = lista.filter(x => (x.status || '').toLowerCase() === 'arquivado').length;

        return jsonResponse(res, { documentos: lista, total_pendentes: totalPendente, total_arquivados: totalArquivado });
      }

      // QUALQUER USUÃRIO: INFORMAR AO SETOR DE ARQUIVO QUE DOCUMENTO ESTÃ DISPONÃVEL
      if (pathname === '/api/arquivo/solicitar' && method === 'POST') {
        const body = await parseRequestBody(req);
        const colabId = parseInt(body.colaborador_id, 10);
        if (!colabId) return errorResponse(res, 'colaborador_id Ã© obrigatÃ³rio', 400);

        const colab = db.prepare(`
          SELECT c.id, c.nome, c.cpf, cg.nome_cargo, cli.nome_fantasia as cliente_nome
          FROM colaboradores c
          LEFT JOIN cargos cg ON c.cargo_id = cg.id
          LEFT JOIN clientes cli ON c.cliente_id = cli.id
          WHERE c.id = ?
        `).get(colabId);

        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        const tipoDoc = body.tipo_documento || 'ORDEM_SERVICO';
        const descricao = body.descricao || `Documento ${tipoDoc} do colaborador ${colab.nome} assinado e disponÃ­vel para arquivar`;
        const solicitanteId = (body.solicitado_por_usuario_id || body.solicitante_id) ? parseInt(body.solicitado_por_usuario_id || body.solicitante_id, 10) : 1;
        const solicitanteNome = body.solicitado_por_nome || body.solicitante_nome || 'UsuÃ¡rio do Sistema';
        const docSstId = (body.documento_sst_id || body.sst_documento_id) ? parseInt(body.documento_sst_id || body.sst_documento_id, 10) : null;

        const stmtArq = db.prepare(`
          INSERT INTO setor_arquivos_documentos (
            colaborador_id, documento_sst_id, tipo_documento, descricao,
            solicitado_por_usuario_id, solicitado_por_nome, status, observacoes
          ) VALUES (?, ?, ?, ?, ?, ?, 'Aguardando_Arquivamento', ?)
        `);

        const resArq = stmtArq.run(colabId, docSstId, tipoDoc, descricao, solicitanteId, solicitanteNome, body.observacoes || '');
        const registroId = resArq.lastInsertRowid;

        // Atualizar documento SST caso tenha sido referenciado
        if (docSstId) {
          db.prepare(`
            UPDATE sst_documentos_colaborador SET
              arquivo_status = 'Solicitado',
              arquivo_registro_id = ?,
              status_assinatura = CASE WHEN status_assinatura = 'Pendente' THEN 'Assinado' ELSE status_assinatura END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(registroId, docSstId);
        }

        // DISPARAR COMUNICADO DIRECIONADO AUTOMATICAMENTE PARA O SETOR DE ARQUIVO
        try {
          db.prepare(`
            INSERT INTO comunicados (
              titulo, mensagem, categoria, prioridade, setor_destino, autor_id, autor_nome, autor_setor,
              destinatarios_tipo, destinatarios_alvo_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `ðŸ“ Documento DisponÃ­vel para Arquivar: ${colab.nome}`,
            `O usuÃ¡rio ${solicitanteNome} informou que o documento "${descricao}" do colaborador ${colab.nome} (FunÃ§Ã£o: ${colab.nome_cargo || 'Efetivo'} - Cliente: ${colab.cliente_nome || 'Base'}) jÃ¡ foi assinado e estÃ¡ disponÃ­vel para coleta e arquivamento fÃ­sico imediato.`,
            'RH & GestÃ£o de Pessoas',
            'importante',
            'arquivo',
            solicitanteId,
            solicitanteNome,
            'Operacional / RH',
            'setor',
            JSON.stringify(['arquivo', 'Arquivo & DocumentaÃ§Ã£o'])
          );
        } catch (eCom) {
          console.error('Erro ao emitir comunicado para o arquivo:', eCom);
        }

        return jsonResponse(res, {
          success: true,
          id: registroId,
          message: 'Setor de Arquivo informado com sucesso! NotificaÃ§Ã£o direcionada gerada no Mural.'
        });
      }

      // SETOR DE ARQUIVO: CONFIRMAR ARQUIVAMENTO FÃSICO COM CAIXA, PASTA E ESTANTE
      if (pathname.match(/^\/api\/arquivo\/documentos\/\d+\/arquivar$/) && method === 'PATCH') {
        const id = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        const arqAtual = db.prepare('SELECT * FROM setor_arquivos_documentos WHERE id = ?').get(id);
        if (!arqAtual) return errorResponse(res, 'Registro de arquivamento nÃ£o encontrado', 404);

        const caixa = body.localizacao_caixa || body.caixa || 'Caixa Geral 01';
        const pasta = body.localizacao_pasta || body.pasta || 'Pasta Funcional';
        const estante = body.localizacao_estante || body.estante || 'Estante 01 - Prateleira A';
        const userId = (body.arquivado_por_usuario_id || body.usuario_id) ? parseInt(body.arquivado_por_usuario_id || body.usuario_id, 10) : 1;
        const userNome = body.arquivado_por_nome || body.usuario_nome || 'Operador de Arquivo';

        db.prepare(`
          UPDATE setor_arquivos_documentos SET
            status = 'Arquivado',
            localizacao_caixa = ?,
            localizacao_pasta = ?,
            localizacao_estante = ?,
            arquivado_por_usuario_id = ?,
            arquivado_por_nome = ?,
            data_arquivamento = CURRENT_TIMESTAMP,
            observacoes = COALESCE(?, observacoes)
          WHERE id = ?
        `).run(caixa, pasta, estante, userId, userNome, body.observacoes || null, id);

        if (arqAtual.documento_sst_id) {
          db.prepare(`
            UPDATE sst_documentos_colaborador SET
              arquivo_status = 'Arquivado',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(arqAtual.documento_sst_id);
        }

        return jsonResponse(res, { success: true, message: 'Documento arquivado fisicamente com sucesso!' });
      }

      // EXCLUIR REGISTRO DO ARQUIVO
      if (pathname.match(/^\/api\/arquivo\/documentos\/\d+$/) && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[4], 10);
        db.prepare('DELETE FROM setor_arquivos_documentos WHERE id = ?').run(id);
        return jsonResponse(res, { success: true, message: 'Registro de arquivo excluÃ­do com sucesso!' });
      }

      // =============================================================
      // ROTAS: MÃ“DULO DE AFASTAMENTOS & POSTO AFASTADOS
      // =============================================================

      // LISTAR AFASTAMENTOS
      if (pathname === '/api/afastamentos' && method === 'GET') {
        let sql = `
          SELECT af.*,
                 col.nome as colaborador_nome,
                 col.cpf as colaborador_cpf,
                 cg.nome_cargo as cargo_nome,
                 cli.nome_fantasia as cliente_nome,
                 pt.nome_posto as posto_origem_nome,
                 un.nome_unidade as unidade_origem_nome
          FROM afastamentos af
          JOIN colaboradores col ON af.colaborador_id = col.id
          LEFT JOIN cargos cg ON col.cargo_id = cg.id
          LEFT JOIN clientes cli ON af.cliente_id = cli.id
          LEFT JOIN postos_trabalho pt ON af.posto_origem_id = pt.id
          LEFT JOIN unidades un ON af.unidade_origem_id = un.id
          WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA'
        `;
        const params = [];
        if (query.status && query.status !== 'todos') {
          sql += ' AND af.status = ? ';
          params.push(query.status);
        }
        if (query.cliente_id) {
          sql += ' AND af.cliente_id = ? ';
          params.push(parseInt(query.cliente_id, 10));
        }
        if (query.busca) {
          sql += ' AND (col.nome LIKE ? OR col.cpf LIKE ? OR af.motivo LIKE ? OR af.cid LIKE ?) ';
          const b = `%${query.busca}%`;
          params.push(b, b, b, b);
        }
        sql += ' ORDER BY af.status ASC, af.data_inicio DESC ';
        const lista = db.prepare(sql).all(...params);
        return jsonResponse(res, lista);
      }

      // LANÃ‡AR NOVO AFASTAMENTO
      if (pathname.match(/^\/api\/colaboradores\/\d+\/afastar$/) && method === 'POST') {
        const colabId = parseInt(pathname.split('/')[3], 10);
        const colab = db.prepare(`
          SELECT c.*, cli.id as cli_id, pt.id as pt_id, pt.nome_posto
          FROM colaboradores c
          LEFT JOIN clientes cli ON c.cliente_id = cli.id
          LEFT JOIN postos_trabalho pt ON c.posto_trabalho_id = pt.id
          WHERE c.id = ?
        `).get(colabId);

        if (!colab) return errorResponse(res, 'Colaborador nÃ£o encontrado', 404);

        const body = await parseRequestBody(req);
        const { data_inicio, data_retorno_prevista, motivo, cid, observacoes } = body;

        if (!data_inicio || !motivo) {
          return errorResponse(res, 'Data de inÃ­cio e motivo do afastamento sÃ£o obrigatÃ³rios', 400);
        }

        const clienteDestinoId = colab.cliente_id || colab.cli_id || 1;
        const postoAfastadosId = garantirPostoAfastados(clienteDestinoId);

        const resIns = db.prepare(`
          INSERT INTO afastamentos (
            colaborador_id, cliente_id, unidade_origem_id, posto_origem_id,
            cargo_origem_id, data_inicio, data_retorno_prevista, motivo, cid, observacoes, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo')
        `).run(
          colab.id,
          clienteDestinoId,
          colab.unidade_id || null,
          colab.posto_trabalho_id || null,
          colab.cargo_id || null,
          data_inicio,
          data_retorno_prevista || null,
          motivo,
          cid || null,
          observacoes || null
        );

        const afastamentoId = resIns.lastInsertRowid;

        // Atualizar colaborador: status Afastado e mover para o posto AFASTADOS
        db.prepare(`
          UPDATE colaboradores SET
            posto_trabalho_id = ?,
            status_colaborador = 'Afastado',
            afastado = 1,
            afastamento_atual_id = ?
          WHERE id = ?
        `).run(postoAfastadosId, afastamentoId, colab.id);

        return jsonResponse(res, {
          success: true,
          id: afastamentoId,
          message: `Colaborador "${colab.nome}" afastado com sucesso e transferido para o posto AFASTADOS!`
        });
      }

      // RETORNAR DO AFASTAMENTO (ENCERRAR & MOVIMENTAR PARA POSTO)
      if (pathname.match(/^\/api\/afastamentos\/\d+\/retornar$/) && method === 'POST') {
        const afId = parseInt(pathname.split('/')[3], 10);
        const af = db.prepare('SELECT * FROM afastamentos WHERE id = ?').get(afId);
        if (!af) return errorResponse(res, 'Registro de afastamento nÃ£o localizado', 404);

        const body = await parseRequestBody(req);
        const { data_retorno_efetiva, novo_posto_id, novo_unidade_id, novo_cliente_id, observacoes_retorno } = body;

        let destinoPostoId = novo_posto_id ? parseInt(novo_posto_id, 10) : af.posto_origem_id;
        let destinoUnidadeId = novo_unidade_id ? parseInt(novo_unidade_id, 10) : af.unidade_origem_id;
        let destinoClienteId = novo_cliente_id ? parseInt(novo_cliente_id, 10) : af.cliente_id;

        if (!destinoPostoId && destinoClienteId) {
          const ptPadrao = db.prepare('SELECT id FROM postos_trabalho WHERE cliente_id = ? AND UPPER(nome_posto) NOT LIKE "%AFASTADO%" AND ativo = 1 LIMIT 1').get(destinoClienteId);
          if (ptPadrao) destinoPostoId = ptPadrao.id;
        }

        const dataRet = data_retorno_efetiva || new Date().toISOString().split('T')[0];
        const obsFinal = (af.observacoes || '') + (observacoes_retorno ? ` | Retorno em ${dataRet}: ${observacoes_retorno}` : '');

        db.prepare(`
          UPDATE afastamentos SET
            status = 'Encerrado',
            data_retorno_efetiva = ?,
            observacoes = ?,
            atualizado_em = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(dataRet, obsFinal, af.id);

        db.prepare(`
          UPDATE colaboradores SET
            posto_trabalho_id = ?,
            unidade_id = ?,
            cliente_id = COALESCE(?, cliente_id),
            status_colaborador = 'Ativo',
            afastado = 0,
            afastamento_atual_id = NULL
          WHERE id = ?
        `).run(destinoPostoId || null, destinoUnidadeId || null, destinoClienteId || null, af.colaborador_id);

        return jsonResponse(res, {
          success: true,
          message: 'Retorno de afastamento registrado e colaborador movimentado com sucesso!'
        });
      }

      // ATUALIZAR DADOS DO AFASTAMENTO (PRORROGAR / OBSERVAÃ‡Ã•ES)
      if (pathname.match(/^\/api\/afastamentos\/\d+$/) && method === 'PUT') {
        const afId = parseInt(pathname.split('/')[3], 10);
        const body = await parseRequestBody(req);

        db.prepare(`
          UPDATE afastamentos SET
            data_inicio = COALESCE(?, data_inicio),
            data_retorno_prevista = ?,
            motivo = COALESCE(?, motivo),
            cid = ?,
            observacoes = ?,
            atualizado_em = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          body.data_inicio || null,
          body.data_retorno_prevista || null,
          body.motivo || null,
          body.cid || null,
          body.observacoes || null,
          afId
        );

        return jsonResponse(res, { success: true, message: 'Afastamento atualizado com sucesso!' });
      }

      // EXCLUIR / CANCELAR REGISTRO DE AFASTAMENTO
      if (pathname.match(/^\/api\/afastamentos\/\d+$/) && method === 'DELETE') {
        const afId = parseInt(pathname.split('/')[3], 10);
        const af = db.prepare('SELECT * FROM afastamentos WHERE id = ?').get(afId);
        if (af && af.status === 'Ativo') {
          db.prepare(`
            UPDATE colaboradores SET
              posto_trabalho_id = COALESCE(?, posto_trabalho_id),
              unidade_id = COALESCE(?, unidade_id),
              status_colaborador = 'Ativo',
              afastado = 0,
              afastamento_atual_id = NULL
            WHERE id = ?
          `).run(af.posto_origem_id || null, af.unidade_origem_id || null, af.colaborador_id);
        }
        db.prepare('DELETE FROM afastamentos WHERE id = ?').run(afId);
        return jsonResponse(res, { success: true, message: 'Registro de afastamento cancelado com sucesso!' });
      }

      // =============================================================
      // ROTAS: PLATAFORMA DE TREINAMENTOS EAD (TOTALMENTE AUTÃ”NOMA)
      // =============================================================

      // CONFIGURAÃ‡ÃƒO VISUAL & WHITE-LABEL DO EAD
      if (pathname === '/api/treinamento/config' && method === 'GET') {
        let conf = db.prepare('SELECT * FROM treinamento_config WHERE id = 1').get();
        if (!conf) conf = { nome_plataforma: 'Academia de Treinamentos & CapacitaÃ§Ã£o', cor_primaria: '#0d9488', cor_secundaria: '#1e293b' };
        return jsonResponse(res, conf);
      }

      if (pathname === '/api/treinamento/config' && method === 'PUT') {
        const body = await parseRequestBody(req);
        db.prepare(`
          UPDATE treinamento_config SET
            nome_plataforma = COALESCE(?, nome_plataforma),
            slogan = COALESCE(?, slogan),
            logo_url = COALESCE(?, logo_url),
            banner_url = COALESCE(?, banner_url),
            cor_primaria = COALESCE(?, cor_primaria),
            cor_secundaria = COALESCE(?, cor_secundaria),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `).run(
          body.nome_plataforma || null,
          body.slogan || null,
          body.logo_url !== undefined ? body.logo_url : null,
          body.banner_url !== undefined ? body.banner_url : null,
          body.cor_primaria || null,
          body.cor_secundaria || null
        );

        const updated = db.prepare('SELECT * FROM treinamento_config WHERE id = 1').get();
        return jsonResponse(res, { success: true, config: updated, message: 'ConfiguraÃ§Ã£o visual do EAD atualizada com sucesso!' });
      }

      // UPLOAD DE IMAGEM DO EAD (FOTO INSTRUTOR, LOGO, BANNER HERO, ETC.)
      if (pathname === '/api/treinamento/upload' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { imagem_base64, tipo } = body;
        if (!imagem_base64) return errorResponse(res, 'Nenhuma imagem enviada para upload', 400);

        try {
          const uploadsDir = path.join(PUBLIC_DIR, 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const matches = imagem_base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          let ext = 'jpg';
          let dataBuffer;
          if (matches) {
            ext = matches[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
            dataBuffer = Buffer.from(matches[2], 'base64');
          } else {
            dataBuffer = Buffer.from(imagem_base64, 'base64');
          }

          const prefixo = tipo ? String(tipo).replace(/[^a-zA-Z0-9_-]/g, '') : 'img';
          const fileName = `${prefixo}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
          const filePath = path.join(uploadsDir, fileName);

          fs.writeFileSync(filePath, dataBuffer);
          const urlRelativa = `/uploads/${fileName}`;

          return jsonResponse(res, {
            success: true,
            url: urlRelativa,
            message: 'Imagem carregada com sucesso!'
          });
        } catch (err) {
          console.error('Erro no upload de imagem:', err);
          return errorResponse(res, 'Falha ao salvar a imagem: ' + err.message, 500);
        }
      }

      // AUTENTICAÃ‡ÃƒO EAD (ALUNO, PROFESSOR, ADMIN)
      if (pathname === '/api/treinamento/auth/login' && method === 'POST') {
        const { login, senha } = await parseRequestBody(req);
        if (!login || !senha) return errorResponse(res, 'Informe login e senha para acessar', 400);

        const user = db.prepare(`
          SELECT id, nome, email, login, tipo, bio, especialidade, foto_url, mensagem_instrutor
          FROM treinamento_usuarios
          WHERE login = ? AND senha = ? AND ativo = 1
        `).get(login.trim(), senha.trim());

        if (!user) {
          const adminMaster = db.prepare('SELECT * FROM usuarios WHERE login = ? AND senha = ? AND ativo = 1').get(login.trim(), senha.trim());
          if (adminMaster) {
            return jsonResponse(res, {
              success: true,
              user: {
                id: 9999,
                nome: adminMaster.nome,
                login: adminMaster.login,
                tipo: 'admin',
                especialidade: 'Administrador Master',
                foto_url: ''
              }
            });
          }
          return errorResponse(res, 'Login ou senha invÃ¡lidos no Portal de Treinamentos', 401);
        }

        return jsonResponse(res, { success: true, user });
      }

      // LISTAR INSTRUTORES (CONHEÃ‡A NOSSOS INSTRUTORES)
      if (pathname === '/api/treinamento/instrutores' && method === 'GET') {
        const instrutores = db.prepare(`
          SELECT id, nome, email, login, tipo, bio, especialidade, foto_url, mensagem_instrutor, created_at
          FROM treinamento_usuarios
          WHERE tipo IN ('professor', 'admin') AND ativo = 1
          ORDER BY nome ASC
        `).all();
        return jsonResponse(res, instrutores);
      }

      // CADASTRAR INSTRUTOR / PROFESSOR (ADMIN)
      if (pathname === '/api/treinamento/instrutores' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.nome || !body.login || !body.senha) {
          return errorResponse(res, 'Nome, Login e Senha sÃ£o obrigatÃ³rios para o instrutor', 400);
        }

        try {
          const resIns = db.prepare(`
            INSERT INTO treinamento_usuarios (
              nome, email, login, senha, tipo, bio, especialidade, foto_url, mensagem_instrutor, ativo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).run(
            body.nome.trim(),
            body.email ? body.email.trim() : null,
            body.login.trim(),
            body.senha.trim(),
            body.tipo || 'professor',
            body.bio || '',
            body.especialidade || '',
            body.foto_url || '',
            body.mensagem_instrutor || ''
          );
          return jsonResponse(res, { success: true, id: resIns.lastInsertRowid, message: 'Instrutor cadastrado com sucesso!' });
        } catch (err) {
          if (err.message && err.message.includes('UNIQUE')) {
            return errorResponse(res, 'Este login de instrutor jÃ¡ estÃ¡ em uso.', 400);
          }
          throw err;
        }
      }

      // ATUALIZAR INSTRUTOR
      if (pathname.match(/^\/api\/treinamento\/instrutores\/\d+$/) && method === 'PUT') {
        const instId = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        let sql = `
          UPDATE treinamento_usuarios SET
            nome = COALESCE(?, nome),
            email = COALESCE(?, email),
            bio = COALESCE(?, bio),
            especialidade = COALESCE(?, especialidade),
            foto_url = COALESCE(?, foto_url),
            mensagem_instrutor = COALESCE(?, mensagem_instrutor)
        `;
        const params = [body.nome || null, body.email || null, body.bio !== undefined ? body.bio : null, body.especialidade !== undefined ? body.especialidade : null, body.foto_url !== undefined ? body.foto_url : null, body.mensagem_instrutor !== undefined ? body.mensagem_instrutor : null];

        if (body.senha && body.senha.trim()) {
          sql += ', senha = ? ';
          params.push(body.senha.trim());
        }
        sql += ' WHERE id = ? ';
        params.push(instId);

        db.prepare(sql).run(...params);
        return jsonResponse(res, { success: true, message: 'Instrutor atualizado com sucesso!' });
      }

      // EXCLUIR INSTRUTOR
      if (pathname.match(/^\/api\/treinamento\/instrutores\/\d+$/) && method === 'DELETE') {
        const instId = parseInt(pathname.split('/')[4], 10);
        db.prepare('UPDATE treinamento_usuarios SET ativo = 0 WHERE id = ?').run(instId);
        return jsonResponse(res, { success: true, message: 'Instrutor desativado com sucesso!' });
      }

      // LISTAR CURSOS
      if (pathname === '/api/treinamento/cursos' && method === 'GET') {
        const usuarioId = query.usuario_id ? parseInt(query.usuario_id, 10) : null;
        let cursos = db.prepare(`
          SELECT c.*,
                 u.nome as instrutor_nome,
                 u.foto_url as instrutor_foto,
                 u.especialidade as instrutor_especialidade,
                 (SELECT COUNT(*) FROM treinamento_modulos m WHERE m.curso_id = c.id) as total_modulos,
                 (SELECT COUNT(*) FROM treinamento_aulas a JOIN treinamento_modulos m ON a.modulo_id = m.id WHERE m.curso_id = c.id) as total_aulas,
                 (SELECT COUNT(*) FROM treinamento_matriculas mat WHERE mat.curso_id = c.id) as total_alunos
          FROM treinamento_cursos c
          LEFT JOIN treinamento_usuarios u ON c.instrutor_id = u.id
          WHERE c.ativo = 1
          ORDER BY c.id DESC
        `).all();

        if (usuarioId) {
          const matriculas = db.prepare('SELECT * FROM treinamento_matriculas WHERE usuario_id = ?').all(usuarioId);
          const matMap = new Map(matriculas.map(m => [m.curso_id, m]));
          cursos = cursos.map(c => ({
            ...c,
            matriculado: matMap.has(c.id),
            matricula: matMap.get(c.id) || null
          }));
        }

        return jsonResponse(res, cursos);
      }

      // CRIAR CURSO
      if (pathname === '/api/treinamento/cursos' && method === 'POST') {
        const body = await parseRequestBody(req);
        if (!body.titulo) return errorResponse(res, 'TÃ­tulo do curso Ã© obrigatÃ³rio', 400);

        const resIns = db.prepare(`
          INSERT INTO treinamento_cursos (
            titulo, descricao, categoria, carga_horaria_horas, capa_url, instrutor_id, ativo
          ) VALUES (?, ?, ?, ?, ?, ?, 1)
        `).run(
          body.titulo.trim(),
          body.descricao || '',
          body.categoria || 'Geral',
          parseInt(body.carga_horaria_horas, 10) || 2,
          body.capa_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
          body.instrutor_id ? parseInt(body.instrutor_id, 10) : null
        );

        return jsonResponse(res, { success: true, id: resIns.lastInsertRowid, message: 'Curso criado com sucesso!' });
      }

      // EDITAR CURSO
      if (pathname.match(/^\/api\/treinamento\/cursos\/\d+$/) && method === 'PUT') {
        const cursoId = parseInt(pathname.split('/')[4], 10);
        const body = await parseRequestBody(req);

        db.prepare(`
          UPDATE treinamento_cursos SET
            titulo = COALESCE(?, titulo),
            descricao = COALESCE(?, descricao),
            categoria = COALESCE(?, categoria),
            carga_horaria_horas = COALESCE(?, carga_horaria_horas),
            capa_url = COALESCE(?, capa_url),
            instrutor_id = COALESCE(?, instrutor_id)
          WHERE id = ?
        `).run(
          body.titulo || null,
          body.descricao !== undefined ? body.descricao : null,
          body.categoria || null,
          body.carga_horaria_horas ? parseInt(body.carga_horaria_horas, 10) : null,
          body.capa_url !== undefined ? body.capa_url : null,
          body.instrutor_id !== undefined ? (body.instrutor_id ? parseInt(body.instrutor_id, 10) : null) : null,
          cursoId
        );

        return jsonResponse(res, { success: true, message: 'Curso atualizado com sucesso!' });
      }

      // EXCLUIR CURSO
      if (pathname.match(/^\/api\/treinamento\/cursos\/\d+$/) && method === 'DELETE') {
        const cursoId = parseInt(pathname.split('/')[4], 10);
        db.prepare('UPDATE treinamento_cursos SET ativo = 0 WHERE id = ?').run(cursoId);
        return jsonResponse(res, { success: true, message: 'Curso excluÃ­do com sucesso!' });
      }

      // DETALHES COMPLETOS DO CURSO COM MÃ“DULOS, AULAS E PROVA
      if (pathname.match(/^\/api\/treinamento\/cursos\/\d+\/detalhes$/) && method === 'GET') {
        const cursoId = parseInt(pathname.split('/')[4], 10);
        const curso = db.prepare(`
          SELECT c.*, u.nome as instrutor_nome, u.bio as instrutor_bio, u.foto_url as instrutor_foto, u.mensagem_instrutor
          FROM treinamento_cursos c
          LEFT JOIN treinamento_usuarios u ON c.instrutor_id = u.id
          WHERE c.id = ?
        `).get(cursoId);

        if (!curso) return errorResponse(res, 'Curso nÃ£o encontrado', 404);

        const modulos = db.prepare(`
          SELECT * FROM treinamento_modulos WHERE curso_id = ? ORDER BY ordem ASC, id ASC
        `).all(cursoId);

        for (const mod of modulos) {
          mod.aulas = db.prepare(`
            SELECT * FROM treinamento_aulas WHERE modulo_id = ? ORDER BY ordem ASC, id ASC
          `).all(mod.id);
        }

        const prova = db.prepare(`
          SELECT * FROM treinamento_provas WHERE curso_id = ? AND ativo = 1 ORDER BY id DESC LIMIT 1
        `).get(cursoId);

        if (prova && prova.questoes_json) {
          try { prova.questoes = JSON.parse(prova.questoes_json); } catch(e) { prova.questoes = []; }
        }

        return jsonResponse(res, { curso, modulos, prova });
      }

      // ADICIONAR MÃ“DULO AO CURSO
      if (pathname === '/api/treinamento/modulos' && method === 'POST') {
        const { curso_id, titulo, ordem } = await parseRequestBody(req);
        if (!curso_id || !titulo) return errorResponse(res, 'Curso e tÃ­tulo do mÃ³dulo sÃ£o obrigatÃ³rios', 400);

        const resIns = db.prepare(`
          INSERT INTO treinamento_modulos (curso_id, titulo, ordem) VALUES (?, ?, ?)
        `).run(parseInt(curso_id, 10), titulo.trim(), parseInt(ordem, 10) || 1);

        return jsonResponse(res, { success: true, id: resIns.lastInsertRowid, message: 'MÃ³dulo adicionado com sucesso!' });
      }

      // EXCLUIR MÃ“DULO
      if (pathname.match(/^\/api\/treinamento\/modulos\/\d+$/) && method === 'DELETE') {
        const modId = parseInt(pathname.split('/')[4], 10);
        db.prepare('DELETE FROM treinamento_aulas WHERE modulo_id = ?').run(modId);
        db.prepare('DELETE FROM treinamento_modulos WHERE id = ?').run(modId);
        return jsonResponse(res, { success: true, message: 'MÃ³dulo e suas aulas excluÃ­dos!' });
      }

      // ADICIONAR AULA AO MÃ“DULO
      if (pathname === '/api/treinamento/aulas' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { modulo_id, titulo, tipo_conteudo, video_url, conteudo_texto, material_apoio_url, duracao_minutos, ordem } = body;

        if (!modulo_id || !titulo) return errorResponse(res, 'MÃ³dulo e tÃ­tulo da aula sÃ£o obrigatÃ³rios', 400);

        let finalVideoUrl = video_url ? video_url.trim() : '';
        if (finalVideoUrl.includes('youtube.com/watch?v=')) {
          const vId = finalVideoUrl.split('watch?v=')[1].split('&')[0];
          finalVideoUrl = `https://www.youtube.com/embed/${vId}`;
        } else if (finalVideoUrl.includes('youtu.be/')) {
          const vId = finalVideoUrl.split('youtu.be/')[1].split('?')[0];
          finalVideoUrl = `https://www.youtube.com/embed/${vId}`;
        }

        const resIns = db.prepare(`
          INSERT INTO treinamento_aulas (
            modulo_id, titulo, tipo_conteudo, video_url, conteudo_texto, material_apoio_url, duracao_minutos, ordem
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          parseInt(modulo_id, 10),
          titulo.trim(),
          tipo_conteudo || 'video',
          finalVideoUrl,
          conteudo_texto || '',
          material_apoio_url || '',
          parseInt(duracao_minutos, 10) || 10,
          parseInt(ordem, 10) || 1
        );

        return jsonResponse(res, { success: true, id: resIns.lastInsertRowid, message: 'Aula adicionada com sucesso!' });
      }

      // EXCLUIR AULA
      if (pathname.match(/^\/api\/treinamento\/aulas\/\d+$/) && method === 'DELETE') {
        const aulaId = parseInt(pathname.split('/')[4], 10);
        db.prepare('DELETE FROM treinamento_aulas WHERE id = ?').run(aulaId);
        return jsonResponse(res, { success: true, message: 'Aula removida com sucesso!' });
      }

      // SALVAR PROVA DIDÃTICA DO CURSO
      if (pathname.match(/^\/api\/treinamento\/cursos\/\d+\/prova$/) && method === 'POST') {
        const cursoId = parseInt(pathname.split('/')[4], 10);
        const { titulo, nota_minima_aprovacao, questoes } = await parseRequestBody(req);

        if (!questoes || !Array.isArray(questoes) || questoes.length === 0) {
          return errorResponse(res, 'Adicione pelo menos 1 questÃ£o Ã  prova', 400);
        }

        const qJson = JSON.stringify(questoes);
        const notaMin = parseFloat(nota_minima_aprovacao) || 70;

        const provaExistente = db.prepare('SELECT id FROM treinamento_provas WHERE curso_id = ?').get(cursoId);
        if (provaExistente) {
          db.prepare(`
            UPDATE treinamento_provas SET
              titulo = ?,
              nota_minima_aprovacao = ?,
              questoes_json = ?,
              ativo = 1
            WHERE id = ?
          `).run(titulo || 'AvaliaÃ§Ã£o DidÃ¡tica', notaMin, qJson, provaExistente.id);
        } else {
          db.prepare(`
            INSERT INTO treinamento_provas (curso_id, titulo, nota_minima_aprovacao, questoes_json, ativo)
            VALUES (?, ?, ?, ?, 1)
          `).run(cursoId, titulo || 'AvaliaÃ§Ã£o DidÃ¡tica', notaMin, qJson);
        }

        return jsonResponse(res, { success: true, message: 'Prova didÃ¡tica configurada com sucesso!' });
      }

      // RESPONDER PROVA DIDÃTICA (ALUNO)
      if (pathname.match(/^\/api\/treinamento\/cursos\/\d+\/responder-prova$/) && method === 'POST') {
        const cursoId = parseInt(pathname.split('/')[4], 10);
        const { usuario_id, respostas } = await parseRequestBody(req);

        if (!usuario_id || !respostas) return errorResponse(res, 'Dados da avaliaÃ§Ã£o incompletos', 400);

        const prova = db.prepare('SELECT * FROM treinamento_provas WHERE curso_id = ? AND ativo = 1').get(cursoId);
        if (!prova) return errorResponse(res, 'Prova didÃ¡tica nÃ£o configurada para este curso', 404);

        let questoes = [];
        try { questoes = JSON.parse(prova.questoes_json); } catch(e) {}
        if (questoes.length === 0) return errorResponse(res, 'Prova sem questÃµes cadastradas', 400);

        let acertos = 0;
        questoes.forEach((q, idx) => {
          if (respostas[idx] !== undefined && parseInt(respostas[idx], 10) === parseInt(q.correta, 10)) {
            acertos++;
          }
        });

        const notaPercent = Math.round((acertos / questoes.length) * 100);
        const aprovado = notaPercent >= (prova.nota_minima_aprovacao || 70);
        const status = aprovado ? 'Aprovado' : 'Reprovado';

        db.prepare(`
          INSERT INTO treinamento_matriculas (usuario_id, curso_id, progresso_percent, nota_prova, status, data_conclusao)
          VALUES (?, ?, 100, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(usuario_id, curso_id) DO UPDATE SET
            progresso_percent = 100,
            nota_prova = excluded.nota_prova,
            status = excluded.status,
            data_conclusao = CURRENT_TIMESTAMP
        `).run(usuario_id, cursoId, notaPercent, status);

        return jsonResponse(res, {
          success: true,
          acertos,
          total_questoes: questoes.length,
          nota: notaPercent,
          aprovado,
          nota_minima: prova.nota_minima_aprovacao,
          mensagem: aprovado
            ? `ParabÃ©ns! VocÃª obteve ${notaPercent}% de aproveitamento e foi APROVADO(A) no treinamento!`
            : `VocÃª atingiu ${notaPercent}% de aproveitamento (mÃ­nimo exigido: ${prova.nota_minima_aprovacao}%). Revise as matÃ©rias e tente novamente.`
        });
      }

      // LISTAR ALUNOS DO EAD
      if (pathname === '/api/treinamento/alunos' && method === 'GET') {
        const alunos = db.prepare(`
          SELECT u.id, u.nome, u.email, u.login, u.ativo, u.created_at,
                 (SELECT COUNT(*) FROM treinamento_matriculas m WHERE m.usuario_id = u.id) as total_cursos,
                 (SELECT COUNT(*) FROM treinamento_matriculas m WHERE m.usuario_id = u.id AND m.status = 'Aprovado') as cursos_concluidos
          FROM treinamento_usuarios u
          WHERE u.tipo = 'aluno' AND u.ativo = 1
          ORDER BY u.nome ASC
        `).all();
        return jsonResponse(res, alunos);
      }

      // CADASTRAR ALUNO COM LOGIN E SENHA (PROFESSOR OU ADMIN)
      if (pathname === '/api/treinamento/alunos' && method === 'POST') {
        const body = await parseRequestBody(req);
        const { nome, email, login, senha, curso_ids } = body;

        if (!nome || !login || !senha) {
          return errorResponse(res, 'Nome, Login e Senha sÃ£o obrigatÃ³rios para criar o acesso do aluno', 400);
        }

        try {
          const resIns = db.prepare(`
            INSERT INTO treinamento_usuarios (nome, email, login, senha, tipo, ativo)
            VALUES (?, ?, ?, ?, 'aluno', 1)
          `).run(nome.trim(), email ? email.trim() : null, login.trim(), senha.trim());

          const novoAlunoId = resIns.lastInsertRowid;

          if (Array.isArray(curso_ids) && curso_ids.length > 0) {
            const stmtMat = db.prepare(`
              INSERT OR IGNORE INTO treinamento_matriculas (usuario_id, curso_id, progresso_percent, status)
              VALUES (?, ?, 0, 'Em Andamento')
            `);
            for (const cId of curso_ids) {
              stmtMat.run(novoAlunoId, parseInt(cId, 10));
            }
          }

          return jsonResponse(res, {
            success: true,
            id: novoAlunoId,
            message: `Acesso do aluno "${nome}" criado com sucesso! Login: ${login}`
          });
        } catch (err) {
          if (err.message && err.message.includes('UNIQUE')) {
            return errorResponse(res, `O login "${login}" jÃ¡ estÃ¡ em uso por outro aluno ou professor. Escolha outro.`, 400);
          }
          throw err;
        }
      }

      // MATRICULAR ALUNO EM CURSO
      if (pathname === '/api/treinamento/matriculas' && method === 'POST') {
        const { usuario_id, curso_id } = await parseRequestBody(req);
        if (!usuario_id || !curso_id) return errorResponse(res, 'UsuÃ¡rio e Curso sÃ£o obrigatÃ³rios', 400);

        db.prepare(`
          INSERT INTO treinamento_matriculas (usuario_id, curso_id, progresso_percent, status)
          VALUES (?, ?, 0, 'Em Andamento')
          ON CONFLICT(usuario_id, curso_id) DO NOTHING
        `).run(parseInt(usuario_id, 10), parseInt(curso_id, 10));

        return jsonResponse(res, { success: true, message: 'MatrÃ­cula realizada com sucesso!' });
      }

      // =============================================================
      // ROTAS: PORTAL DE DENÃšNCIAS & COORDENAÃ‡ÃƒO OPERACIONAL (LGPD)
      // =============================================================

      // ENVIAR DENÃšNCIA (ACESSO PÃšBLICO EXTERNO)
      if (pathname === '/api/denuncias/publico' && method === 'POST') {
        const body = await parseRequestBody(req);
        const {
          tipo,
          nome_denunciante,
          cpf_denunciante,
          email_denunciante,
          telefone_denunciante,
          categoria,
          unidade_ou_local,
          data_ocorrencia,
          pessoas_envolvidas,
          testemunhas,
          descricao_detalhada,
          evidencias_anexos
        } = body;

        if (!descricao_detalhada || !categoria) {
          return errorResponse(res, 'Categoria e descriÃ§Ã£o dos fatos sÃ£o obrigatÃ³rios para registrar a manifestaÃ§Ã£o.', 400);
        }

        const isAnonimo = tipo === 'Anonima' || !nome_denunciante;
        const anoAtual = new Date().getFullYear();
        const hashAleatorio = crypto.randomBytes(3).toString('hex').toUpperCase();
        const protocolo = `DEN-${anoAtual}-${hashAleatorio}`;

        db.prepare(`
          INSERT INTO denuncias (
            protocolo, tipo, nome_denunciante, cpf_denunciante, email_denunciante, telefone_denunciante,
            categoria, unidade_ou_local, data_ocorrencia, pessoas_envolvidas, testemunhas,
            descricao_detalhada, evidencias_anexos, status, gravidade, responsavel_setor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Nova', 'MÃ©dia', 'CoordenaÃ§Ã£o Operacional')
        `).run(
          protocolo,
          isAnonimo ? 'Anonima' : 'Identificada',
          isAnonimo ? null : (nome_denunciante || '').trim(),
          isAnonimo ? null : (cpf_denunciante || '').trim(),
          isAnonimo ? null : (email_denunciante || '').trim(),
          isAnonimo ? null : (telefone_denunciante || '').trim(),
          categoria,
          unidade_ou_local || '',
          data_ocorrencia || null,
          pessoas_envolvidas || '',
          testemunhas || '',
          descricao_detalhada.trim(),
          evidencias_anexos || ''
        );

        return jsonResponse(res, {
          success: true,
          protocolo,
          mensagem: 'ManifestaÃ§Ã£o registrada com sucesso sob total sigilo e proteÃ§Ã£o pela LGPD. Guarde o protocolo para acompanhar o andamento.'
        });
      }

      // CONSULTAR ANDAMENTO DA DENÃšNCIA POR PROTOCOLO (PÃšBLICO)
      if (pathname === '/api/denuncias/publico/consultar' && method === 'GET') {
        const proto = (query.protocolo || '').trim();
        if (!proto) return errorResponse(res, 'Informe o nÃºmero do protocolo.', 400);

        const d = db.prepare(`
          SELECT protocolo, categoria, unidade_ou_local, status, responsavel_setor,
                 parecer_final, created_at, data_conclusao
          FROM denuncias
          WHERE UPPER(protocolo) = UPPER(?)
        `).get(proto);

        if (!d) return errorResponse(res, 'Protocolo nÃ£o localizado. Verifique se o cÃ³digo digitado estÃ¡ correto.', 404);

        return jsonResponse(res, {
          success: true,
          denuncia: {
            protocolo: d.protocolo,
            categoria: d.categoria,
            unidade: d.unidade_ou_local || 'Geral',
            status: d.status,
            setor_responsavel: d.responsavel_setor,
            data_abertura: d.created_at,
            data_conclusao: d.data_conclusao,
            parecer_conclusivo: d.parecer_final || 'ManifestaÃ§Ã£o em fase de averiguaÃ§Ã£o pela CoordenaÃ§Ã£o Operacional.'
          }
        });
      }

      // LISTAR DENÃšNCIAS (INTERNO - COORDENAÃ‡ÃƒO OPERACIONAL E MASTER)
      if (pathname === '/api/denuncias' && method === 'GET') {
        let sql = ' SELECT * FROM denuncias WHERE col.nome != "\[SISTEMA\] SERVIÇO EXTRA" ';
        const params = [];

        if (query.status && query.status !== 'todos') {
          sql += ' AND status = ? ';
          params.push(query.status);
        }
        if (query.categoria) {
          sql += ' AND categoria = ? ';
          params.push(query.categoria);
        }
        if (query.gravidade) {
          sql += ' AND gravidade = ? ';
          params.push(query.gravidade);
        }
        if (query.busca) {
          sql += ' AND (protocolo LIKE ? OR descricao_detalhada LIKE ? OR pessoas_envolvidas LIKE ? OR unidade_ou_local LIKE ?) ';
          const b = `%${query.busca}%`;
          params.push(b, b, b, b);
        }

        sql += " ORDER BY CASE status WHEN 'Nova' THEN 1 WHEN 'Em AnÃ¡lise' THEN 2 WHEN 'Em AveriguaÃ§Ã£o' THEN 3 ELSE 4 END, id DESC ";
        const lista = db.prepare(sql).all(...params);
        return jsonResponse(res, lista);
      }

      // DETALHES DE UMA DENÃšNCIA
      if (pathname.match(/^\/api\/denuncias\/\d+$/) && method === 'GET') {
        const denId = parseInt(pathname.split('/')[3], 10);
        const d = db.prepare('SELECT * FROM denuncias WHERE id = ?').get(denId);
        if (!d) return errorResponse(res, 'DenÃºncia nÃ£o encontrada', 404);
        return jsonResponse(res, d);
      }

      // ATUALIZAR TRATATIVAS / STATUS DA DENÃšNCIA (COORDENAÃ‡ÃƒO OPERACIONAL)
      if (pathname.match(/^\/api\/denuncias\/\d+\/tratativa$/) && method === 'PUT') {
        const denId = parseInt(pathname.split('/')[3], 10);
        const d = db.prepare('SELECT * FROM denuncias WHERE id = ?').get(denId);
        if (!d) return errorResponse(res, 'DenÃºncia nÃ£o encontrada', 404);

        const body = await parseRequestBody(req);
        const { status, gravidade, responsavel_setor, nova_tratativa, autor_tratativa, parecer_final, encerrar } = body;

        let tratativasAtualizadas = d.tratativas || '';
        if (nova_tratativa && nova_tratativa.trim()) {
          const agoraStr = new Date().toLocaleString('pt-BR');
          const autor = autor_tratativa || 'CoordenaÃ§Ã£o Operacional';
          const entrada = `[${agoraStr} - ${autor}]: ${nova_tratativa.trim()}\n`;
          tratativasAtualizadas = (tratativasAtualizadas ? tratativasAtualizadas + '\n' : '') + entrada;
        }

        const dataConclusao = (encerrar || (status && status.includes('ConcluÃ­da')) || status === 'Arquivada')
          ? new Date().toISOString()
          : (status === 'Nova' ? null : d.data_conclusao);

        db.prepare(`
          UPDATE denuncias SET
            status = COALESCE(?, status),
            gravidade = COALESCE(?, gravidade),
            responsavel_setor = COALESCE(?, responsavel_setor),
            tratativas = ?,
            parecer_final = COALESCE(?, parecer_final),
            data_conclusao = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          status || null,
          gravidade || null,
          responsavel_setor || null,
          tratativasAtualizadas,
          parecer_final !== undefined ? parecer_final : null,
          dataConclusao,
          denId
        );

        const dAtualizada = db.prepare('SELECT * FROM denuncias WHERE id = ?').get(denId);
        return jsonResponse(res, { success: true, denuncia: dAtualizada, message: 'Tratativa registrada com sucesso!' });
      }

      
        // ==========================================
        // MÓDULO DE UNIFORMES
        // ==========================================

        if (pathname === '/api/uniformes/regras' && method === 'GET') {
          const regras = db.prepare('SELECT * FROM uniformes_regras ORDER BY funcao ASC, item ASC').all();
          return jsonResponse(res, regras);
        }

        if (pathname === '/api/uniformes/colaboradores' && method === 'GET') {
          const colabs = db.prepare("SELECT c.id, c.nome, c.cpf, c.status_colaborador, cg.nome_cargo, uc.sexo, uc.tamanho_camisa, uc.tamanho_calca, uc.tamanho_sapato, uc.tamanho_jaqueta, uc.tamanho_blazer FROM colaboradores c LEFT JOIN cargos cg ON c.cargo_id = cg.id LEFT JOIN uniformes_colaboradores uc ON c.id = uc.colaborador_id WHERE c.ativo = 1 ORDER BY c.nome ASC").all();
          return jsonResponse(res, colabs);
        }

        if (pathname.startsWith('/api/uniformes/colaboradores/') && method === 'PUT') {
          const id = parseInt(pathname.split('/').pop(), 10);
          const body = await parseRequestBody(req);
          
          const uc = db.prepare('SELECT id FROM uniformes_colaboradores WHERE colaborador_id = ?').get(id);
          if (uc) {
            db.prepare("UPDATE uniformes_colaboradores SET sexo = ?, tamanho_camisa = ?, tamanho_calca = ?, tamanho_sapato = ?, tamanho_jaqueta = ?, tamanho_blazer = ? WHERE colaborador_id = ?").run(body.sexo || null, body.tamanho_camisa || null, body.tamanho_calca || null, body.tamanho_sapato || null, body.tamanho_jaqueta || null, body.tamanho_blazer || null, id);
          } else {
            db.prepare("INSERT INTO uniformes_colaboradores (colaborador_id, sexo, tamanho_camisa, tamanho_calca, tamanho_sapato, tamanho_jaqueta, tamanho_blazer) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, body.sexo || null, body.tamanho_camisa || null, body.tamanho_calca || null, body.tamanho_sapato || null, body.tamanho_jaqueta || null, body.tamanho_blazer || null);
          }
          return jsonResponse(res, { success: true });
        }

        if (pathname === '/api/uniformes/gerar-necessidades' && method === 'GET') {
          const colabs = db.prepare("SELECT c.id, c.nome, cg.nome_cargo, uc.sexo, uc.tamanho_camisa, uc.tamanho_calca, uc.tamanho_sapato, uc.tamanho_jaqueta, uc.tamanho_blazer FROM colaboradores c LEFT JOIN cargos cg ON c.cargo_id = cg.id LEFT JOIN uniformes_colaboradores uc ON c.id = uc.colaborador_id WHERE c.ativo = 1").all();
          const regras = db.prepare('SELECT * FROM uniformes_regras WHERE ativo = 1').all();
          
          let necessidades = [];

          for (const c of colabs) {
            if (!c.nome_cargo) continue;
            const regrasCargo = regras.filter(r => c.nome_cargo.toUpperCase().includes(r.funcao.toUpperCase()) || r.funcao.toUpperCase() === 'TODOS');
            
            for (const r of regrasCargo) {
              if (r.sexo_aplicavel && r.sexo_aplicavel !== 'TODOS' && r.sexo_aplicavel.trim() !== '') {
                if (c.sexo && !r.sexo_aplicavel.toUpperCase().includes(c.sexo.toUpperCase())) {
                  continue; 
                }
              }

              let tam = '';
              const itemUpper = r.item.toUpperCase();
              if (itemUpper.includes('CAMISA') || itemUpper.includes('JALECO') || itemUpper.includes('POLO')) tam = c.tamanho_camisa;
              else if (itemUpper.includes('CALÇA') || itemUpper.includes('CALCA')) tam = c.tamanho_calca;
              else if (itemUpper.includes('SAPATO') || itemUpper.includes('BOTA') || itemUpper.includes('BOTINA')) tam = c.tamanho_sapato;
              else if (itemUpper.includes('JAQUETA')) tam = c.tamanho_jaqueta;
              else if (itemUpper.includes('BLAZER')) tam = c.tamanho_blazer;

              if (!tam && r.tamanhos_disponiveis) tam = 'SEM MEDIDA'; 

              necessidades.push({
                colaborador_id: c.id,
                colaborador_nome: c.nome,
                cargo: c.nome_cargo,
                item: r.item,
                quantidade: r.quantidade,
                tamanho: tam || 'N/A'
              });
            }
          }
          return jsonResponse(res, necessidades);
        }

return errorResponse(res, 'Endpoint nÃ£o encontrado', 404);

    } catch (err) {
      console.error('Erro na API:', err);
      return errorResponse(res, err.message || 'Erro interno no servidor', 500);
    }
  }

  // ARQUIVOS ESTÃTICOS & ROTAS DE PÃGINAS
  const cleanPath = (pathname.endsWith('/') && pathname.length > 1) ? pathname.replace(/\/+$/, '') : pathname;
  const lowerPath = cleanPath.toLowerCase();

  let targetFile = lowerPath === '/' ? 'index.html' : 
                   (lowerPath === '/supervisor' ? 'supervisor.html' : 
                   (lowerPath === '/treinamentos' || lowerPath === '/treinamento' || lowerPath === '/ead' || lowerPath === '/cursos' ? 'treinamentos.html' : 
                   (lowerPath === '/denuncias' || lowerPath === '/denuncia' || lowerPath === '/ouvidoria' || lowerPath === '/canal-denuncia' || lowerPath === '/canal-denuncias' ? 'denuncias.html' : 
                   (lowerPath === '/pedido-unidade' ? 'pedido-unidade.html' : pathname))));

  let filePath = path.join(PUBLIC_DIR, targetFile);
  const safePath = path.normalize(filePath);
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso Negado');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (err2, content) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('PÃ¡gina nÃ£o encontrada');
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(safePath, (errRead, content) => {
      if (errRead) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Erro ao ler arquivo');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = obterIpLocal();
  console.log(`=======================================================`);
  console.log(`SISFAC 2.0 - Servidor rodando em: http://localhost:${PORT}`);
  console.log(`Acesso Celular / Rede Wi-Fi: http://${ip}:${PORT}/supervisor`);
  console.log(`=======================================================`);
  iniciarOuVerificarTunnel();
});











