/**
 * Roladas Infinitas - Sistema de Rolada de Dados de RPG
 * Moderno, customizável, autônomo e responsivo.
 */

// ==========================================
// 1. AUDIO ENGINE (Web Audio API Sintetizado)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playDiceRoll() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const count = 5 + Math.floor(Math.random() * 4); // 5-8 clacks
    for (let i = 0; i < count; i++) {
      const time = now + (i * 0.05) + (Math.random() * 0.03);
      this._createClack(time, 0.6 - (i * 0.05));
    }
  }

  _createClack(time, gainScale = 0.5) {
    const bufferSize = this.ctx.sampleRate * 0.035;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700 + Math.random() * 1200, time);
    filter.Q.setValueAtTime(3.5, time);

    const gainNode = this.ctx.createGain();
    const finalGain = Math.max(0.01, this.volume * gainScale);
    gainNode.gain.setValueAtTime(finalGain, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  playCritSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + (idx * 0.07);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(this.volume * 0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  playCritFail() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const startTime = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, startTime);
    osc.frequency.exponentialRampToValueAtTime(45, startTime + 0.5);

    gain.gain.setValueAtTime(this.volume * 0.4, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.6);
  }
}

const soundEngine = new SoundFX();

// ==========================================
// 2. PARSER DE EXPRESSÕES DE DADOS DE RPG
// ==========================================
/**
 * Suporta:
 *  - Dados comuns: 1d20, 3d6, 1d100, 2d4, etc.
 *  - Fate/Fudge: 4dF (-1, 0, +1)
 *  - Keep Highest: 2d20kh1, 4d6kh3
 *  - Keep Lowest: 2d20kl1
 *  - Drop Lowest: 4d6dl1
 *  - Drop Highest: 4d6dh1
 *  - Explodir dados: 3d6! (rola novamente em caso de valor máximo)
 *  - Contagem de Sucessos: 6d10>=6, 5d10>7
 *  - Modificadores e matemática: + 5, - 2, * 2, / 2
 *  - Labels/Motivo: # Ataque Furtivo
 */
class DiceEngine {
  static rollSingleDie(sides) {
    if (sides === 'F') {
      // Fate/Fudge: -1, 0, +1
      const rand = Math.floor(Math.random() * 3) - 1;
      return { val: rand, isMax: rand === 1, isMin: rand === -1, text: rand > 0 ? '+1' : (rand < 0 ? '-1' : '0') };
    }
    const numSides = parseInt(sides, 10);
    const val = Math.floor(Math.random() * numSides) + 1;
    return {
      val,
      isMax: val === numSides,
      isMin: val === 1,
      text: val.toString()
    };
  }

