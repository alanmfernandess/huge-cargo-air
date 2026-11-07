# Huge Cargo Air — Simulador de Operações e Finanças

Dashboard interativo para a companhia aérea virtual **Huge Cargo Air**, com **3 Boeing 707-320C**, baseados em **PANC (Anchorage, Alasca)**.

## Acessar

Quando o GitHub Pages estiver ativado:
https://alanmfernandess.github.io/huge-cargo-air/

Também é possível abrir `index.html` localmente no navegador.

## Configurar GitHub Pages

1. Abra **Settings → Pages** neste repositório.
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Escolha **main** e **/(root)** e clique **Save**.
4. Aguarde a implantação e confira a URL indicada pelo GitHub.

## HCA Control Center 2.0 + Career Mode

**Interface:** estilo minimalista em `hca-ui.css`, com painel executivo, frota, missão gráfica e navegação contextual.

**Ciclo de missão Xbox:**
1. No SimBrief, gere um OFP e importe-o pela seção **SimBrief**.
2. Clique **Criar missão**. Escolha a aeronave e ajuste a receita contratada (hipótese editável).
3. O sistema congela uma cópia do OFP, impede a dupla alocação da aeronave e bloqueia massas que excedam os limites estruturais de referência.
4. Execute o voo no Xbox; na seção **Carreira**, informe combustível consumido em **kg**, tempo de bloco em **horas** e eventuais despesas adicionais.
5. Conclua a missão para registrar resultado, horas, ciclo, posição, despesas estimadas e recebíveis/pagáveis.
6. Use **Registrar recebimento** e **Registrar pagamento** para movimentar o caixa da carreira. A fatura não é recebida automaticamente.

**Limitações deliberadas:** o ledger de carreira é **separado** da projeção financeira prospectiva de 36 meses, para evitar dupla contagem. Os custos de peças e manutenção por hora permanecem estimativas. O modo carreira não é um sistema de despacho: dados do OFP/SimBrief não substituem AFM nem performance certificada. A calibração de consumo Xbox é apenas observacional; ainda não altera automaticamente os parâmetros do Boeing 707 de referência.

**Backup:** o botão **Exportar JSON** salva também missões, snapshots do OFP e lançamentos da carreira. A importação restaura esse estado no navegador, mas não sincroniza entre dispositivos.

## Maintenance Control v2.1 — integração com a carreira

O módulo **Manutenção** controla os 12 JT3D distribuídos entre as aeronaves HCA-701, HCA-702 e HCA-703:

- Cada voo concluído no Xbox acumula horas de bloco e **um ciclo por motor instalado**, uma vez por missão. Registros antigos da carreira são migrados automaticamente sem duplicação.
- Inspeções por horas/ciclos e revisões em oficina possuem intervalos **hipotéticos editáveis**; quando vencidos, bloqueiam novas missões daquela aeronave. Não são limites de manutenção aprovados.
- AOG manual, entrada/saída da oficina e reparo consomem kits de peças e registram serviços; é possível reatribuir missões pendentes a outra aeronave disponível na origem ou cancelar o contrato com penalidade hipotética.
- Estoque contabilizado em **consumíveis de linha** e lotes FIFO de **kits de inspeção** e **kits de reparo**, preservando os preços de aquisição de cada lote. Compras geram contas a pagar; consumo reconhece despesa e reduz o estoque.
- O histórico diferencia **despesa**, **contas a pagar** e **pagamento**. A carreira exibe conferência do razão (resultado + variação de caixa, estoque e obrigações).
- Simulação estocástica de AOG **desativada por padrão**. Quando ligada, usa taxa de falhas sintética por 1000 engine-BH e seed determinística da missão/motor. Os resultados não demonstram confiabilidade real do JT3D.
- Backup/restore da carreira inclui estado dos motores, eventos, estoque e faturas pelo JSON local.

