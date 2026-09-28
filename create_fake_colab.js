const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('banco_dados.sqlite');

let fakeColab = db.prepare("SELECT id FROM colaboradores WHERE nome = '[SISTEMA] SERVI?O EXTRA'").get();
if (!fakeColab) {
  const res = db.prepare(`
    INSERT INTO colaboradores (nome, cpf, cargo_id, ativo, status_colaborador)
    VALUES (?, ?, ?, ?, ?)
  `).run('[SISTEMA] SERVI?O EXTRA', '000.000.000-00', 1, 1, 'Ativo');
  console.log("Criado fake colab ID:", res.lastInsertRowid);
} else {
  console.log("J? existe fake colab ID:", fakeColab.id);
}