  static evaluate(expression, label = '') {
    let cleanExpr = expression.trim();
    let rollLabel = label;

    // Extrair comentário ou hashtag (# Ataque)
    if (cleanExpr.includes('#')) {
      const parts = cleanExpr.split('#');
      cleanExpr = parts[0].trim();
      if (!rollLabel) rollLabel = parts[1].trim();
    }

    if (!cleanExpr) {
      throw new Error('Expressão de rolada vazia.');
    }

    const tokens = [];
    const allDiceResults = [];
    let hasNat20 = false;
    let hasNat1 = false;
    let isSuccessCountMode = false;

    // Expressão regular avançada para capturar dados
    // Exemplo: 4d6dl1, 2d20kh1, 3d6!, 6d10>=6, 4dF
    const diceRegex = /(\d+)?d(\d+|F|%)(kh\d+|kl\d+|dh\d+|dl\d+)?(!)?((?:>=|>|<=|<|=)\d+)?/gi;

    let expandedFormula = cleanExpr;
    const matches = [...cleanExpr.matchAll(diceRegex)];

    for (const match of matches) {
      const fullMatch = match[0];
      const count = match[1] ? parseInt(match[1], 10) : 1;
      let sides = match[2].toUpperCase();
      if (sides === '%') sides = '100';
      const keepDrop = match[3] ? match[3].toLowerCase() : null;
      const explode = Boolean(match[4]);
      const condition = match[5] ? match[5] : null;

      if (count > 200) throw new Error('Número de dados excede o limite máximo (200).');
      if (sides !== 'F' && parseInt(sides, 10) > 10000) throw new Error('Número de faces excede o limite (10000).');

      const rolled = [];
      for (let i = 0; i < count; i++) {
        let die = this.rollSingleDie(sides);
        rolled.push({ ...die, sides, originalIndex: rolled.length });

        // Exploding dice
        if (explode && sides !== 'F' && die.isMax) {
          let explodeLimit = 10;
          while (die.isMax && explodeLimit-- > 0) {
            die = this.rollSingleDie(sides);
            rolled.push({ ...die, sides, exploded: true, originalIndex: rolled.length });
          }
        }
      }

      // Check for Nat 20 / Nat 1 em d20
      if (sides === '20') {
        rolled.forEach(d => {
          if (d.val === 20) hasNat20 = true;
          if (d.val === 1) hasNat1 = true;
        });
      }

      // Apply Keep / Drop
      rolled.forEach(d => (d.dropped = false));
      if (keepDrop) {
        const kdType = keepDrop.substring(0, 2);
        const kdNum = parseInt(keepDrop.substring(2), 10);

        // Sort copy by value
        const sortedIndices = rolled
          .map((d, idx) => ({ val: d.val, idx }))
          .sort((a, b) => a.val - b.val);

        if (kdType === 'kh') { // keep highest
          const dropCount = Math.max(0, rolled.length - kdNum);
          for (let i = 0; i < dropCount; i++) {
            rolled[sortedIndices[i].idx].dropped = true;
          }
        } else if (kdType === 'kl') { // keep lowest
          const dropCount = Math.max(0, rolled.length - kdNum);
          for (let i = rolled.length - 1; i >= rolled.length - dropCount; i--) {
            rolled[sortedIndices[i].idx].dropped = true;
          }
        } else if (kdType === 'dl') { // drop lowest
          const dropCount = Math.min(kdNum, rolled.length);
          for (let i = 0; i < dropCount; i++) {
            rolled[sortedIndices[i].idx].dropped = true;
          }
        } else if (kdType === 'dh') { // drop highest
          const dropCount = Math.min(kdNum, rolled.length);
          for (let i = rolled.length - 1; i >= rolled.length - dropCount; i--) {
            rolled[sortedIndices[i].idx].dropped = true;
          }
        }
      }

      // Calculate sum or successes for this dice group
      let groupSum = 0;
      let groupSuccesses = 0;

      if (condition) {
        isSuccessCountMode = true;
        const condOp = condition.match(/[><=]+/)[0];
        const condVal = parseInt(condition.replace(condOp, ''), 10);

        rolled.forEach(d => {
          if (!d.dropped) {
            let pass = false;
            if (condOp === '>=') pass = d.val >= condVal;
            else if (condOp === '>') pass = d.val > condVal;
            else if (condOp === '<=') pass = d.val <= condVal;
            else if (condOp === '<') pass = d.val < condVal;
            else if (condOp === '=') pass = d.val === condVal;

            if (pass) {
              groupSuccesses++;
              d.success = true;
            } else {
              d.success = false;
            }
          }
        });
      } else {
        rolled.forEach(d => {
          if (!d.dropped) groupSum += d.val;
        });
      }

      allDiceResults.push({
        groupText: fullMatch,
        sides,
        dice: rolled,
        groupSum: condition ? groupSuccesses : groupSum,
        isSuccessCount: Boolean(condition)
      });

      // Substitui na fórmula a rolada pelo valor calculado
      const replaceVal = condition ? groupSuccesses : `(${groupSum})`;
      expandedFormula = expandedFormula.replace(fullMatch, replaceVal);
    }

    // Calcula valor matemático final
    let finalTotal = 0;
    try {
      // Sanitizar antes de avaliar: apenas números, parenteses e operadores + - * /
      const safeMath = expandedFormula.replace(/[^0-9+\-*/(). ]/g, '');
      finalTotal = Function(`'use strict'; return (${safeMath || '0'})`)();
    } catch (e) {
      // Se falhou o parser aritmético, fallback para a soma dos grupos
      finalTotal = allDiceResults.reduce((acc, g) => acc + g.groupSum, 0);
    }

    if (typeof finalTotal === 'number' && !Number.isInteger(finalTotal)) {
      finalTotal = parseFloat(finalTotal.toFixed(2));
    }

    return {
      rawFormula: cleanExpr,
      label: rollLabel,
      total: finalTotal,
      diceGroups: allDiceResults,
      hasNat20,
      hasNat1,
      isSuccessCountMode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  }
}

// ==========================================
// 3. CONFETTI ENGINE (Para Nat 20 / Críticos)
// ==========================================
class ConfettiEffect {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.animationId = null;

