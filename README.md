# 🎲 Roladas Infinitas - Sistema de Rolagem de RPG Customizável

**Roladas Infinitas** é um aplicativo web moderno, responsivo e 100% autônomo (não precisa de internet nem servidores) feito para jogadores e mestres de RPG de mesa (TTRPG).

---

## 🚀 Como Executar

Basta dar um duplo clique no arquivo:
```
C:\Users\rafael.abreu\roladasinfinitas\index.html
```
Ele abrirá instantaneamente em qualquer navegador moderno (Chrome, Edge, Firefox, Brave, etc.).

---

## ✨ Funcionalidades Principais

### 1. 🎲 Mesa de Rolagem (Dice Tray)
- **Seleção Rápida de Dados**: Clique nos dados poliédricos padrão (**d4, d6, d8, d10, d12, d20, d100**) para adicioná-los à sua parada de dados.
- **Botão Direito**: Subtrai dados da parada atual.
- **Modificadores (+/-)**: Adicione bônus ou penalidades numéricas diretamente.
- **Atalhos Rápidos**:
  - ⭐ **Vantagem**: Rola 2 dados de 20 e mantém o maior (`2d20kh1`).
  - 🔻 **Desvantagem**: Rola 2 dados de 20 e mantém o menor (`2d20kl1`).
  - 🧹 **Limpar Seleção**: Zera a parada atual com um clique.
- **Arena de Rolagem Visual**: Mostra o número final em destaque, tokens animados para cada dado individual rolado com identificação de faces, valores descartados e destaques críticos.
- **Efeitos Especiais de Crítico**:
  - ✨ **Nat 20 (Sucesso Crítico)**: Brilho dourado/esmeralda, fanfarra sonora e chuva de confetes!
  - 💀 **Nat 1 (Falha Crítica)**: Brilho rubro carmesim e efeito sonoro dramático.

---

### 2. ⚔️ Botões & Macros Customizáveis
Você pode criar, salvar, editar e excluir seus próprios botões de rolagem para seu personagem ou campanha:
- **Pré-configurados de fábrica**:
  - *D&D 5e / Tormenta 20*: Ataque com Arma, Ataque com Vantagem, Dano Espada Longa, Bola de Fogo (8d6), Rolar Atributo (4d6dl1).
  - *Call of Cthulhu 7e*: Sanidade / Perícias (1d100).
  - *Ordem Paranormal*: Teste com 3 Dados (3d20kh1).
  - *Vampiro: A Máscara*: Parada de Sucessos (6d10>=6).
  - *FATE Core*: 4 Dados FATE + Perícia (4dF + 2).
- **Crie o seu**: Dê um nome, escolha um emoji, digite a fórmula e organize por categoria (Ataque, Magia, Perícia, Dano, etc.).
- **Filtros e Pesquisa**: Encontre rapidamente qualquer rolagem na sua lista.

---

### 3. 📜 Tabelas Aleatórias de RPG (Roll Tables)
Ideal para mestres de jogo (GMs):
- Já vem com tabelas prontas:
  - *Tabela de Críticos Épicos*
  - *Encontro Aleatório na Masmorra*
  - *Saque Rápido / Loot de Monstro*
- **Criação de Novas Tabelas**:
  - Defina o dado de sorteio (ex: `1d6`, `1d8`, `1d20`, `1d100`).
  - Digite as linhas no formato simples:
    ```
    1 : Inimigos emboscam os heróis
    2-3 : O corredor está inundado com água fria
    4-5 : Um baú de madeira trancado com armadilha
    6 : Uma fada guia o grupo até uma saída secreta
    ```
  - Clique em **"Sortear na Tabela"** e receba o resultado na hora!

---

### 4. 📊 Histórico Detalhado & Estatísticas
- Lista de todas as últimas rolagens com horário, fórmula, valores individuais e total.
- Clique em qualquer item do histórico para **rolar novamente**!
- Copie o histórico para colar no Discord, WhatsApp ou ficha de RPG.
- Estatísticas em tempo real: Total de rolagens, Média geral, Maior resultado e Quantidade de 20s naturais.

---

### 5. 🔊 Efeitos Sonoros 100% Sintetizados
- Utiliza a **Web Audio API** nativa do navegador para sintetizar os sons de dados chacoalhando e caindo na madeira/feltro, além de acordes de sucesso crítico e estrondo de falha crítica.
- Sem necessidade de arquivos de áudio externos ou conexão com a internet.
- Controle de volume e botão de mudo integrados.

---

### 6. 🎨 5 Temas Visuais Imersivos
- 🔮 **Mago Arcano** (Roxo Místico & Ciano)
- ⚔️ **Masmorra Clássica** (Slate Escuro, Ouro & Carmesim)
- 📜 **Pergaminho Antigo** (Sépia e Couro Envelhecido)
- 🌌 **Cyberpunk Neon** (Obsidiana & Rosa Neon)
- 🌲 **Floresta Élfica** (Esmeralda & Dourado da Natureza)

---

### 7. 💾 Backup & Compartilhamento (JSON)
- Todos os dados ficam salvos automaticamente no seu navegador (`localStorage`).
- Na aba **Configurações & Backup**, você pode **Exportar um arquivo JSON** com todos os seus botões e tabelas para guardar de segurança ou mandar para seus amigos de mesa!

---

## 📖 Sintaxe das Fórmulas Suportadas

| Sintaxe | Descrição | Exemplo |
| :--- | :--- | :--- |
| `XdY` | Rola X dados de Y faces | `3d6`, `1d20`, `1d100` |
| `khN` | Mantém os N maiores dados (*Keep Highest*) | `2d20kh1` (Vantagem no D&D) |
| `klN` | Mantém os N menores dados (*Keep Lowest*) | `2d20kl1` (Desvantagem no D&D) |
| `dlN` | Descarta os N menores dados (*Drop Lowest*) | `4d6dl1` (Atributos de D&D) |
| `dhN` | Descarta os N maiores dados (*Drop Highest*) | `4d6dh1` |
| `!` | Dado Explosivo (rola de novo se tirar valor máximo) | `3d6!` |
| `>=N` ou `>N` | Contagem de sucessos (Storyteller / WoD) | `6d10>=6` |
| `dF` | Dados FATE / Fudge (-1, 0, +1) | `4dF + 2` |
| `+`, `-`, `*`, `/` | Operações matemáticas e bônus | `1d20 + 7`, `2d6 * 2` |
| `# Motivo` | Adiciona um rótulo/etiqueta na rolagem | `1d20 + 5 # Ataque Adaga` |
