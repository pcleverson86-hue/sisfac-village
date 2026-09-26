// treinamentos.js - Frontend Dinâmico da Plataforma de Treinamentos EAD

const stateEad = {
  usuario: null, // { id, nome, login, tipo: 'admin'|'professor'|'aluno' }
  config: null,
  cursos: [],
  instrutores: [],
  cursoAtivoDetalhes: null,
  aulaAtiva: null,
  cursoGerenciandoId: null,
  provaAtiva: null,
  respostasProva: {}
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  restaurarSessaoLocal();
  await carregarConfiguracaoEad();
  await carregarCursosEad();
  await carregarInstrutoresEad();
  atualizarUiAutenticacao();
});

function restaurarSessaoLocal() {
  try {
    const raw = localStorage.getItem('sisfac_ead_user');
    if (raw) stateEad.usuario = JSON.parse(raw);
  } catch (e) {
    stateEad.usuario = null;
  }
}

// 1. CONFIGURAÇÕES & CORES WHITE-LABEL
async function carregarConfiguracaoEad() {
  try {
    const res = await fetch('/api/treinamento/config');
    const data = await res.json();
    stateEad.config = data;

    // Aplicar na tela
    document.getElementById('topNomePlataforma').innerText = data.nome_plataforma || 'Academia de Treinamentos';
    document.getElementById('topSloganPlataforma').innerText = data.slogan || 'Desenvolvimento profissional e excelência operacional';
    document.getElementById('rodapeNomePlataforma').innerText = data.nome_plataforma || 'Academia de Treinamentos & Capacitação';
    document.title = `${data.nome_plataforma || 'Academia de Treinamentos'} - Portal EAD`;

    // Logo
    const logoImg = document.getElementById('topLogoImg');
    const logoIcon = document.getElementById('topLogoIcon');
    if (data.logo_url && data.logo_url.trim()) {
      logoImg.src = data.logo_url;
      logoImg.classList.remove('hidden');
      logoIcon.classList.add('hidden');
    } else {
      logoImg.classList.add('hidden');
      logoIcon.classList.remove('hidden');
    }

    // Banner Hero (Capa Principal do Catálogo)
    const heroBanner = document.getElementById('bannerHeroContainer');
    if (heroBanner) {
      if (data.banner_url && data.banner_url.trim()) {
        heroBanner.style.backgroundImage = `linear-gradient(to right, rgba(15, 23, 42, 0.90) 0%, rgba(15, 23, 42, 0.72) 50%, rgba(13, 148, 136, 0.40) 100%), url('${data.banner_url}')`;
        heroBanner.style.backgroundSize = 'cover';
        heroBanner.style.backgroundPosition = 'center';
      } else {
        heroBanner.style.backgroundImage = '';
      }
    }

    // Exibir botão de editar capa no banner se admin/master logado
    const editBtnBox = document.getElementById('bannerHeroEditBtnBox');
    if (editBtnBox) {
      if (stateEad.usuario && stateEad.usuario.tipo === 'admin') {
        editBtnBox.classList.remove('hidden');
      } else {
        editBtnBox.classList.add('hidden');
      }
    }

    // Cores CSS
    if (data.cor_primaria) {
      document.documentElement.style.setProperty('--cor-primaria', data.cor_primaria);
    }
    if (data.cor_secundaria) {
      document.documentElement.style.setProperty('--cor-secundaria', data.cor_secundaria);
    }

    // Preencher campos do form admin se existirem
    const elNome = document.getElementById('cfgNomePlataforma');
    if (elNome) {
      elNome.value = data.nome_plataforma || '';
      document.getElementById('cfgSlogan').value = data.slogan || '';
      document.getElementById('cfgCorPrimaria').value = data.cor_primaria || '#0d9488';
      document.getElementById('cfgCorPrimariaTxt').innerText = data.cor_primaria || '#0d9488';
      document.getElementById('cfgCorSecundaria').value = data.cor_secundaria || '#1e293b';
      document.getElementById('cfgCorSecundariaTxt').innerText = data.cor_secundaria || '#1e293b';

      // Logo Admin Preview
      const logoUrlInput = document.getElementById('cfgLogoUrl');
      const logoPreviewImg = document.getElementById('cfgLogoPreviewImg');
      const logoPreviewIcon = document.getElementById('cfgLogoPreviewIcon');
      const btnRemoverLogo = document.getElementById('btnRemoverLogo');
      if (logoUrlInput) {
        logoUrlInput.value = data.logo_url || '';
        if (data.logo_url && data.logo_url.trim()) {
          if (logoPreviewImg) {
            logoPreviewImg.src = data.logo_url;
            logoPreviewImg.classList.remove('hidden');
          }
          if (logoPreviewIcon) logoPreviewIcon.classList.add('hidden');
          if (btnRemoverLogo) btnRemoverLogo.classList.remove('hidden');
        } else {
          if (logoPreviewImg) logoPreviewImg.classList.add('hidden');
          if (logoPreviewIcon) logoPreviewIcon.classList.remove('hidden');
          if (btnRemoverLogo) btnRemoverLogo.classList.add('hidden');
        }
      }

      // Banner Hero Admin Preview
      const bannerUrlInput = document.getElementById('cfgBannerUrl');
      const bannerPreviewBox = document.getElementById('cfgBannerPreviewBox');
      const btnRemoverBanner = document.getElementById('btnRemoverBannerHero');
      if (bannerUrlInput) {
        bannerUrlInput.value = data.banner_url || '';
        if (data.banner_url && data.banner_url.trim()) {
          if (bannerPreviewBox) {
            bannerPreviewBox.style.backgroundImage = `linear-gradient(to right, rgba(15, 23, 42, 0.8) 0%, rgba(13, 148, 136, 0.5) 100%), url('${data.banner_url}')`;
          }
          if (btnRemoverBanner) btnRemoverBanner.classList.remove('hidden');
        } else {
          if (bannerPreviewBox) bannerPreviewBox.style.backgroundImage = '';
          if (btnRemoverBanner) btnRemoverBanner.classList.add('hidden');
        }
      }
    }
  } catch (err) {
    console.error('Erro ao carregar configurações do EAD:', err);
  }
}