**Limitações:** preços, falhas e intervalos são hipóteses de gestão; a disponibilidade "READY" só indica ausência dos bloqueios simulados, não liberação técnica real. Não existe controle de serial number real de motor, calendário certificado, ADs, LLP, MEL/CDL, ferramental, equipe escalada, lead time de peças ou despacho autorizado. O razão da carreira permanece **separado da previsão financeira de 36 meses**, evitando somas indevidas entre missões observadas e projeções. O custo por hora de consumíveis é uma proxy financeira e não substitui um bill of materials.

### Diagnóstico de erro HTTP 400 do SimBrief

A API de recuperação do **último OFP** aceita `username=<Navigraph Alias>` ou `userid=<Pilot ID numérico de 1–7 dígitos>`, com `json=v2`. O HCA detecta o formato ao importar e exibe o campo `fetch.status` retornado pelo SimBrief, mesmo em respostas HTTP 400 ou XML. Não confunda o status HTTP 400 (requisição recebida e recusada) com um erro de conexão/CORS.

Se a importação retornar "Nenhum OFP", **gere** (não apenas salve ou edite) um plano no [SimBrief Dispatch](https://dispatch.simbrief.com/), utilizando a conta correta. Se apontar "Conta não localizada", veja o **Navigraph Alias** e o **Pilot ID** em [Configurações da conta](https://dispatch.simbrief.com/account). **E-mail e "Original Username" não são o Alias requerido pela API.**

Os testes sintéticos cobrem Alias/Pilot ID, mensagens de erro XML/JSON, código HTTP 200/400 e preservação do último plano válido. Não testamos consultas autenticadas a uma conta pessoal; a API é utilizada apenas mediante clique.

## SimBrief Dispatch (primeira integração)

- Selecione **SimBrief Dispatch** na navegação lateral.
- Gere primeiro um OFP no SimBrief usando o perfil desejado do Boeing 707-320C.
- Informe somente o seu **Navigraph Alias** e clique **Importar último OFP**.
- A importação usa o endpoint público de leitura `xml.fetcher.php` com `json=v2`; não solicita senha ou chave de API.
- Se o navegador impedir a leitura direta por **CORS**, use **Importar JSON/XML** com o arquivo OFP obtido do SimBrief.
- O módulo exibe mass balance, navlog, perfil de altitude, vento e meteorologia conforme dados disponíveis no plano.
- Em rotas PANC → destino presentes na malha, é possível transferir a **distância planejada** do OFP ao modelo financeiro; essa ação não altera automaticamente payload, tarifas ou aprovação técnica.
- A importação é **manual, sob demanda**: o sistema não monitora a conta SimBrief automaticamente.
- As informações importadas são guardadas no estado local da carreira e acompanham a exportação JSON. O alias do usuário permanece no armazenamento local do navegador.
- O perfil comunitário da aeronave e as análises TLR do SimBrief **não substituem performance certificada ou AFM**.

Referências: https://forum.navigraph.com/t/fetching-a-users-latest-ofp-data/5297 e https://developers.navigraph.com/docs/simbrief/using-the-api

## Funcionalidades do protótipo

- Dashboard de diretoria e indicadores financeiros.
- Receitas e custos por rotas, volumes, tarifas e frequências.
- CAPEX inicial, financiamento, juros, depreciação, capital de giro e fluxo de caixa.
- Frota de três aeronaves, manutenção, indisponibilidade e eventos.
- Avaliação exploratória de massa, combustível e pistas.
- Cenários, análise de risco e exportação/importação de configurações JSON.

**Aviso:** trata-se de um simulador em desenvolvimento, com premissas hipotéticas. Nenhum cálculo substitui o AFM aprovado, dados de performance certificados, despacho operacional ou documentos regulatórios aplicáveis.

## Privacidade e armazenamento

O aplicativo não usa servidor ou banco de dados. Configurações são guardadas apenas no **localStorage** do navegador. Publicar o repositório não sincroniza cenários entre dispositivos. Use o recurso de exportação JSON para salvar configurações.

Não publique informações confidenciais ou comerciais reais diretamente em arquivos do repositório público.

## Próximas etapas

Validar as três aeronaves individualmente, parametrizar motores JT3D, custos de manutenção e peças, integrar programador de voos e performance de aeroporto, testar dependências e calibrar hipóteses com fontes técnicas e contratos.