    if (this.canvas) {
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  spawn() {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    const colors = ['#f59e0b', '#10b981', '#a855f7', '#06b6d4', '#ec4899', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      this.particles.push({
        x: this.canvas.width / 2 + (Math.random() * 200 - 100),
        y: this.canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        tilt: Math.random() * 10,
        tiltAngle: 0,
        tiltSpeed: Math.random() * 0.1 + 0.05,
        alpha: 1
      });
    }

    if (!this.animationId) {
      this.animate();
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravidade
      p.tiltAngle += p.tiltSpeed;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      p.alpha -= 0.012;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.rect(p.x + p.tilt, p.y, p.size, p.size);
      this.ctx.fill();
      this.ctx.restore();

      if (p.alpha <= 0 || p.y > this.canvas.height) {
        this.particles.splice(idx, 1);
      }
    });

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.animationId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

// ==========================================
// 4. BANCO DE DADOS & DADOS PADRÃO (STORAGE)
// ==========================================
const DEFAULT_MACROS = [
  {
    id: 'macro-1',
    name: 'Ataque com Arma',
    formula: '1d20 + 5',
    category: 'Ataque',
    icon: '⚔️',
    desc: 'Rolada padrão de ataque (d20 + bônus de acerto).'
  },
  {
    id: 'macro-2',
    name: 'Ataque com Vantagem',
    formula: '2d20kh1 + 5',
    category: 'Ataque',
    icon: '🎯',
    desc: 'Rola 2d20 e escolhe o maior resultado + bônus.'
  },
  {
    id: 'macro-3',
    name: 'Dano Espada Longa',
    formula: '1d8 + 3',
    category: 'Dano',
    icon: '🗡️',
    desc: 'Dano cortante com bônus de força.'
  },
  {
    id: 'macro-4',
    name: 'Magia: Bola de Fogo',
    formula: '8d6',
    category: 'Magia',
    icon: '🔥',
    desc: '8d6 de puro dano flamejante em área!'
  },
  {
    id: 'macro-5',
    name: 'Rolar Atributo (4d6 drop 1)',
    formula: '4d6dl1',
    category: 'Criação de Ficha',
    icon: '🎲',
    desc: 'Rola 4d6 e descarta o menor dado (sistema D&D / Tormenta 20).'
  },
  {
    id: 'macro-6',
    name: 'Call of Cthulhu: Sanidade',
    formula: '1d100',
    category: 'Perícia',
    icon: '🐙',
    desc: 'Teste percentual de Sanidade / Perícia (1d100).'
  },
  {
    id: 'macro-7',
    name: 'Ordem Paranormal: 3 Dados',
    formula: '3d20kh1',
    category: 'Perícia',
    icon: '👁️',
    desc: 'Rola 3 dados de 20 e fica com o maior.'
  },
  {
    id: 'macro-8',
    name: 'Vampiro: Parada de 6 Dados',
    formula: '6d10>=6',
    category: 'Storyteller',
    icon: '🩸',
    desc: 'Conta sucessos em 6 dados de 10 faces (dificuldade 6).'
  },
  {
    id: 'macro-9',
    name: 'FATE Core: Teste Padrão',
    formula: '4dF + 2',
    category: 'FATE',
    icon: '✨',
    desc: '4 dados FATE (-1, 0, +1) + perícia regular.'
  }
];

const DEFAULT_TABLES = [
  {
    id: 'table-1',
    name: 'Tabela de Críticos Épicos',
    formula: '1d6',
    desc: 'Efeitos espetaculares para ataques decisivos.',
    entries: [
      { range: '1', text: 'Golpe Desestabilizador: O inimigo é derrubado no chão e fica caído!' },
      { range: '2', text: 'Desarme Perfeito: A arma ou escudo do alvo é arremessada a 3 metros!' },
      { range: '3', text: 'Ferimento Doloroso: O alvo tem desvantagem em todas as ações na próxima rodada.' },
      { range: '4', text: 'Golpe Preciso: Ignora qualquer armadura ou resistência física neste golpe!' },
      { range: '5', text: 'Frenesi Heróico: Cause dano máximo E ganhe um ataque extra imediato!' },
      { range: '6', text: 'Lenda Viva: Dano multiplicado por 3 e todos os aliados recebem +2 em testes por 1 minuto!' }
    ]
  },
  {
    id: 'table-2',
    name: 'Encontro Aleatório na Masmorra',
    formula: '1d8',
    desc: 'O que aguarda o grupo ao virar o próximo corredor?',
    entries: [
      { range: '1', text: 'Silêncio Fantasmagórico: Corredor vazio com tochas recém-apagadas.' },
      { range: '2', text: 'Armadilha Antiga: Placa de pressão no chão dispara dardos envenenados.' },
      { range: '3', text: 'Patrulha Goblinóide: 1d4+1 sentinelas com bestas e cães farejadores.' },
      { range: '4', text: 'Mercador Viajante Misterioso: Vende poções suspeitas e mapas incompletos.' },
      { range: '5', text: 'Santuário Abandonado: Uma fonte límpida que restaura 1d8 pontos de vida.' },
      { range: '6', text: 'Enxame Carniceiro: Ratos gigantes ou besouros carniceiros famintos.' },
      { range: '7', text: 'Inscrições Rúnicas na Parede: Um enigma que destranca uma câmara secreta.' },
      { range: '8', text: 'Criatura Errante Perigosa: Um Troll ou Aparição faminta ronda a área!' }
    ]
  },
  {
    id: 'table-3',
    name: 'Saque Rápido / Loot de Monstro',
    formula: '1d6',
    desc: 'O que o inimigo carregava nos bolsos?',
    entries: [
      { range: '1', text: 'Apenas fiapos, ossinhos roídos e uma moeda de cobre amassada.' },
      { range: '2', text: 'Uma bolsa de couro com 2d6 moedas de prata e dados de marfim.' },
      { range: '3', text: 'Frasco com óleo inflamável e uma gazua de boa qualidade.' },
      { range: '4', text: 'Um anel de prata trabalhado com um brasão nobre (vale 25 PO).' },
      { range: '5', text: 'Um frasco de Poção de Cura Menor (cura 2d4+2 PV).' },
      { range: '6', text: 'Um pergaminho antigo contendo um mapa de tesouro ou feitiço!' }
    ]
  }
];

class StorageManager {
  static get(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.warn('Erro ao carregar dados do localStorage:', e);
      return defaultValue;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Erro ao salvar dados no localStorage:', e);
    }
  }

  static getMacros() {
    return this.get('roladas_macros', DEFAULT_MACROS);
  }

  static saveMacros(macros) {
    this.set('roladas_macros', macros);
  }

  static getTables() {
    return this.get('roladas_tables', DEFAULT_TABLES);
  }

  static saveTables(tables) {
    this.set('roladas_tables', tables);
  }

  static getHistory() {
    return this.get('roladas_history', []);
  }

  static saveHistory(history) {
    this.set('roladas_history', history);
  }

  static getSettings() {
    return this.get('roladas_settings', {
      theme: 'arcane',
      sound: true,
      volume: 0.5,
      animations: true
    });
  }

  static saveSettings(settings) {
    this.set('roladas_settings', settings);
  }
}

// ==========================================
// 5. CONTROLADOR PRINCIPAL DA APLICAÇÃO
// ==========================================
class AppController {
  constructor() {
    this.confetti = new ConfettiEffect('confetti-canvas');
    this.pool = { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };
    this.mod = 0;
    this.advantageMode = 'none'; // 'none' | 'adv' | 'disadv'
    this.history = StorageManager.getHistory();
    this.macros = StorageManager.getMacros();
    this.tables = StorageManager.getTables();
    this.settings = StorageManager.getSettings();

    this.currentCategoryFilter = 'all';
    this.editingMacroId = null;
    this.editingTableId = null;

    this.init();
  }