// 2. NAVEGAÇÃO DE ABAS
function navegarAba(aba) {
  const abas = ['catalogo', 'instrutores', 'meus-cursos', 'sala-aula', 'professor', 'admin'];
  abas.forEach(a => {
    const el = document.getElementById(`aba-${a}`);
    if (el) el.classList.add('hidden');
    const btn = document.getElementById(`navBtn-${a}`);
    if (btn) {
      btn.classList.remove('text-teal-700', 'bg-teal-50', 'text-indigo-700', 'bg-indigo-50', 'text-rose-700', 'bg-rose-50');
      btn.classList.add('text-slate-600');
    }
  });

  const alvo = document.getElementById(`aba-${aba}`);
  if (alvo) alvo.classList.remove('hidden');

  const btnAtivo = document.getElementById(`navBtn-${aba}`);
  if (btnAtivo) {
    btnAtivo.classList.remove('text-slate-600');
    if (aba === 'professor') btnAtivo.classList.add('text-indigo-700', 'bg-indigo-50');
    else if (aba === 'admin') btnAtivo.classList.add('text-rose-700', 'bg-rose-50');
    else btnAtivo.classList.add('text-teal-700', 'bg-teal-50');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (aba === 'meus-cursos') renderizarMeusCursos();
  if (aba === 'professor') carregarPainelProfessor();
  if (aba === 'admin') carregarPainelAdmin();
}

// 3. AUTENTICAÇÃO E PERFIS
function atualizarUiAutenticacao() {
  const u = stateEad.usuario;
  const boxNaoLogado = document.getElementById('boxNaoLogado');
  const boxLogado = document.getElementById('boxLogado');
  const btnMeusCursos = document.getElementById('navBtn-meus-cursos');
  const btnProf = document.getElementById('navBtn-professor');
  const btnAdmin = document.getElementById('navBtn-admin');

  if (u) {
    boxNaoLogado.classList.add('hidden');
    boxLogado.classList.remove('hidden');
    boxLogado.classList.add('flex');

    document.getElementById('userLogadoNome').innerText = u.nome;
    document.getElementById('userLogadoTipo').innerText = u.tipo === 'admin' ? 'Administrador Master' : (u.tipo === 'professor' ? 'Professor / Instrutor' : 'Aluno');
    document.getElementById('userLogadoAvatar').innerText = u.nome.charAt(0).toUpperCase();

    btnMeusCursos.classList.remove('hidden');

    if (u.tipo === 'professor' || u.tipo === 'admin') {
      btnProf.classList.remove('hidden');
    } else {
      btnProf.classList.add('hidden');
    }

    const bannerEditBtn = document.getElementById('bannerHeroEditBtnBox');
    if (u.tipo === 'admin') {
      btnAdmin.classList.remove('hidden');
      if (bannerEditBtn) bannerEditBtn.classList.remove('hidden');
    } else {
      btnAdmin.classList.add('hidden');
      if (bannerEditBtn) bannerEditBtn.classList.add('hidden');
    }
  } else {
    boxNaoLogado.classList.remove('hidden');
    boxLogado.classList.add('hidden');
    btnMeusCursos.classList.add('hidden');
    btnProf.classList.add('hidden');
    btnAdmin.classList.add('hidden');
    const bannerEditBtn = document.getElementById('bannerHeroEditBtnBox');
    if (bannerEditBtn) bannerEditBtn.classList.add('hidden');
  }
}

function abrirModalLogin() {
  document.getElementById('formLoginEad').reset();
  document.getElementById('modalLoginEad').classList.remove('hidden');
}

function fecharModalLogin() {
  document.getElementById('modalLoginEad').classList.add('hidden');
}

async function executarLoginEad(e) {
  e.preventDefault();
  const login = document.getElementById('loginEadUser').value;
  const senha = document.getElementById('loginEadPass').value;

  try {
    const res = await fetch('/api/treinamento/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao realizar login');

    stateEad.usuario = data.user;
    localStorage.setItem('sisfac_ead_user', JSON.stringify(data.user));
    fecharModalLogin();
    atualizarUiAutenticacao();
    await carregarCursosEad();

    if (data.user.tipo === 'admin') navegarAba('admin');
    else if (data.user.tipo === 'professor') navegarAba('professor');
    else navegarAba('meus-cursos');

  } catch (err) {
    alert(err.message);
  }
}

function logoutEad() {
  if (!confirm('Deseja realmente sair da plataforma?')) return;
  stateEad.usuario = null;
  localStorage.removeItem('sisfac_ead_user');
  atualizarUiAutenticacao();
  carregarCursosEad();
  navegarAba('catalogo');
}

// 4. CARREGAMENTO E RENDERIZAÇÃO DE CURSOS
async function carregarCursosEad() {
  try {
    const uId = stateEad.usuario ? stateEad.usuario.id : '';
    const res = await fetch(`/api/treinamento/cursos?usuario_id=${uId}`);
    const data = await res.json();
    stateEad.cursos = Array.isArray(data) ? data : [];
    renderizarCursosCatalogo(stateEad.cursos);
  } catch (err) {
    console.error('Erro ao carregar cursos:', err);
  }
}

function filtrarCursosCatalogo() {
  const busca = (document.getElementById('buscaCursoInput')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('filtroCategoriaSelect')?.value || '';

  const filtrados = stateEad.cursos.filter(c => {
    const matchBusca = !busca || c.titulo.toLowerCase().includes(busca) || (c.descricao && c.descricao.toLowerCase().includes(busca)) || (c.instrutor_nome && c.instrutor_nome.toLowerCase().includes(busca));
    const matchCat = !cat || c.categoria === cat;
    return matchBusca && matchCat;
  });

  renderizarCursosCatalogo(filtrados);
}

function renderizarCursosCatalogo(cursos) {
  const container = document.getElementById('gridCursosContainer');
  if (!container) return;

  if (cursos.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
        <i class="fa-solid fa-graduation-cap text-4xl text-slate-300 mb-2"></i>
        <p class="font-bold text-sm text-slate-600">Nenhum treinamento encontrado com os filtros selecionados.</p>
        <p class="text-xs text-slate-400 mt-1">Experimente buscar por outros termos ou categorias.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = cursos.map(c => {
    const matriculado = c.matriculado;
    const mat = c.matricula;
    const statusTxt = mat ? (mat.status === 'Aprovado' ? '✅ Concluído / Aprovado' : `${mat.progresso_percent}% Concluído`) : '';

    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between group">
        <div>
          <!-- Capa com Badge de Categoria -->
          <div class="h-44 w-full bg-slate-800 relative overflow-hidden">
            <img src="${c.capa_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80'}" alt="${escapeHtml(c.titulo)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
            <span class="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-slate-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              ${escapeHtml(c.categoria)}
            </span>
            ${matriculado ? `<span class="absolute top-3 right-3 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">Inscrito</span>` : ''}
            <div class="absolute bottom-3 left-3 text-white text-[11px] font-medium flex items-center gap-2">
              <span><i class="fa-regular fa-clock mr-1"></i> ${c.carga_horaria_horas}h</span>
              <span>•</span>
              <span><i class="fa-solid fa-list-check mr-1"></i> ${c.total_aulas || 0} aulas</span>
            </div>
          </div>

          <!-- Conteúdo -->
          <div class="p-5 space-y-2.5">
            <h3 class="text-sm sm:text-base font-bold text-slate-900 leading-snug group-hover:text-teal-600 transition">
              ${escapeHtml(c.titulo)}
            </h3>
            <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              ${escapeHtml(c.descricao || 'Sem descrição cadastrada.')}
            </p>

            <!-- Instrutor -->
            <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
              <img src="${c.instrutor_foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}" alt="${escapeHtml(c.instrutor_nome || '')}" class="w-7 h-7 rounded-full object-cover border border-slate-200">
              <div class="text-[11px] leading-tight truncate">
                <span class="text-slate-400 block text-[9px] uppercase font-bold">Instrutor</span>
                <span class="font-bold text-slate-800 truncate">${escapeHtml(c.instrutor_nome || 'Equipe Pedagógica')}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Rodapé do Card -->
        <div class="p-5 pt-0">
          ${matriculado ? `
            <div class="space-y-2">
              <div class="flex justify-between text-[11px] font-bold">
                <span class="text-slate-500">Progresso</span>
                <span class="text-teal-600">${statusTxt}</span>
              </div>
              <button onclick="abrirSalaDeAula(${c.id})" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer">
                <i class="fa-solid fa-play"></i> Continuar Aula
              </button>
            </div>
          ` : `
            <button onclick="iniciarOuMatricularCurso(${c.id})" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer">
              <i class="fa-solid fa-graduation-cap text-teal-400"></i> Acessar Treinamento
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// 5. INSTRUTORES & CONHEÇA NOSSOS PROFESSORES
async function carregarInstrutoresEad() {
  try {
    const res = await fetch('/api/treinamento/instrutores');
    const data = await res.json();
    stateEad.instrutores = Array.isArray(data) ? data : [];
    renderizarInstrutores(stateEad.instrutores);
  } catch (err) {
    console.error('Erro ao carregar instrutores:', err);
  }
}

function renderizarInstrutores(instrutores) {
  const container = document.getElementById('gridInstrutoresContainer');
  if (!container) return;

  if (instrutores.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400">Nenhum instrutor cadastrado ainda.</div>`;
    return;
  }

  container.innerHTML = instrutores.map(inst => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-6 space-y-4 flex flex-col justify-between">
      <div class="space-y-4">
        <!-- Topo: Foto, Nome e Cargo -->
        <div class="flex items-center gap-4">
          <img src="${inst.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}" alt="${escapeHtml(inst.nome)}" class="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500/20 shadow-xs">
          <div>
            <h3 class="text-base font-bold text-slate-900 leading-tight">${escapeHtml(inst.nome)}</h3>
            <span class="inline-block mt-0.5 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              ${escapeHtml(inst.especialidade || 'Instrutor Técnico')}
            </span>
          </div>
        </div>

        <!-- Biografia -->
        <div>
          <h4 class="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Biografia & Experiência</h4>
          <p class="text-xs text-slate-600 leading-relaxed">
            ${escapeHtml(inst.bio || 'Profissional com sólida experiência em treinamento de equipes e padronização operacional.')}
          </p>
        </div>

        <!-- Mensagem aos Alunos -->
        ${inst.mensagem_instrutor ? `
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 relative">
            <i class="fa-solid fa-quote-left text-teal-300 text-xs absolute top-2 left-2 opacity-50"></i>
            <p class="text-xs italic text-slate-700 pl-4 leading-relaxed">
              "${escapeHtml(inst.mensagem_instrutor)}"
            </p>
          </div>
        ` : ''}
      </div>

      <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span><i class="fa-solid fa-chalkboard-user mr-1 text-teal-600"></i> Instrutor Ativo</span>
        <span class="text-[11px] font-mono">EAD Corporativo</span>
      </div>
    </div>
  `).join('');
}

// 6. MATRICULAR E SALA DE AULA INTERATIVA
async function iniciarOuMatricularCurso(cursoId) {
  if (!stateEad.usuario) {
    abrirModalLogin();
    return;
  }

  // Matricular
  try {
    await fetch('/api/treinamento/matriculas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: stateEad.usuario.id, curso_id: cursoId })
    });
    await carregarCursosEad();
    abrirSalaDeAula(cursoId);
  } catch (err) {
    abrirSalaDeAula(cursoId);
  }
}

async function abrirSalaDeAula(cursoId) {
  try {
    const res = await fetch(`/api/treinamento/cursos/${cursoId}/detalhes`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao carregar sala de aula');

    stateEad.cursoAtivoDetalhes = data;
    const { curso, modulos, prova } = data;

    document.getElementById('salaCursoTitulo').innerText = curso.titulo;
    document.getElementById('salaCursoCategoria').innerText = curso.categoria;

    // Prova
    const btnProva = document.getElementById('btnIniciarProvaSala');
    if (prova && prova.questoes && prova.questoes.length > 0) {
      btnProva.classList.remove('hidden');
      stateEad.provaAtiva = prova;
    } else {
      btnProva.classList.add('hidden');
      stateEad.provaAtiva = null;
    }

    // Renderizar Módulos e Aulas
    const modContainer = document.getElementById('salaListaModulosContainer');
    if (!modulos || modulos.length === 0) {
      modContainer.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">Nenhum módulo cadastrado neste treinamento ainda.</p>`;
      document.getElementById('iframeVideoAula').src = '';
      document.getElementById('salaAulaTitulo').innerText = 'Conteúdo em Desenvolvimento';
      document.getElementById('salaAulaTexto').innerText = 'O instrutor está preparando os vídeos e materiais didáticos para este curso.';
      navegarAba('sala-aula');
      return;
    }

    let todasAulas = [];
    modulos.forEach(m => {
      if (m.aulas) todasAulas = todasAulas.concat(m.aulas);
    });

    modContainer.innerHTML = modulos.map((m, mIdx) => `
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
        <div class="p-2.5 bg-slate-100 font-bold text-xs text-slate-800 flex items-center justify-between">
          <span class="truncate">${escapeHtml(m.titulo)}</span>
          <span class="text-[10px] text-slate-500 font-normal">(${(m.aulas || []).length} aulas)</span>
        </div>
        <div class="divide-y divide-slate-100 bg-white">
          ${(m.aulas || []).map(a => `
            <button onclick="selecionarAulaSala(${a.id})" id="btnAulaSala-${a.id}" class="w-full text-left p-2.5 hover:bg-teal-50/50 transition flex items-center justify-between text-xs group cursor-pointer">
              <div class="flex items-center gap-2 truncate pr-2">
                <i class="fa-regular fa-circle-play text-slate-400 group-hover:text-teal-600 transition"></i>
                <span class="truncate font-medium text-slate-700 group-hover:text-slate-900">${escapeHtml(a.titulo)}</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono whitespace-nowrap">${a.duracao_minutos || 10}m</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Selecionar primeira aula
    if (todasAulas.length > 0) {
      selecionarAulaSala(todasAulas[0].id);
    }

    navegarAba('sala-aula');
  } catch (err) {
    alert(err.message);
  }
}

function selecionarAulaSala(aulaId) {
  if (!stateEad.cursoAtivoDetalhes) return;
  let aula = null;
  stateEad.cursoAtivoDetalhes.modulos.forEach(m => {
    const achou = (m.aulas || []).find(a => a.id === aulaId);
    if (achou) aula = achou;
  });

  if (!aula) return;
  stateEad.aulaAtiva = aula;

  // Atualizar botões visuais
  document.querySelectorAll('[id^="btnAulaSala-"]').forEach(btn => {
    btn.classList.remove('bg-teal-50', 'border-l-4', 'border-teal-600', 'font-bold');
  });
  const btnAtual = document.getElementById(`btnAulaSala-${aulaId}`);
  if (btnAtual) {
    btnAtual.classList.add('bg-teal-50', 'border-l-4', 'border-teal-600', 'font-bold');
  }

  document.getElementById('salaAulaTitulo').innerText = aula.titulo;
  document.getElementById('salaAulaDuracao').innerHTML = `<i class="fa-regular fa-clock mr-1"></i> ${aula.duracao_minutos || 10} min`;
  document.getElementById('salaAulaTexto').innerText = aula.conteudo_texto || 'Assista à aula no reprodutor acima e anote os pontos principais para a avaliação didática.';

  const iframe = document.getElementById('iframeVideoAula');
  if (aula.video_url && aula.video_url.trim()) {
    iframe.src = aula.video_url;
    iframe.classList.remove('hidden');
  } else {
    iframe.src = '';
    iframe.classList.add('hidden');
  }
}

// 7. REALIZAÇÃO DA PROVA DIDÁTICA (ALUNO)
function abrirModalFazerProva() {
  if (!stateEad.provaAtiva || !stateEad.provaAtiva.questoes || stateEad.provaAtiva.questoes.length === 0) {
    alert('Nenhuma avaliação didática cadastrada para este treinamento.');
    return;
  }
  if (!stateEad.usuario) {
    abrirModalLogin();
    return;
  }

  stateEad.respostasProva = {};
  const container = document.getElementById('fazerProvaQuestoesContainer');
  document.getElementById('fazerProvaTitulo').innerText = stateEad.provaAtiva.titulo || 'Prova Didática de Fixação';

  container.innerHTML = stateEad.provaAtiva.questoes.map((q, qIdx) => `
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div class="font-bold text-slate-900 text-xs">
        <span class="text-teal-600 mr-1">${qIdx + 1}.</span> ${escapeHtml(q.pergunta)}
      </div>
      <div class="space-y-1.5 pl-3">
        ${(q.opcoes || []).map((op, opIdx) => `
          <label class="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-teal-500 cursor-pointer transition text-xs">
            <input type="radio" name="questao_${qIdx}" value="${opIdx}" onchange="registrarRespostaProva(${qIdx}, ${opIdx})" class="text-teal-600 focus:ring-teal-500">
            <span class="text-slate-700">${escapeHtml(op)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  document.getElementById('modalFazerProvaAluno').classList.remove('hidden');
}

function fecharModalFazerProva() {
  document.getElementById('modalFazerProvaAluno').classList.add('hidden');
}

function registrarRespostaProva(qIdx, opIdx) {
  stateEad.respostasProva[qIdx] = opIdx;
}

async function enviarRespostasProva() {
  const totalQ = stateEad.provaAtiva.questoes.length;
  const respondidas = Object.keys(stateEad.respostasProva).length;

  if (respondidas < totalQ) {
    if (!confirm(`Você respondeu ${respondidas} de ${totalQ} questões. Deseja enviar mesmo assim?`)) return;
  }

  try {
    const cursoId = stateEad.cursoAtivoDetalhes.curso.id;
    const res = await fetch(`/api/treinamento/cursos/${cursoId}/responder-prova`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: stateEad.usuario.id,
        respostas: stateEad.respostasProva
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao processar prova');

    fecharModalFazerProva();
    alert(`Resultado da Avaliação Didática:\n\n${data.mensagem}\n\nAcertos: ${data.acertos}/${data.total_questoes} (${data.nota}%)`);
    await carregarCursosEad();
    navegarAba('meus-cursos');
  } catch (err) {
    alert(err.message);
  }
}

// 8. RENDERIZAR MEUS CURSOS (ALUNO)
function renderizarMeusCursos() {
  const container = document.getElementById('gridMeusCursosContainer');
  const badge = document.getElementById('badgeQtdMeusCursos');
  if (!container) return;

  const meus = stateEad.cursos.filter(c => c.matriculado);
  if (badge) badge.innerText = `${meus.length} curso(s)`;

  if (meus.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
        <i class="fa-solid fa-graduation-cap text-4xl text-slate-300 mb-2"></i>
        <p class="font-bold text-sm text-slate-600">Você ainda não está matriculado em nenhum treinamento.</p>
        <button onclick="navegarAba('catalogo')" class="mt-3 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition">
          Explorar Catálogo de Treinamentos
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = meus.map(c => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3 flex flex-col justify-between">
      <div class="space-y-2">
        <span class="bg-teal-50 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
          ${escapeHtml(c.categoria)}
        </span>
        <h3 class="text-base font-bold text-slate-900 leading-snug">${escapeHtml(c.titulo)}</h3>
        <p class="text-xs text-slate-500 line-clamp-2">${escapeHtml(c.descricao || '')}</p>
      </div>

      <div class="pt-3 border-t border-slate-100 space-y-2">
        <div class="flex items-center justify-between text-xs font-bold">
          <span class="text-slate-500">Status:</span>
          <span class="${c.matricula?.status === 'Aprovado' ? 'text-emerald-600' : 'text-amber-600'}">
            ${c.matricula?.status === 'Aprovado' ? '✅ Aprovado / Concluído' : '🟡 Em Andamento'}
          </span>
        </div>
        <button onclick="abrirSalaDeAula(${c.id})" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer">
          <i class="fa-solid fa-play"></i> Assistir Aulas & Avaliação
        </button>
      </div>
    </div>
  `).join('');
}

// 9. PAINEL DO PROFESSOR / INSTRUTOR
async function carregarPainelProfessor() {
  renderizarTabelaCursosProfessor();
  carregarAlunosProfessor();
}

function renderizarTabelaCursosProfessor() {
  const tbody = document.getElementById('tabelaCursosProfessorBody');
  if (!tbody) return;

  if (stateEad.cursos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Nenhum treinamento cadastrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = stateEad.cursos.map(c => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3 font-mono text-slate-400 font-bold">${c.id}</td>
      <td class="p-3 font-bold text-slate-900">${escapeHtml(c.titulo)}</td>
      <td class="p-3 text-slate-600">${escapeHtml(c.categoria)}</td>
      <td class="p-3 text-center text-slate-600">${c.carga_horaria_horas}h</td>
      <td class="p-3 text-center font-bold text-teal-700">${c.total_modulos || 0} mod / ${c.total_aulas || 0} aulas</td>
      <td class="p-3 text-center font-bold text-indigo-700">${c.total_alunos || 0}</td>
      <td class="p-3 text-right space-x-1">
        <button onclick="gerenciarConteudoCurso(${c.id})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded text-xs transition" title="Gerenciar Aulas e Prova">
          <i class="fa-solid fa-layer-group"></i> Aulas/Prova
        </button>
        <button onclick="excluirCursoEad(${c.id})" class="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2 py-1 rounded text-xs transition" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function carregarAlunosProfessor() {
  const tbody = document.getElementById('tabelaAlunosProfessorBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/treinamento/alunos');
    const alunos = await res.json();

    if (alunos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Nenhum aluno cadastrado no momento. Use o botão acima para criar o login do aluno.</td></tr>`;
      return;
    }

    tbody.innerHTML = alunos.map(a => `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-bold text-slate-900">${escapeHtml(a.nome)}</td>
        <td class="p-3 font-mono text-emerald-700 font-bold bg-emerald-50/50 px-2 py-1 rounded w-fit">${escapeHtml(a.login)}</td>
        <td class="p-3 text-slate-500">${escapeHtml(a.email || '-')}</td>
        <td class="p-3 text-center font-bold text-teal-700">${a.total_cursos || 0}</td>
        <td class="p-3 text-center font-bold text-emerald-700">${a.cursos_concluidos || 0}</td>
        <td class="p-3 text-center text-slate-400 text-[10px]">${a.created_at ? a.created_at.split(' ')[0] : '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Erro ao carregar alunos:', err);
  }
}

// 10. MODAIS: NOVO CURSO & CONTEÚDO
function abrirModalNovoCurso() {
  const selInst = document.getElementById('cadCursoInstrutor');
  if (selInst) {
    selInst.innerHTML = stateEad.instrutores.map(i => `<option value="${i.id}">${escapeHtml(i.nome)} (${escapeHtml(i.especialidade || 'Instrutor')})</option>`).join('');
  }
  document.getElementById('formNovoCursoEad').reset();
  document.getElementById('modalNovoCursoEad').classList.remove('hidden');
}

function fecharModalNovoCurso() {
  document.getElementById('modalNovoCursoEad').classList.add('hidden');
}

async function salvarNovoCursoEad(e) {
  e.preventDefault();
  const titulo = document.getElementById('cadCursoTitulo').value;
  const categoria = document.getElementById('cadCursoCategoria').value;
  const carga_horaria_horas = document.getElementById('cadCursoHoras').value;
  const instrutor_id = document.getElementById('cadCursoInstrutor').value;
  const descricao = document.getElementById('cadCursoDescricao').value;
  const capa_url = document.getElementById('cadCursoCapa').value;

  try {
    const res = await fetch('/api/treinamento/cursos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, categoria, carga_horaria_horas, instrutor_id, descricao, capa_url })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao criar curso');

    fecharModalNovoCurso();
    alert('Curso criado com sucesso!');
    await carregarCursosEad();
    renderizarTabelaCursosProfessor();
  } catch (err) {
    alert(err.message);
  }
}

async function excluirCursoEad(id) {
  if (!confirm('Deseja realmente excluir este treinamento?')) return;
  try {
    await fetch(`/api/treinamento/cursos/${id}`, { method: 'DELETE' });
    await carregarCursosEad();
    renderizarTabelaCursosProfessor();
  } catch (err) {
    alert('Erro ao excluir curso');
  }
}

// Gerenciar Módulos e Aulas
async function gerenciarConteudoCurso(cursoId) {
  stateEad.cursoGerenciandoId = cursoId;
  const res = await fetch(`/api/treinamento/cursos/${cursoId}/detalhes`);
  const data = await res.json();
  const { curso, modulos } = data;

  document.getElementById('gerenciarCursoTitulo').innerText = `Grade de Conteúdo: ${curso.titulo}`;
  renderizarGradeModulosAulas(modulos);
  document.getElementById('modalGerenciarConteudoCurso').classList.remove('hidden');
}

function fecharModalGerenciarConteudo() {
  document.getElementById('modalGerenciarConteudoCurso').classList.add('hidden');
  carregarCursosEad();
}

function renderizarGradeModulosAulas(modulos) {
  const container = document.getElementById('gradeModulosAulasLista');
  if (!modulos || modulos.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Nenhum módulo adicionado ainda. Clique em "+ Novo Módulo" acima.</div>`;
    return;
  }

  container.innerHTML = modulos.map(m => `
    <div class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
      <div class="p-3 bg-slate-100 flex items-center justify-between font-bold text-xs text-slate-800">
        <div class="flex items-center gap-2 truncate">
          <i class="fa-solid fa-folder text-amber-500"></i>
          <span class="truncate">${escapeHtml(m.titulo)}</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="adicionarAulaAoModulo(${m.id})" class="text-[10px] bg-teal-600 hover:bg-teal-700 text-white font-bold px-2 py-0.5 rounded">
            + Aula
          </button>
          <button onclick="excluirModuloEad(${m.id})" class="text-[10px] text-rose-600 hover:text-rose-800" title="Excluir Módulo">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      <div class="divide-y divide-slate-100 bg-white">
        ${(m.aulas || []).length === 0 ? `<p class="p-3 text-[11px] text-slate-400 italic">Nenhuma aula neste módulo.</p>` : (m.aulas || []).map(a => `
          <div class="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
            <div class="flex items-center gap-2 truncate pr-2">
              <i class="fa-solid fa-video text-teal-600"></i>
              <span class="font-medium text-slate-800 truncate">${escapeHtml(a.titulo)}</span>
              <span class="text-[10px] text-slate-400 font-mono">${a.duracao_minutos || 10}m</span>
            </div>
            <button onclick="excluirAulaEad(${a.id})" class="text-rose-500 hover:text-rose-700 text-xs" title="Excluir Aula">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function abrirFormNovoModulo() {
  const titulo = prompt('Informe o título do novo Módulo (ex: Módulo 1 - Procedimentos de Limpeza):');
  if (!titulo || !titulo.trim()) return;

  try {
    await fetch('/api/treinamento/modulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curso_id: stateEad.cursoGerenciandoId, titulo })
    });
    gerenciarConteudoCurso(stateEad.cursoGerenciandoId);
  } catch (err) {
    alert('Erro ao criar módulo');
  }
}

async function excluirModuloEad(modId) {
  if (!confirm('Deseja excluir este módulo e todas as suas aulas?')) return;
  await fetch(`/api/treinamento/modulos/${modId}`, { method: 'DELETE' });
  gerenciarConteudoCurso(stateEad.cursoGerenciandoId);
}

async function adicionarAulaAoModulo(modId) {
  const titulo = prompt('Título da aula / vídeo:');
  if (!titulo || !titulo.trim()) return;
  const video_url = prompt('Link do Vídeo no YouTube ou Vimeo (ex: https://www.youtube.com/watch?v=...):');
  const conteudo_texto = prompt('Resumo ou instruções da aula (opcional):') || '';

  try {
    await fetch('/api/treinamento/aulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modulo_id: modId, titulo, video_url, conteudo_texto, duracao_minutos: 15 })
    });
    gerenciarConteudoCurso(stateEad.cursoGerenciandoId);
  } catch (err) {
    alert('Erro ao adicionar aula');
  }
}

async function excluirAulaEad(aulaId) {
  if (!confirm('Deseja remover esta aula?')) return;
  await fetch(`/api/treinamento/aulas/${aulaId}`, { method: 'DELETE' });
  gerenciarConteudoCurso(stateEad.cursoGerenciandoId);
}

// 11. CONFIGURAÇÃO DA PROVA DIDÁTICA
let questoesFormBuffer = [];

async function abrirConfigProvaCurso() {
  const cursoId = stateEad.cursoGerenciandoId;
  const res = await fetch(`/api/treinamento/cursos/${cursoId}/detalhes`);
  const data = await res.json();

  document.getElementById('provaNomeCursoSub').innerText = `Treinamento: ${data.curso.titulo}`;
  questoesFormBuffer = (data.prova && data.prova.questoes) ? data.prova.questoes : [];

  if (questoesFormBuffer.length === 0) {
    adicionarNovaQuestaoForm();
  } else {
    renderizarQuestoesForm();
  }

  document.getElementById('modalConfigProvaEad').classList.remove('hidden');
}

function fecharModalConfigProva() {
  document.getElementById('modalConfigProvaEad').classList.add('hidden');
}

function adicionarNovaQuestaoForm() {
  questoesFormBuffer.push({
    id: Date.now(),
    pergunta: '',
    opcoes: ['', '', '', ''],
    correta: 0,
    explicacao: ''
  });
  renderizarQuestoesForm();
}

function removerQuestaoForm(idx) {
  questoesFormBuffer.splice(idx, 1);
  renderizarQuestoesForm();
}

function renderizarQuestoesForm() {
  const container = document.getElementById('containerQuestoesProva');
  container.innerHTML = questoesFormBuffer.map((q, idx) => `
    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-800">Questão ${idx + 1}:</span>
        <button type="button" onclick="removerQuestaoForm(${idx})" class="text-rose-600 font-bold hover:text-rose-800">
          <i class="fa-solid fa-trash mr-1"></i> Remover
        </button>
      </div>
      <div>
        <input type="text" placeholder="Enunciado da pergunta didática..." value="${escapeHtml(q.pergunta)}" oninput="questoesFormBuffer[${idx}].pergunta = this.value" class="w-full bg-white border border-slate-200 rounded p-2 text-xs" required>
      </div>
      <div class="space-y-1">
        <label class="block text-[11px] font-semibold text-slate-500">Alternativas (Selecione a correta):</label>
        ${[0, 1, 2, 3].map(opIdx => `
          <div class="flex items-center gap-2">
            <input type="radio" name="correta_${idx}" value="${opIdx}" ${parseInt(q.correta, 10) === opIdx ? 'checked' : ''} onchange="questoesFormBuffer[${idx}].correta = ${opIdx}" title="Marcar como alternativa correta">
            <input type="text" placeholder="Opção ${String.fromCharCode(65 + opIdx)}" value="${escapeHtml(q.opcoes[opIdx] || '')}" oninput="questoesFormBuffer[${idx}].opcoes[${opIdx}] = this.value" class="w-full bg-white border border-slate-200 rounded p-1.5 text-xs">
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function salvarProvaDidatica() {
  const titulo = document.getElementById('cfgProvaTitulo').value;
  const nota_minima_aprovacao = document.getElementById('cfgProvaNotaMin').value;

  try {
    const res = await fetch(`/api/treinamento/cursos/${stateEad.cursoGerenciandoId}/prova`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo,
        nota_minima_aprovacao,
        questoes: questoesFormBuffer
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao salvar prova');

    alert('Prova didática configurada com sucesso!');
    fecharModalConfigProva();
  } catch (err) {
    alert(err.message);
  }
}

// 12. CADASTRAR ALUNO (LOGIN & SENHA)
function abrirModalNovoAluno() {
  const checkContainer = document.getElementById('checkCursosMatriculaAluno');
  if (checkContainer) {
    checkContainer.innerHTML = stateEad.cursos.map(c => `
      <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
        <input type="checkbox" value="${c.id}" class="chk-curso-aluno text-emerald-600 focus:ring-emerald-500">
        <span>${escapeHtml(c.titulo)}</span>
      </label>
    `).join('');
  }
  document.getElementById('formNovoAlunoEad').reset();
  document.getElementById('modalNovoAlunoEad').classList.remove('hidden');
}

function fecharModalNovoAluno() {
  document.getElementById('modalNovoAlunoEad').classList.add('hidden');
}

async function salvarNovoAlunoEad(e) {
  e.preventDefault();
  const nome = document.getElementById('cadAlunoNome').value;
  const email = document.getElementById('cadAlunoEmail').value;
  const login = document.getElementById('cadAlunoLogin').value;
  const senha = document.getElementById('cadAlunoSenha').value;

  const chks = document.querySelectorAll('.chk-curso-aluno:checked');
  const curso_ids = Array.from(chks).map(c => parseInt(c.value, 10));

  try {
    const res = await fetch('/api/treinamento/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, login, senha, curso_ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar aluno');

    fecharModalNovoAluno();
    alert(`Acesso do aluno criado com sucesso!\n\nNome: ${nome}\nLogin: ${login}\nSenha: ${senha}\n\nEnvie estes dados para o colaborador acessar o portal.`);
    carregarAlunosProfessor();
  } catch (err) {
    alert(err.message);
  }
}

// 13. PAINEL ADMIN MASTER (WHITE-LABEL & INSTRUTORES)
async function carregarPainelAdmin() {
  renderizarListaInstrutoresAdmin();
}

function renderizarListaInstrutoresAdmin() {
  const container = document.getElementById('listaInstrutoresAdmin');
  if (!container) return;

  container.innerHTML = stateEad.instrutores.map(inst => `
    <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
      <div class="flex items-center gap-3">
        <img src="${inst.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}" class="w-10 h-10 rounded-full object-cover border border-slate-200">
        <div>
          <h4 class="font-bold text-slate-900">${escapeHtml(inst.nome)}</h4>
          <span class="text-[10px] text-indigo-700 font-semibold">${escapeHtml(inst.especialidade || 'Instrutor')}</span>
          <span class="text-[10px] text-slate-400 font-mono block">Login: ${escapeHtml(inst.login)}</span>
        </div>
      </div>
      <button onclick="excluirInstrutorEad(${inst.id})" class="text-rose-600 hover:text-rose-800 text-xs font-bold" title="Desativar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `).join('');
}

function abrirModalNovoInstrutor() {
  document.getElementById('formNovoInstrutorEad').reset();
  removerFotoInstrutor();
  document.getElementById('modalNovoInstrutorEad').classList.remove('hidden');
}

function fecharModalNovoInstrutor() {
  document.getElementById('modalNovoInstrutorEad').classList.add('hidden');
}

async function salvarNovoInstrutorEad(e) {
  e.preventDefault();
  const nome = document.getElementById('cadInstNome').value;
  const especialidade = document.getElementById('cadInstEspec').value;
  const login = document.getElementById('cadInstLogin').value;
  const senha = document.getElementById('cadInstSenha').value;
  const foto_url = document.getElementById('cadInstFoto').value;
  const bio = document.getElementById('cadInstBio').value;
  const mensagem_instrutor = document.getElementById('cadInstMsg').value;

  try {
    const res = await fetch('/api/treinamento/instrutores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, especialidade, login, senha, foto_url, bio, mensagem_instrutor })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao cadastrar instrutor');

    fecharModalNovoInstrutor();
    alert('Instrutor cadastrado com sucesso!');
    await carregarInstrutoresEad();
    renderizarListaInstrutoresAdmin();
  } catch (err) {
    alert(err.message);
  }
}

async function excluirInstrutorEad(id) {
  if (!confirm('Deseja desativar este instrutor?')) return;
  await fetch(`/api/treinamento/instrutores/${id}`, { method: 'DELETE' });
  await carregarInstrutoresEad();
  renderizarListaInstrutoresAdmin();
}

async function salvarConfigEad(e) {
  e.preventDefault();
  const nome_plataforma = document.getElementById('cfgNomePlataforma').value;
  const slogan = document.getElementById('cfgSlogan').value;
  const logo_url = document.getElementById('cfgLogoUrl').value;
  const banner_url = document.getElementById('cfgBannerUrl').value;
  const cor_primaria = document.getElementById('cfgCorPrimaria').value;
  const cor_secundaria = document.getElementById('cfgCorSecundaria').value;

  try {
    const res = await fetch('/api/treinamento/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_plataforma, slogan, logo_url, banner_url, cor_primaria, cor_secundaria })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao salvar configurações');

    alert('Configurações visuais, capa do banner e temas atualizados com sucesso!');
    await carregarConfiguracaoEad();
  } catch (err) {
    alert(err.message);
  }
}

// Utilitários
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =========================================================================
// PROCESSAMENTO DE UPLOAD DE ARQUIVOS DE IMAGEM
// =========================================================================

function comprimirImagemParaUpload(file, maxWidth, maxHeight, qualidade, callback) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        if (width / maxWidth > height / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mime, qualidade);
      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function enviarImagemAoServidor(base64Data, tipo) {
  try {
    const res = await fetch('/api/treinamento/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagem_base64: base64Data, tipo })
    });
    const json = await res.json();
    if (res.ok && json.url) return json.url;
  } catch (e) {
    console.warn('Fallback para imagem base64:', e);
  }
  return base64Data;
}

// 1. Processar Foto do Instrutor
async function processarUploadFotoInstrutor(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  comprimirImagemParaUpload(file, 400, 400, 0.88, async (base64) => {
    const img = document.getElementById('previewInstFotoImg');
    const icon = document.getElementById('previewInstFotoIcon');
    const btnRemover = document.getElementById('btnRemoverFotoInst');
    if (img) {
      img.src = base64;
      img.classList.remove('hidden');
      if (icon) icon.classList.add('hidden');
      if (btnRemover) btnRemover.classList.remove('hidden');
    }

    const urlFinal = await enviarImagemAoServidor(base64, 'instrutor');
    document.getElementById('cadInstFoto').value = urlFinal;
  });
}

function removerFotoInstrutor() {
  const img = document.getElementById('previewInstFotoImg');
  const icon = document.getElementById('previewInstFotoIcon');
  const btnRemover = document.getElementById('btnRemoverFotoInst');
  const hiddenInput = document.getElementById('cadInstFoto');
  const fileInput = document.getElementById('cadInstFotoFile');

  if (img) {
    img.src = '';
    img.classList.add('hidden');
  }
  if (icon) icon.classList.remove('hidden');
  if (btnRemover) btnRemover.classList.add('hidden');
  if (hiddenInput) hiddenInput.value = '';
  if (fileInput) fileInput.value = '';
}

// 2. Processar Capa do Banner Hero Principal
async function processarUploadBannerHero(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  comprimirImagemParaUpload(file, 1600, 900, 0.88, async (base64) => {
    const previewBox = document.getElementById('cfgBannerPreviewBox');
    const btnRemover = document.getElementById('btnRemoverBannerHero');
    if (previewBox) {
      previewBox.style.backgroundImage = `linear-gradient(to right, rgba(15, 23, 42, 0.8) 0%, rgba(13, 148, 136, 0.5) 100%), url('${base64}')`;
      if (btnRemover) btnRemover.classList.remove('hidden');
    }

    const urlFinal = await enviarImagemAoServidor(base64, 'banner_hero');
    document.getElementById('cfgBannerUrl').value = urlFinal;
  });
}

function removerBannerHero() {
  const previewBox = document.getElementById('cfgBannerPreviewBox');
  const btnRemover = document.getElementById('btnRemoverBannerHero');
  const hiddenInput = document.getElementById('cfgBannerUrl');
  const fileInput = document.getElementById('cfgBannerFile');

  if (previewBox) previewBox.style.backgroundImage = '';
  if (btnRemover) btnRemover.classList.add('hidden');
  if (hiddenInput) hiddenInput.value = '';
  if (fileInput) fileInput.value = '';
}

// 3. Processar Logo da Empresa
async function processarUploadLogoPlataforma(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  comprimirImagemParaUpload(file, 400, 400, 0.90, async (base64) => {
    const img = document.getElementById('cfgLogoPreviewImg');
    const icon = document.getElementById('cfgLogoPreviewIcon');
    const btnRemover = document.getElementById('btnRemoverLogo');
    if (img) {
      img.src = base64;
      img.classList.remove('hidden');
      if (icon) icon.classList.add('hidden');
      if (btnRemover) btnRemover.classList.remove('hidden');
    }

    const urlFinal = await enviarImagemAoServidor(base64, 'logo');
    document.getElementById('cfgLogoUrl').value = urlFinal;
  });
}

function removerLogoPlataforma() {
  const img = document.getElementById('cfgLogoPreviewImg');
  const icon = document.getElementById('cfgLogoPreviewIcon');
  const btnRemover = document.getElementById('btnRemoverLogo');
  const hiddenInput = document.getElementById('cfgLogoUrl');
  const fileInput = document.getElementById('cfgLogoFile');

  if (img) {
    img.src = '';
    img.classList.add('hidden');
  }
  if (icon) icon.classList.remove('hidden');
  if (btnRemover) btnRemover.classList.add('hidden');
  if (hiddenInput) hiddenInput.value = '';
  if (fileInput) fileInput.value = '';
}
