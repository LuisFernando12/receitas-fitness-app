# PRD — Receitas fitness a partir da nota do mercado

> Tipo: Produto inicial · Data: 2026-10-13  
> Status: Pronto para planejamento

## Visão geral e objetivo

O produto ajuda uma pessoa a transformar as compras de uma ida ao mercado em ideias de pratos fitness. O usuário envia uma foto da nota (pela câmera no celular ou por upload no desktop), informa opcionalmente sua meta e recebe de duas a quatro receitas que aproveitam os ingredientes comprados.

O resultado esperado é reduzir o esforço de decidir o que cozinhar e aumentar o aproveitamento das compras, mantendo o usuário no controle da lista de ingredientes identificada pela inteligência artificial.

## Contexto do projeto

O projeto é uma aplicação nova em Next.js 16, com TypeScript, App Router, Tailwind CSS e ESLint. Não há fluxos, dados, autenticação ou integrações existentes para reaproveitar. A análise da nota será feita pelo Gemini no servidor; a chave e a comunicação com o provedor não devem ser expostas ao navegador.

## Decisões do produto

- A entrada será uma imagem da nota: câmera e upload são oferecidos em dispositivos móveis; upload é oferecido no desktop.
- O Gemini interpreta a imagem e extrai os produtos e, quando legível, suas quantidades.
- Antes de gerar as receitas, o usuário revisa a lista extraída e pode editar, adicionar ou remover ingredientes.
- O usuário pode informar uma meta em texto livre, como emagrecimento ou ganho de massa. A meta é usada para orientar as sugestões.
- A IA pode usar itens básicos de cozinha, como sal, óleo e temperos, além dos itens da nota. Ingredientes não identificados na compra devem ser marcados como complementares na receita.
- Cada análise gera de duas a quatro opções de pratos fitness.
- Cada receita apresenta nome, ingredientes, aproveitamento dos itens comprados, modo de preparo, tempo, porções e informações nutricionais estimadas.
- A imagem e os dados da análise ficam disponíveis durante o fluxo para permitir a revisão e a geração. Depois que o usuário valida os ingredientes e as receitas são geradas, esses dados são descartados e não há histórico persistido.
- O produto não exige conta ou login.

## Histórias de usuário

- Como usuário, quero fotografar ou enviar a foto da minha nota, para não precisar digitar todas as compras.
- Como usuário, quero revisar e corrigir os ingredientes reconhecidos, para que as receitas sejam baseadas no que realmente comprei.
- Como usuário, quero informar minha meta fitness, para receber pratos mais adequados ao meu objetivo.
- Como usuário, quero receber de duas a quatro receitas com instruções completas, para escolher o que cozinhar com minhas compras.
- Como usuário, quero ver quais ingredientes comprados cada receita aproveita e quais são complementares, para decidir se consigo prepará-la.
- Como usuário, quero usar o serviço sem criar uma conta e sem manter um histórico, para analisar uma compra pontualmente com mais privacidade.

## Regras de negócio e dados

- Uma análise começa com uma imagem da nota e pode incluir uma meta textual opcional.
- A lista de ingredientes possui, no mínimo, nome e quantidade quando essa informação estiver legível na nota; cada item pode ser editado pelo usuário.
- O usuário precisa validar a lista de ingredientes antes da geração das receitas.
- A geração recebe somente a lista validada e a meta informada, quando houver.
- O resultado contém entre duas e quatro receitas. Se não houver combinações adequadas, o sistema informa que não conseguiu gerar opções suficientes e orienta o usuário a revisar a lista.
- As informações nutricionais são estimativas geradas pela IA e devem ser apresentadas como estimativas, não como orientação médica ou nutricional.
- Ingredientes adicionais necessários para uma receita devem ser diferenciados dos ingredientes identificados na nota.
- A imagem, a lista intermediária e o resultado não são salvos para consulta posterior nem associados a uma identidade.
- Erros de imagem ilegível, formato não suportado, falha de comunicação com o Gemini ou ausência de ingredientes utilizáveis devem ser comunicados com uma ação para tentar novamente ou corrigir a entrada.

## Fluxos

### Analisar a nota

1. O usuário escolhe tirar uma foto pela câmera do celular ou enviar uma imagem; no desktop, envia uma imagem.
2. O sistema valida que há uma imagem compatível e envia a imagem ao Gemini pelo servidor.
3. O sistema mostra os ingredientes reconhecidos, com quantidades quando disponíveis.
4. Se a imagem não puder ser lida, o sistema explica o problema e permite uma nova captura ou upload.

### Validar compras e definir meta

1. O usuário edita, adiciona ou remove itens da lista reconhecida.
2. O usuário informa opcionalmente sua meta em texto livre.
3. O usuário confirma a lista; sem essa confirmação, a geração não é iniciada.

### Gerar receitas

1. O sistema envia ao Gemini a lista confirmada, a meta e a regra de uso de itens básicos de cozinha.
2. O sistema exibe de duas a quatro receitas fitness, cada uma com ingredientes, aproveitamento da compra, complementos, preparo, tempo, porções e nutrição estimada.
3. O sistema informa que os dados da análise foram descartados após a geração e não oferece histórico.
4. Se a geração falhar, o sistema mantém o usuário no fluxo e permite tentar novamente ou revisar a lista.

## Critérios de aceite

- Dado que o usuário está em um celular, quando escolher analisar uma nota, então poderá abrir a câmera ou selecionar uma imagem.
- Dado que o usuário está em um desktop, quando escolher analisar uma nota, então poderá fazer upload de uma imagem.
- Dado que uma imagem válida foi enviada, quando a análise terminar, então o sistema exibirá a lista de itens reconhecidos e suas quantidades quando disponíveis.
- Dado que a lista foi exibida, quando o usuário editar, adicionar ou remover um item, então a versão alterada será usada na geração.
- Dado que a lista ainda não foi confirmada, quando o usuário tentar gerar receitas, então o sistema solicitará a validação.
- Dado que o usuário informou uma meta, quando as receitas forem geradas, então as sugestões considerarão essa meta.
- Dado que a lista foi confirmada, quando a geração for concluída, então serão exibidas de duas a quatro receitas com os campos definidos para o resultado.
- Dado que uma receita exige um ingrediente não identificado na nota, quando for exibida, então esse ingrediente será marcado como complementar.
- Dado que a nutrição for apresentada, quando o usuário consultar uma receita, então os valores estarão identificados como estimativas.
- Dado que a geração tenha terminado, quando o fluxo for encerrado, então a imagem, a lista e o resultado não estarão disponíveis em um histórico persistente.
- Dado que a imagem seja ilegível ou a IA falhe, quando o erro ocorrer, então o sistema exibirá uma mensagem compreensível e uma ação de recuperação.

## Stack e restrições técnicas decididas

- A aplicação mantém a base existente em Next.js 16, TypeScript, App Router, Tailwind CSS e ESLint.
- A análise de imagem e a geração de receitas usam Gemini por meio do servidor da aplicação.
- A credencial do Gemini permanece somente no ambiente do servidor.
- Não haverá autenticação, conta de usuário, banco de dados ou persistência de histórico no recorte inicial.
- O produto deve funcionar com entrada por câmera em dispositivos móveis e upload de imagem em desktop.