  init() {
    this.applySettings();
    this.bindEvents();
    this.renderDiceButtons();
    this.renderHistory();
    this.renderMacros();
    this.renderTables();
    this.updateStatsSummary();
  }

  applySettings() {
    document.body.className = `theme-${this.settings.theme}`;
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = this.settings.theme;

    const soundToggle = document.getElementById('sound-toggle-btn');
    if (soundToggle) {
      soundToggle.innerHTML = this.settings.sound ? '🔊 Som Ativo' : '🔇 Mudo';
      soundEngine.enabled = this.settings.sound;
    }
    soundEngine.volume = this.settings.volume;

    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) volumeSlider.value = this.settings.volume;

    const soundCheck = document.getElementById('setting-sound-enabled');
    if (soundCheck) soundCheck.checked = this.settings.sound;
  }

  bindEvents() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = btn.dataset.tab;
        const targetPane = document.getElementById(`tab-${targetTab}`);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.settings.theme = e.target.value;
        StorageManager.saveSettings(this.settings);
        this.applySettings();
      });
    }

    // Sound toggle in header
    const soundToggle = document.getElementById('sound-toggle-btn');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        this.settings.sound = !this.settings.sound;
        StorageManager.saveSettings(this.settings);
        this.applySettings();
      });
    }

    // Quick Pool Dice Click
    document.querySelectorAll('.die-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sides = parseInt(btn.dataset.sides, 10);
        this.addDieToPool(sides);
      });
      // Right click to decrement
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const sides = parseInt(btn.dataset.sides, 10);
        this.removeDieFromPool(sides);
      });
    });

    // Modifier buttons
    document.getElementById('mod-minus-btn')?.addEventListener('click', () => {
      this.mod--;
      this.updateFormulaFromPool();
    });
    document.getElementById('mod-plus-btn')?.addEventListener('click', () => {
      this.mod++;
      this.updateFormulaFromPool();
    });
    document.getElementById('mod-input')?.addEventListener('input', (e) => {
      this.mod = parseInt(e.target.value, 10) || 0;
      this.updateFormulaFromPool();
    });

    // Clear pool
    document.getElementById('clear-pool-btn')?.addEventListener('click', () => {
      this.clearPool();
    });

    // Advantage / Disadvantage toggles
    document.querySelectorAll('.adv-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const mode = chip.dataset.mode;
        if (this.advantageMode === mode) {
          this.advantageMode = 'none';
        } else {
          this.advantageMode = mode;
        }
        document.querySelectorAll('.adv-chip').forEach(c => c.classList.remove('active'));
        if (this.advantageMode !== 'none') {
          chip.classList.add('active');
        }
        this.updateFormulaFromPool();
      });
    });

    // Primary Roll button
    document.getElementById('main-roll-btn')?.addEventListener('click', () => {
      this.executeFormulaRoll();
    });

    // Formula input Enter key
    document.getElementById('formula-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.executeFormulaRoll();
      }
    });

    // Clear history button
    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
      if (confirm('Deseja limpar todo o histórico de rolagens?')) {
        this.history = [];
        StorageManager.saveHistory(this.history);
        this.renderHistory();
        this.updateStatsSummary();
      }
    });

    // Copy history button
    document.getElementById('copy-history-btn')?.addEventListener('click', () => {
      this.copyHistoryToClipboard();
    });

    // New Macro Modal
    document.getElementById('open-new-macro-btn')?.addEventListener('click', () => {
      this.openMacroModal();
    });
    document.getElementById('close-macro-modal-btn')?.addEventListener('click', () => {
      this.closeMacroModal();
    });
    document.getElementById('cancel-macro-modal-btn')?.addEventListener('click', () => {
      this.closeMacroModal();
    });
    document.getElementById('macro-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMacroFromForm();
    });

    // Macro search & filter
    document.getElementById('macro-search-input')?.addEventListener('input', (e) => {
      this.renderMacros(e.target.value);
    });

    // New Table Modal
    document.getElementById('open-new-table-btn')?.addEventListener('click', () => {
      this.openTableModal();
    });
    document.getElementById('close-table-modal-btn')?.addEventListener('click', () => {
      this.closeTableModal();
    });
    document.getElementById('cancel-table-modal-btn')?.addEventListener('click', () => {
      this.closeTableModal();
    });
    document.getElementById('table-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTableFromForm();
    });

    // Backup & Restore
    document.getElementById('export-backup-btn')?.addEventListener('click', () => {
      this.exportBackup();
    });
    document.getElementById('import-backup-input')?.addEventListener('change', (e) => {
      this.importBackup(e);
    });
    document.getElementById('reset-defaults-btn')?.addEventListener('click', () => {
      if (confirm('Atenção: Isso redefinirá todos os macros, tabelas e histórico para o padrão de fábrica. Continuar?')) {
        localStorage.clear();
        location.reload();
      }
    });

    // Settings page controls
    document.getElementById('volume-slider')?.addEventListener('input', (e) => {
      this.settings.volume = parseFloat(e.target.value);
      soundEngine.volume = this.settings.volume;
      StorageManager.saveSettings(this.settings);
    });
    document.getElementById('setting-sound-enabled')?.addEventListener('change', (e) => {
      this.settings.sound = e.target.checked;
      StorageManager.saveSettings(this.settings);
      this.applySettings();
    });
  }

  // Pool Management
  addDieToPool(sides) {
    if (!this.pool[sides]) this.pool[sides] = 0;
    this.pool[sides]++;
    this.updateFormulaFromPool();
  }

  removeDieFromPool(sides) {
    if (this.pool[sides] && this.pool[sides] > 0) {
      this.pool[sides]--;
      this.updateFormulaFromPool();
    }
  }

  clearPool() {
    Object.keys(this.pool).forEach(k => (this.pool[k] = 0));
    this.mod = 0;
    this.advantageMode = 'none';
    document.querySelectorAll('.adv-chip').forEach(c => c.classList.remove('active'));
    this.updateFormulaFromPool();
  }

  updateFormulaFromPool() {
    this.renderDiceButtons();
    const modInput = document.getElementById('mod-input');
    if (modInput) modInput.value = this.mod;

    const parts = [];
    // Sort sides
    const sidesList = [20, 4, 6, 8, 10, 12, 100];
    sidesList.forEach(s => {
      const count = this.pool[s] || 0;
      if (count > 0) {
        if (s === 20 && this.advantageMode === 'adv') {
          parts.push(`${count + 1}d20kh1`);
        } else if (s === 20 && this.advantageMode === 'disadv') {
          parts.push(`${count + 1}d20kl1`);
        } else {
          parts.push(`${count}d${s}`);
        }
      }
    });

    // Se nenhum dado foi clicado mas há modo de vantagem, sugere 2d20
    if (parts.length === 0 && this.advantageMode === 'adv') {
      parts.push('2d20kh1');
    } else if (parts.length === 0 && this.advantageMode === 'disadv') {
      parts.push('2d20kl1');
    }

    let formula = parts.join(' + ');

    if (this.mod !== 0) {
      if (formula.length > 0) {
        formula += this.mod > 0 ? ` + ${this.mod}` : ` - ${Math.abs(this.mod)}`;
      } else {
        formula = `${this.mod}`;
      }
    }

    const input = document.getElementById('formula-input');
    if (input && formula.length > 0) {
      input.value = formula;
    }
  }

  renderDiceButtons() {
    document.querySelectorAll('.die-btn').forEach(btn => {
      const sides = parseInt(btn.dataset.sides, 10);
      const count = this.pool[sides] || 0;
      const badge = btn.querySelector('.die-count-badge');
      if (badge) {
        badge.innerText = count;
      }
      if (count > 0) {
        btn.classList.add('has-dice');
      } else {
        btn.classList.remove('has-dice');
      }
    });
  }

  // Execution
  executeFormulaRoll(customFormula = null, rollLabel = '') {
    const input = document.getElementById('formula-input');
    const formula = customFormula || (input ? input.value : '1d20');

    if (!formula.trim()) {
      alert('Digite uma fórmula de rolada válida (ex: 1d20+5, 4d6dl1)!');
      return;
    }

    try {
      soundEngine.playDiceRoll();
      const result = DiceEngine.evaluate(formula, rollLabel);

      this.displayArenaResult(result);
      this.addHistoryRecord(result);

      // Crit FX
      if (result.hasNat20) {
        soundEngine.playCritSuccess();
        this.confetti.spawn();
      } else if (result.hasNat1) {
        soundEngine.playCritFail();
      }
    } catch (err) {
      alert(`Erro na fórmula: ${err.message}`);
    }
  }

  displayArenaResult(result) {
    const arena = document.getElementById('dice-arena');
    if (!arena) return;

    arena.classList.remove('crit-glow-success', 'crit-glow-fail');
    if (result.hasNat20) arena.classList.add('crit-glow-success');
    if (result.hasNat1) arena.classList.add('crit-glow-fail');

    let totalClass = 'result-total-number';
    let bannerHtml = '';

    if (result.hasNat20) {
      totalClass += ' crit-nat20';
      bannerHtml = '<div class="result-banner success">✨ SUCESSO CRÍTICO / NAT 20! ✨</div>';
    } else if (result.hasNat1) {
      totalClass += ' crit-nat1';
      bannerHtml = '<div class="result-banner fail">💀 FALHA CRÍTICA / NAT 1! 💀</div>';
    }

    // Gerar fichas visuais para os dados rolados
    let diceTokensHtml = '';
    result.diceGroups.forEach(group => {
      group.dice.forEach(die => {
        let tokenClass = 'die-token rolling';
        if (die.dropped) tokenClass += ' dropped';
        else if (die.isMax && group.sides !== 'F') tokenClass += ' crit-max';
        else if (die.isMin && group.sides !== 'F') tokenClass += ' crit-min';

        if (die.success === true) tokenClass += ' crit-max';
        if (die.success === false) tokenClass += ' dropped';

        diceTokensHtml += `
          <div class="${tokenClass}" title="Face: ${die.val} em d${die.sides}">
            <span>${die.text}</span>
            <span class="die-type-tag">d${die.sides}</span>
          </div>
        `;
      });
    });

    const labelHtml = result.label ? `<div style="font-size:1.1rem;font-weight:bold;color:var(--primary-hover);margin-bottom:-5px;">${result.label}</div>` : '';

    arena.innerHTML = `
      <div class="active-result-box">
        ${labelHtml}
        <div class="result-total-display">
          <div class="${totalClass}">${result.total}</div>
          ${bannerHtml}
        </div>
        <div class="dice-breakdown-row">
          ${diceTokensHtml}
        </div>
        <div class="result-formula-caption">
          ${result.rawFormula}
        </div>
      </div>
    `;
  }

  addHistoryRecord(result) {
    this.history.unshift(result);
    if (this.history.length > 50) this.history.pop();
    StorageManager.saveHistory(this.history);
    this.renderHistory();
    this.updateStatsSummary();
  }

  renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (this.history.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem 1rem;">Nenhuma rolada realizada ainda.</div>';
      return;
    }

    list.innerHTML = this.history.map((item, idx) => {
      const isSuccess = item.hasNat20 ? 'success' : (item.hasNat1 ? 'fail' : '');
      const diceBreakdown = item.diceGroups.map(g => {
        const values = g.dice.map(d => d.dropped ? `<s>${d.val}</s>` : d.val).join(', ');
        return `[${values}]`;
      }).join(' + ');

      return `
        <div class="history-item" onclick="window.app.executeFormulaRoll('${item.rawFormula}', '${item.label || ''}')" title="Clique para rolar novamente">
          <div class="history-item-left">
            ${item.label ? `<span class="history-label">${item.label}</span>` : ''}
            <span class="history-formula">${item.rawFormula}</span>
            <span class="history-breakdown">${diceBreakdown} às ${item.timestamp}</span>
          </div>
          <div class="history-total ${isSuccess}">${item.total}</div>
        </div>
      `;
    }).join('');
  }

  updateStatsSummary() {
    const totalRollsEl = document.getElementById('stat-total-rolls');
    const avgRollEl = document.getElementById('stat-avg-roll');
    const highestRollEl = document.getElementById('stat-highest-roll');
    const critsCountEl = document.getElementById('stat-crits-count');

    if (!totalRollsEl) return;

    if (this.history.length === 0) {
      totalRollsEl.innerText = '0';
      avgRollEl.innerText = '0';
      highestRollEl.innerText = '0';
      critsCountEl.innerText = '0';
      return;
    }

    const total = this.history.length;
    const sum = this.history.reduce((acc, h) => acc + (typeof h.total === 'number' ? h.total : 0), 0);
    const avg = (sum / total).toFixed(1);
    const max = Math.max(...this.history.map(h => typeof h.total === 'number' ? h.total : 0));
    const crits = this.history.filter(h => h.hasNat20).length;

    totalRollsEl.innerText = total;
    avgRollEl.innerText = avg;
    highestRollEl.innerText = max;
    critsCountEl.innerText = crits;
  }

  copyHistoryToClipboard() {
    if (this.history.length === 0) {
      alert('Histórico vazio!');
      return;
    }
    const text = this.history.map(h => {
      const label = h.label ? `[${h.label}] ` : '';
      return `${h.timestamp} - ${label}${h.rawFormula} = ${h.total}`;
    }).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      alert('Histórico copiado para a área de transferência!');
    }).catch(() => {
      prompt('Copie o histórico abaixo:', text);
    });
  }

  // ==========================================
  // MACROS / PRESETS
  // ==========================================
  renderMacros(filterSearch = '') {
    const container = document.getElementById('macros-grid');
    if (!container) return;

    const categories = ['all', ...new Set(this.macros.map(m => m.category || 'Geral'))];
    this.renderCategoryChips(categories);

    let filtered = this.macros;
    if (this.currentCategoryFilter !== 'all') {
      filtered = filtered.filter(m => (m.category || 'Geral') === this.currentCategoryFilter);
    }
    if (filterSearch.trim()) {
      const search = filterSearch.toLowerCase();
      filtered = filtered.filter(m => m.name.toLowerCase().includes(search) || m.formula.toLowerCase().includes(search) || (m.desc && m.desc.toLowerCase().includes(search)));
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">Nenhum botão de rolada encontrado com esses filtros.</div>';
      return;
    }

    container.innerHTML = filtered.map(macro => `
      <div class="macro-card">
        <div class="macro-card-header">
          <div class="macro-title-group">
            <span class="macro-icon">${macro.icon || '🎲'}</span>
            <span class="macro-name">${macro.name}</span>
          </div>
          <span class="macro-category-badge">${macro.category || 'Geral'}</span>
        </div>
        <div class="macro-formula-text">${macro.formula}</div>
        ${macro.desc ? `<div class="macro-desc">${macro.desc}</div>` : ''}
        <div class="macro-card-footer">
          <button class="macro-btn-roll" onclick="window.app.rollMacro('${macro.id}')">
            <span>🎲</span> Rolar
          </button>
          <div class="macro-actions">
            <button class="macro-action-btn" title="Editar" onclick="window.app.editMacro('${macro.id}')">✏️</button>
            <button class="macro-action-btn delete" title="Excluir" onclick="window.app.deleteMacro('${macro.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderCategoryChips(categories) {
    const container = document.getElementById('category-filter-chips');
    if (!container) return;

    container.innerHTML = categories.map(cat => `
      <button class="category-chip ${this.currentCategoryFilter === cat ? 'active' : ''}" onclick="window.app.filterByCategory('${cat}')">
        ${cat === 'all' ? 'Todos' : cat}
      </button>
    `).join('');
  }

  filterByCategory(cat) {
    this.currentCategoryFilter = cat;
    const searchVal = document.getElementById('macro-search-input')?.value || '';
    this.renderMacros(searchVal);
  }

  rollMacro(id) {
    const macro = this.macros.find(m => m.id === id);
    if (!macro) return;
    this.executeFormulaRoll(macro.formula, macro.name);

    // switch to roll tray tab smoothly
    const trayTabBtn = document.querySelector('[data-tab="tray"]');
    if (trayTabBtn) trayTabBtn.click();
  }

  openMacroModal(macro = null) {
    this.editingMacroId = macro ? macro.id : null;
    const modal = document.getElementById('macro-modal');
    const title = document.getElementById('macro-modal-title');
    if (title) title.innerText = macro ? 'Editar Rolada Customizada' : 'Criar Nova Rolada Customizada';

    document.getElementById('macro-name-input').value = macro ? macro.name : '';
    document.getElementById('macro-formula-input').value = macro ? macro.formula : '';
    document.getElementById('macro-category-input').value = macro ? (macro.category || 'Geral') : 'Geral';
    document.getElementById('macro-icon-input').value = macro ? (macro.icon || '⚔️') : '⚔️';
    document.getElementById('macro-desc-input').value = macro ? (macro.desc || '') : '';

    modal?.classList.add('open');
  }

  closeMacroModal() {
    document.getElementById('macro-modal')?.classList.remove('open');
    this.editingMacroId = null;
  }

  saveMacroFromForm() {
    const name = document.getElementById('macro-name-input').value.trim();
    const formula = document.getElementById('macro-formula-input').value.trim();
    const category = document.getElementById('macro-category-input').value.trim() || 'Geral';
    const icon = document.getElementById('macro-icon-input').value.trim() || '🎲';
    const desc = document.getElementById('macro-desc-input').value.trim();

    if (!name || !formula) {
      alert('Por favor, preencha o Nome e a Fórmula!');
      return;
    }

    if (this.editingMacroId) {
      const idx = this.macros.findIndex(m => m.id === this.editingMacroId);
      if (idx !== -1) {
        this.macros[idx] = { id: this.editingMacroId, name, formula, category, icon, desc };
      }
    } else {
      this.macros.push({
        id: 'macro-' + Date.now(),
        name,
        formula,
        category,
        icon,
        desc
      });
    }

    StorageManager.saveMacros(this.macros);
    this.closeMacroModal();
    this.renderMacros();
  }

  editMacro(id) {
    const macro = this.macros.find(m => m.id === id);
    if (macro) this.openMacroModal(macro);
  }

  deleteMacro(id) {
    if (confirm('Tem certeza que deseja excluir esta rolada customizada?')) {
      this.macros = this.macros.filter(m => m.id !== id);
      StorageManager.saveMacros(this.macros);
      this.renderMacros();
    }
  }

  // ==========================================
  // TABELAS DE ROLADA ALEATÓRIA
  // ==========================================
  renderTables() {
    const container = document.getElementById('tables-grid');
    if (!container) return;

    if (this.tables.length === 0) {
      container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">Nenhuma tabela cadastrada. Crie uma para começar!</div>';
      return;
    }

    container.innerHTML = this.tables.map(tbl => `
      <div class="table-card">
        <div class="macro-card-header">
          <div>
            <div style="font-weight:bold;font-size:1.1rem;color:var(--text-main);">${tbl.name}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);">${tbl.desc || ''}</div>
          </div>
          <span class="macro-category-badge">${tbl.formula}</span>
        </div>

        <div class="table-entries-list">
          ${tbl.entries.map(e => `
            <div class="table-entry-row">
              <span class="table-entry-range">${e.range}</span>
              <span class="table-entry-text">${e.text}</span>
            </div>
          `).join('')}
        </div>

        <div id="table-result-${tbl.id}" class="table-roll-result">
          <span style="color:var(--text-muted);font-style:italic;">Clique abaixo para rolar um resultado aleatório...</span>
        </div>

        <div class="macro-card-footer">
          <button class="macro-btn-roll" onclick="window.app.rollOnTable('${tbl.id}')">
            <span>📜</span> Sortear na Tabela (${tbl.formula})
          </button>
          <div class="macro-actions">
            <button class="macro-action-btn delete" title="Excluir Tabela" onclick="window.app.deleteTable('${tbl.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  rollOnTable(tableId) {
    const tbl = this.tables.find(t => t.id === tableId);
    if (!tbl) return;

    try {
      soundEngine.playDiceRoll();
      const rollRes = DiceEngine.evaluate(tbl.formula, tbl.name);
      const rollVal = rollRes.total;

      // Localiza a entrada correspondente ao resultado
      let matchedEntry = null;
      for (const entry of tbl.entries) {
        if (entry.range.includes('-')) {
          const [min, max] = entry.range.split('-').map(x => parseInt(x.trim(), 10));
          if (rollVal >= min && rollVal <= max) {
            matchedEntry = entry;
            break;
          }
        } else {
          if (parseInt(entry.range.trim(), 10) === rollVal) {
            matchedEntry = entry;
            break;
          }
        }
      }

      const resultBox = document.getElementById(`table-result-${tbl.id}`);
      if (resultBox) {
        if (matchedEntry) {
          resultBox.innerHTML = `
            <div>
              <strong style="color:var(--primary-hover);font-size:1.05rem;">Rolada [${rollVal}]:</strong> ${matchedEntry.text}
            </div>
          `;
        } else {
          resultBox.innerHTML = `<div><strong>Rolada [${rollVal}]:</strong> Sem correspondência direta na tabela.</div>`;
        }
      }

      this.addHistoryRecord({
        ...rollRes,
        label: `Tabela: ${tbl.name} [Resultado: ${rollVal}]`
      });
    } catch (e) {
      alert(`Erro ao rolar na tabela: ${e.message}`);
    }
  }

  openTableModal() {
    const modal = document.getElementById('table-modal');
    modal?.classList.add('open');
  }

  closeTableModal() {
    document.getElementById('table-modal')?.classList.remove('open');
  }

  saveTableFromForm() {
    const name = document.getElementById('table-name-input').value.trim();
    const formula = document.getElementById('table-formula-input').value.trim();
    const desc = document.getElementById('table-desc-input').value.trim();
    const rawEntries = document.getElementById('table-entries-input').value.trim();

    if (!name || !formula || !rawEntries) {
      alert('Preencha o Nome, Fórmula e as Entradas da Tabela!');
      return;
    }

    const entries = [];
    const lines = rawEntries.split('\n');
    for (const line of lines) {
      if (line.includes(':')) {
        const [range, ...textParts] = line.split(':');
        entries.push({
          range: range.trim(),
          text: textParts.join(':').trim()
        });
      }
    }

    if (entries.length === 0) {
      alert('Formato inválido! Cada linha deve ser "Intervalo : Descrição" (ex: 1 : Item Fraco)');
      return;
    }

    this.tables.push({
      id: 'table-' + Date.now(),
      name,
      formula,
      desc,
      entries
    });

    StorageManager.saveTables(this.tables);
    this.closeTableModal();
    this.renderTables();
  }

  deleteTable(id) {
    if (confirm('Tem certeza que deseja excluir esta tabela?')) {
      this.tables = this.tables.filter(t => t.id !== id);
      StorageManager.saveTables(this.tables);
      this.renderTables();
    }
  }

  // ==========================================
  // BACKUP EXPORT & IMPORT
  // ==========================================
  exportBackup() {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      macros: this.macros,
      tables: this.tables,
      settings: this.settings
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roladas_infinitas_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.macros && Array.isArray(data.macros)) {
          this.macros = data.macros;
          StorageManager.saveMacros(this.macros);
        }
        if (data.tables && Array.isArray(data.tables)) {
          this.tables = data.tables;
          StorageManager.saveTables(this.tables);
        }
        if (data.settings) {
          this.settings = { ...this.settings, ...data.settings };
          StorageManager.saveSettings(this.settings);
        }
        alert('Backup importado com sucesso!');
        location.reload();
      } catch (err) {
        alert('Falha ao importar o arquivo. Certifique-se de que é um JSON válido.');
      }
    };
    reader.readAsText(file);
  }
}

// Inicializa no carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});

