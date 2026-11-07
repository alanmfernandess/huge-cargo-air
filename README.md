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
