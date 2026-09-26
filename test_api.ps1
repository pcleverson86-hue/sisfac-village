$dash = Invoke-RestMethod -Uri 'http://localhost:3000/api/dashboard/executivo'
Write-Host "DASHBOARD OK - Total Clientes: $($dash.kpis.totalClientesAtivos), Vagas: $($dash.kpis.vagasContratadas), Ocupadas: $($dash.kpis.vagasOcupadas), Abertas: $($dash.kpis.vagasAbertas), Total VT: R$ $($dash.kpis.totalVtCalculado), Total VA: R$ $($dash.kpis.totalVaCalculado)"

$benef = Invoke-RestMethod -Uri 'http://localhost:3000/api/relatorios/beneficios'
Write-Host "BENEFICIOS OK - Total VT: R$ $($benef.resumo.totalVt), Total VA: R$ $($benef.resumo.totalVa), Geral: R$ $($benef.resumo.totalGeralBeneficios), Linhas: $($benef.lista.Count)"

$adm = Invoke-RestMethod -Uri 'http://localhost:3000/api/relatorios/admitidos-demitidos'
Write-Host "ADMITIDOS/DEMITIDOS OK - Ativos: $($adm.resumo.efetivoTotalAtivo), Admitidos: $($adm.resumo.totalAdmitidos), Demitidos: $($adm.resumo.totalDemitidos)"

$ferias = Invoke-RestMethod -Uri 'http://localhost:3000/api/relatorios/ferias-mensais'
Write-Host "FERIAS OK - Em Ferias: $($ferias.resumo.totalEmFerias), Concessoes: $($ferias.resumo.totalConcessoes), Custo: R$ $($ferias.resumo.custoTotalCoberturas)"

$free = Invoke-RestMethod -Uri 'http://localhost:3000/api/relatorios/freelancers'
Write-Host "FREELANCERS OK - Total: R$ $($free.resumo.totalGeral), Pago: R$ $($free.resumo.totalPago), Pendente: R$ $($free.resumo.totalPendente)"

$glosas = Invoke-RestMethod -Uri 'http://localhost:3000/api/relatorios/glosas'
Write-Host "GLOSAS OK - Total Glosas: R$ $($glosas.resumo.valorTotalGlosas), Descontadas: R$ $($glosas.resumo.valorGlosasDescontadas), Faltas Descobertas: $($glosas.resumo.totalFaltasDescobertas)"

$colab1 = Invoke-RestMethod -Uri 'http://localhost:3000/api/colaboradores/1'
Write-Host "COLAB 1 OK - Nome: $($colab1.nome), Posto: $($colab1.nome_posto), Cargo: $($colab1.nome_cargo), VT: R$ $($colab1.valor_passagem_unitaria), VA: R$ $($colab1.valor_diario_va)"
