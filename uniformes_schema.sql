CREATE TABLE IF NOT EXISTS uniformes_regras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  funcao TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  item TEXT NOT NULL,
  tamanhos_disponiveis TEXT,
  sexo_aplicavel TEXT,
  ativo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS uniformes_colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL,
  tamanho_camisa TEXT,
  tamanho_calca TEXT,
  tamanho_sapato TEXT,
  tamanho_jaqueta TEXT,
  tamanho_blazer TEXT,
  sexo TEXT,
  UNIQUE(colaborador_id),
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orcamentos_uniformes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_geracao DATE NOT NULL,
  status TEXT DEFAULT 'Aberto',
  valor_total REAL DEFAULT 0,
  observacoes TEXT,
  criado_por TEXT
);

CREATE TABLE IF NOT EXISTS orcamentos_uniformes_fornecedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orcamento_id INTEGER NOT NULL,
  fornecedor_id INTEGER,
  nome_fornecedor TEXT NOT NULL,
  valor_total_fornecedor REAL DEFAULT 0,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos_uniformes(id) ON DELETE CASCADE,
  FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orcamentos_uniformes_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orcamento_id INTEGER NOT NULL,
  orcamento_fornecedor_id INTEGER,
  colaborador_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  tamanho TEXT,
  valor_unitario REAL DEFAULT 0,
  valor_total REAL DEFAULT 0,
  entregue INTEGER DEFAULT 0,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos_uniformes(id) ON DELETE CASCADE,
  FOREIGN KEY (orcamento_fornecedor_id) REFERENCES orcamentos_uniformes_fornecedores(id) ON DELETE SET NULL,
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
);
