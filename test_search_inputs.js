// test_search_inputs.js - Verifica a existência dos componentes de barra de pesquisa no supervisor.html
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'supervisor.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const requiredElements = [
  'inputBuscaColaborador',
  'boxSugestoesColaborador',
  'badgeColabSelecionado',
  'inputBuscaCobertor',
  'boxSugestoesCobertor',
  'inputBuscaCliente',
  'inputBuscaFreelancer',
  'aoDigitarBuscaColaborador',
  'selecionarColaboradorPorSugestao',
  'limparBuscaColaborador',
  'aoDigitarBuscaCobertor',
  'selecionarCobertorPorSugestao',
  'limparBuscaCobertor'
];

let allOk = true;
requiredElements.forEach(el => {
  if (content.includes(el)) {
    console.log(`✅ Encontrado: ${el}`);
  } else {
    console.error(`❌ FALTANDO: ${el}`);
    allOk = false;
  }
});

// Testar validação de sintaxe de todos os blocos <script>
const scripts = content.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/g) || [];
scripts.forEach((s, idx) => {
  const code = s.replace(/<script[\s\S]*?>/, '').replace(/<\/script>/, '');
  if (code.trim() && !s.includes('src=')) {
    try {
      new Function(code);
      console.log(`✅ Bloco de Script ${idx + 1}: Sintaxe 100% VÁLIDA!`);
    } catch (err) {
      console.error(`❌ Erro de sintaxe no Script ${idx + 1}:`, err);
      allOk = false;
    }
  }
});

if (!allOk) process.exit(1);
console.log('\n>>> TODOS OS TESTES DA BARRA DE PESQUISA PASSARAM COM SUCESSO! <<<');
