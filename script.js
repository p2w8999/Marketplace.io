// Game State
let balance = 50;
let inventory = [];
let portfolio = {};
let passiveIncomePerSec = 0;
let incomeInterval;
let hasRedirected = false;
let savFolderHandle = null;

const DIAMOND_THRESHOLD = 1_000_000_000;
const FINAL_CUT_URL = 'file:///C:/Users/hp/Videos/FINAL%20CUT/final.html';
const SHOP_URL = 'C:\Users\hp\Desktop\vadim personal\vadim personal\html code homework\ptm.html';
const SAV_FOLDER_NAME = 'sav';
const MAX_SAVES = 5;

function formatCurrency(amount) {
    if (amount >= DIAMOND_THRESHOLD) {
        const diamonds = amount / DIAMOND_THRESHOLD;
        const formatted = Number.isInteger(diamonds) ? diamonds.toLocaleString() : diamonds.toLocaleString(undefined, { maximumFractionDigits: 2 });
        return `${formatted} 💎`;
    }
    return `R$ ${amount.toLocaleString()}`;
}

// File System Save/Load
async function getSavFolder() {
    if (savFolderHandle) return savFolderHandle;
    try {
        const dirHandle = await window.showDirectoryPicker();
        savFolderHandle = await dirHandle.getDirectoryHandle(SAV_FOLDER_NAME, { create: true });
        return savFolderHandle;
    } catch (e) {
        console.warn('Directory picker cancelled or failed:', e);
        return null;
    }
}

async function saveGame() {
    const folder = await getSavFolder();
    if (!folder) return false;

    const saveData = {
        balance,
        inventory,
        portfolio,
        passiveIncomePerSec,
        activeLoans,
        startups,
        startupPortfolio,
        chatLog,
        godMode,
        cpsMultiplier,
        hasRedirected,
        savedAt: new Date().toISOString()
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `save_${timestamp}.json`;

    try {
        const fileHandle = await folder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(saveData, null, 2));
        await writable.close();

        await cleanupOldSaves(folder);
        console.log('Game saved:', filename);
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        return false;
    }
}

async function cleanupOldSaves(folder) {
    const files = [];
    try {
        for await (const [name, handle] of folder.entries()) {
            if (name.startsWith('save_') && name.endsWith('.json')) {
                files.push({ name, handle });
            }
        }
        files.sort((a, b) => b.name.localeCompare(a.name));
        const toDelete = files.slice(MAX_SAVES);
        for (const f of toDelete) {
            try { await folder.removeEntry(f.name); } catch (e) {}
        }
    } catch (e) {
        console.warn('Cleanup failed:', e);
    }
}

async function loadGame() {
    const folder = await getSavFolder();
    if (!folder) return false;

    const files = [];
    try {
        for await (const [name, handle] of folder.entries()) {
            if (name.startsWith('save_') && name.endsWith('.json')) {
                files.push({ name, handle });
            }
        }
    } catch (e) {
        console.warn('Failed to list saves:', e);
        return false;
    }

    if (files.length === 0) return false;

    files.sort((a, b) => b.name.localeCompare(a.name));

    try {
        const file = await files[0].handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        balance = data.balance ?? 500;
        inventory = data.inventory ?? [];
        portfolio = data.portfolio ?? {};
        passiveIncomePerSec = data.passiveIncomePerSec ?? 0;
        activeLoans = data.activeLoans ?? [];
        startups = data.startups ?? [];
        startupPortfolio = data.startupPortfolio ?? {};
        chatLog = data.chatLog ?? [];
        godMode = data.godMode ?? false;
        cpsMultiplier = data.cpsMultiplier ?? 1;
        hasRedirected = data.hasRedirected ?? false;

        console.log('Game loaded from:', files[0].name);
        return true;
    } catch (e) {
        console.error('Load failed:', e);
        return false;
    }
}

// Loan State
let activeLoans = [];
let loansData = [
  { id: 'small', name: 'Starter Loan', amount: 1000, interestRate: 0.05, durationSec: 60, description: 'Small loan, quick repayment.' },
  { id: 'medium', name: 'Business Loan', amount: 10000, interestRate: 0.10, durationSec: 120, description: 'For growing traders.' },
  { id: 'large', name: 'Corporate Loan', amount: 100000, interestRate: 0.15, durationSec: 180, description: 'High risk, high reward.' },
  { id: 'mega', name: 'Tycoon Loan', amount: 1000000, interestRate: 0.20, durationSec: 300, description: 'For the ambitious tycoon.' },
  { id: 'divine', name: 'Divine Loan', amount: 100000000, interestRate: 0.25, durationSec: 600, description: 'Borrow from the gods themselves.' },
  { id: 'cosmic', name: 'Cosmic Loan', amount: 5000000000, interestRate: 0.30, durationSec: 900, description: 'Funded by intergalactic banks.' },
  { id: 'multiverse', name: 'Multiverse Loan', amount: 100000000000, interestRate: 0.35, durationSec: 1200, description: 'Borrow from alternate versions of yourself.' },
  { id: 'time', name: 'Time Loan', amount: 5000000000000, interestRate: 0.40, durationSec: 1800, description: 'Loan from your future self. High stakes.' },
  { id: 'infinity', name: 'Infinity Loan', amount: 100000000000000, interestRate: 0.50, durationSec: 3600, description: 'Infinite money, infinite risk.' },
  { id: 'void', name: 'Void Loan', amount: 10000000000000000, interestRate: 0.75, durationSec: 7200, description: 'Borrowed from the void itself.' }
];

// Startup State
let startups = [];
let startupPortfolio = {};

// Chat State
let chatLog = [];

// Admin State
let godMode = false;
let cpsMultiplier = 1;

// DOM Elements
const views = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};

const adminPanel = document.getElementById('admin-panel');
const balanceEl = document.getElementById('player-balance');
const cpsEl = document.getElementById('passive-income-display');

const marketGrid = document.getElementById('market-grid');
const investmentsGrid = document.getElementById('investments-grid');
const inventoryGrid = document.getElementById('inventory-grid');
const portfolioList = document.getElementById('portfolio-list');
const emptyInvMsg = document.getElementById('empty-inventory-msg');
const loansGrid = document.getElementById('loans-grid');
const activeLoansSection = document.getElementById('active-loans-section');
const activeLoansList = document.getElementById('active-loans-list');

const startupsGrid = document.getElementById('startups-grid');
const startupPortfolioList = document.getElementById('startup-portfolio-list');
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initial setup
async function init() {
    renderMarket();
    renderInvestments();
    renderLoans();
    renderStartups();
    renderChat();
    populateAdminDropdowns();
    updateUI();
    startLoanTimer();
    startBankruptCheck();
}

// Tabs Logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Logic Functions
function buyItem(itemObj) {
    if (balance >= itemObj.price) {
        updateBalance(-itemObj.price);
        const markup = (Math.random() * 0.4 + 1.1).toFixed(2);
        const sellValue = Math.round(itemObj.price * markup);
        inventory.push({
            ...itemObj,
            uid: Date.now() + Math.random().toString(),
            sellPrice: sellValue
        });
        updateUI();
        saveGame();
    }
}

function sellItem(uid) {
    const itemIndex = inventory.findIndex(i => i.uid === uid);
    if (itemIndex !== -1) {
        const item = inventory[itemIndex];
        updateBalance(item.sellPrice);
        inventory.splice(itemIndex, 1);
        updateUI();
        saveGame();
    }
}

function buyInvestment(investObj) {
    if (balance >= investObj.price) {
        updateBalance(-investObj.price);
        if (!portfolio[investObj.id]) portfolio[investObj.id] = 0;
        portfolio[investObj.id] += 1;
        recalculatePassiveIncome();
        updateUI();
        saveGame();
    }
}

function recalculatePassiveIncome() {
    passiveIncomePerSec = 0;
    investmentsData.forEach(inv => {
        if (portfolio[inv.id]) passiveIncomePerSec += inv.cps * portfolio[inv.id];
    });
    passiveIncomePerSec += getStartupIncome();
    let totalCPS = passiveIncomePerSec * cpsMultiplier;
    cpsEl.textContent = `+${formatCurrency(totalCPS)} /sec`;

    if ((passiveIncomePerSec > 0 || activeLoans.length > 0) && !incomeInterval) {
        incomeInterval = setInterval(() => {
            if (views.game.classList.contains('active')) {
                let tickIncome = passiveIncomePerSec * cpsMultiplier;
                processLoans();
                updateBalance(tickIncome, false);
                updateUI();
            }
        }, 1000);
    }
}

function updateBalance(amount, animate = true) {
    balance += amount;
    balanceEl.textContent = formatCurrency(balance);
    if (amount > 0 && animate) {
        balanceEl.classList.remove('pulse');
        void balanceEl.offsetWidth;
        balanceEl.classList.add('pulse');
    }
}

function checkGameOver() {
    const cheapestPrice = Math.min(...itemsData.map(i => i.price));
    if (balance < cheapestPrice && inventory.length === 0 && passiveIncomePerSec === 0 && activeLoans.length === 0) {
        switchView('gameOver');
    }
}

function checkDiamondRedirect() {
    if (balance >= DIAMOND_THRESHOLD && !hasRedirected) {
        hasRedirected = true;
        saveGame().then(() => {
            addChatMessage('System', '🎬 You reached 1 💎! Redirecting to final cut...', true);
            setTimeout(() => {
                window.location.href = FINAL_CUT_URL;
            }, 1500);
        });
    }
}

// Loan Functions
function takeLoan(loanObj) {
    if (!godMode && activeLoans.find(l => l.id === loanObj.id && !l.repaid)) return;
    const totalOwed = Math.round(loanObj.amount * (1 + loanObj.interestRate));
    const loanInstance = {
        ...loanObj,
        uid: Date.now() + Math.random().toString(),
        totalOwed: totalOwed,
        remaining: totalOwed,
        takenAt: Date.now(),
        elapsed: 0,
        repaid: false
    };
    activeLoans.push(loanInstance);
    updateBalance(loanObj.amount);
    recalculatePassiveIncome();
    updateUI();
    saveGame();
}

function repayLoan(uid) {
    const loanIndex = activeLoans.findIndex(l => l.uid === uid);
    if (loanIndex === -1) return;
    const loan = activeLoans[loanIndex];
    if (loan.repaid) return;
    if (godMode || balance >= loan.remaining) {
        updateBalance(-loan.remaining);
        activeLoans.splice(loanIndex, 1);
        recalculatePassiveIncome();
        updateUI();
        saveGame();
    }
}

function processLoans() {
    activeLoans.forEach(loan => {
        if (loan.repaid) return;
        loan.elapsed += 1;
        if (loan.elapsed >= loan.durationSec) {
            loan.remaining = Math.round(loan.remaining * 2);
            loan.elapsed = 0;
            loan.durationSec = Math.round(loan.durationSec * 1.5);
        }
    });
}

// Startup Functions
function createStartup(name) {
    if (!name || name.trim().length === 0) return;
    const startup = {
        id: 'startup_' + Date.now(),
        name: name.trim(),
        totalInvested: 0,
        sharePrice: 1000,
        cpsPerShare: 2,
        createdAt: Date.now()
    };
    startups.push(startup);
    addChatMessage('System', `New startup "${startup.name}" has been founded! Invest now!`, true);
    renderStartups();
    updateUI();
    saveGame();
}

function investInStartup(startupId, shares) {
    const startup = startups.find(s => s.id === startupId);
    if (!startup || shares <= 0) return;
    const cost = shares * startup.sharePrice;
    if (balance < cost) return;
    updateBalance(-cost);
    startup.totalInvested += cost;
    if (!startupPortfolio[startupId]) startupPortfolio[startupId] = 0;
    startupPortfolio[startupId] += shares;
    startup.sharePrice = Math.round(startup.sharePrice * 1.05);
    startup.cpsPerShare = Math.round(startup.cpsPerShare * 1.02);
    recalculatePassiveIncome();
    renderStartups();
    updateUI();
    saveGame();
}

function donateToStartup(startupId, amount) {
    const startup = startups.find(s => s.id === startupId);
    if (!startup || amount <= 0) return;
    if (balance < amount) return;
    updateBalance(-amount);
    startup.totalInvested += amount;
    const boost = Math.floor(amount / 1000);
    startup.cpsPerShare += boost;
    addChatMessage('System', `Someone donated ${formatCurrency(amount)} to "${startup.name}"! CPS boosted!`, true);
    recalculatePassiveIncome();
    renderStartups();
    updateUI();
    saveGame();
}

function getStartupIncome() {
    let income = 0;
    startups.forEach(s => {
        const shares = startupPortfolio[s.id] || 0;
        if (shares > 0) income += s.cpsPerShare * shares;
    });
    return income;
}

function addChatMessage(sender, message, isSystem = false, isAdmin = false) {
    const actualSender = isAdmin ? 'Admin' : sender;
    chatLog.push({ sender: actualSender, message, isSystem, time: new Date().toLocaleTimeString() });
    if (chatLog.length > 100) chatLog.shift();
    renderChat();
}

function renderChat() {
    if (!chatContainer) return;
    chatContainer.innerHTML = chatLog.map(msg => {
        const isAdmin = msg.sender === 'Admin';
        const checkmark = isAdmin ? '<span class="admin-checkmark">✅</span>' : '';
        const systemClass = msg.isSystem ? 'chat-system' : '';
        const adminClass = isAdmin ? 'chat-admin' : '';
        return `<div class="chat-message ${systemClass} ${adminClass}"><span class="chat-time">[${msg.time}]</span> <b>${msg.sender}${checkmark}:</b> ${msg.message}</div>`;
    }).join('');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function sendChatMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;
    if (text.startsWith('/')) processAdminCommand(text);
    else addChatMessage('Player', text);
    chatInput.value = '';
}

function populateAdminDropdowns() {
    const itemSelect = document.getElementById('admin-item-select');
    const investSelect = document.getElementById('admin-invest-select');
    if (itemSelect) itemSelect.innerHTML = itemsData.map(item => `<option value="${item.id}">${item.name} (${formatCurrency(item.price)})</option>`).join('');
    if (investSelect) investSelect.innerHTML = investmentsData.map(inv => `<option value="${inv.id}">${inv.name} (${formatCurrency(inv.price)})</option>`).join('');
}

function adminGiveItem(itemId) {
    const item = itemsData.find(i => i.id === itemId);
    if (!item) return;
    const markup = (Math.random() * 0.4 + 1.1).toFixed(2);
    const sellValue = Math.round(item.price * markup);
    inventory.push({ ...item, uid: Date.now() + Math.random().toString(), sellPrice: sellValue });
    updateUI();
    saveGame();
}

function adminGiveInvestment(invId) {
    const inv = investmentsData.find(i => i.id === invId);
    if (!inv) return;
    if (!portfolio[inv.id]) portfolio[inv.id] = 0;
    portfolio[inv.id] += 1;
    recalculatePassiveIncome();
    updateUI();
    saveGame();
}

function adminAddFunds(amount) { updateBalance(amount); updateUI(); saveGame(); }
function adminSetMultiplier(val) { cpsMultiplier = Math.max(1, val || 1); recalculatePassiveIncome(); updateUI(); saveGame(); }

function toggleGodMode() {
    godMode = !godMode;
    const btn = document.getElementById('btn-admin-god');
    if (btn) btn.textContent = godMode ? 'God Mode: ON' : 'God Mode: OFF';
    document.body.style.boxShadow = godMode ? 'inset 0 0 100px rgba(255, 215, 0, 0.2)' : 'none';
}

function processAdminCommand(text) {
    const parts = text.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();
    const arg1 = parts[1];
    switch (cmd) {
        case 'givemoney': case 'add': { const amount = parseInt(arg1); if (!isNaN(amount)) { adminAddFunds(amount); addChatMessage('Admin', `Gave ${formatCurrency(amount)}`, false, true); } else addChatMessage('System', 'Usage: /givemoney <amount>', true); break; }
        case 'setmoney': case 'set': { const amount = parseInt(arg1); if (!isNaN(amount) && amount >= 0) { balance = amount; updateUI(); addChatMessage('Admin', `Set balance to ${formatCurrency(amount)}`, false, true); } else addChatMessage('System', 'Usage: /setmoney <amount>', true); break; }
        case 'giveitem': { if (arg1) { adminGiveItem(arg1); addChatMessage('Admin', `Gave item ${arg1}`, false, true); } else addChatMessage('System', 'Usage: /giveitem <item_id>', true); break; }
        case 'giveinvest': { if (arg1) { adminGiveInvestment(arg1); addChatMessage('Admin', `Gave investment ${arg1}`, false, true); } else addChatMessage('System', 'Usage: /giveinvest <invest_id>', true); break; }
        case 'givestartup': { if (arg1) { const startup = startups.find(s => s.id === arg1); if (startup) { if (!startupPortfolio[arg1]) startupPortfolio[arg1] = 0; startupPortfolio[arg1] += 1; recalculatePassiveIncome(); updateUI(); addChatMessage('Admin', `Gave 1 share of ${startup.name}`, false, true); } else addChatMessage('System', `Startup ${arg1} not found`, true); } else addChatMessage('System', 'Usage: /givestartup <startup_id>', true); break; }
        case 'godmode': { toggleGodMode(); addChatMessage('Admin', `God Mode ${godMode ? 'ON' : 'OFF'}`, false, true); break; }
        case 'reset': { resetGame(); switchView('start'); addChatMessage('Admin', 'Game reset', false, true); break; }
        case 'setcps': { const val = parseFloat(arg1); if (!isNaN(val)) { adminSetMultiplier(val); addChatMessage('Admin', `CPS Multiplier set to ${val}x`, false, true); } else addChatMessage('System', 'Usage: /setcps <multiplier>', true); break; }
        case 'clearloans': { activeLoans = []; recalculatePassiveIncome(); updateUI(); addChatMessage('Admin', 'All loans cleared', false, true); saveGame(); break; }
        case 'createstartup': { const name = parts.slice(1).join(' '); if (name) { createStartup(name); addChatMessage('Admin', `Created startup "${name}"`, false, true); } else addChatMessage('System', 'Usage: /createstartup <name>', true); break; }
        case 'say': { const msg = parts.slice(1).join(' '); if (msg) addChatMessage('Admin', msg, false, true); else addChatMessage('System', 'Usage: /say <message>', true); break; }
        case 'credits': showCredits(); break;
        case 'shop': { addChatMessage('System', '🛒 Redirecting to shop...', true); setTimeout(() => { window.location.href = SHOP_URL; }, 1000); break; }
        case 'help': addChatMessage('System', 'Commands: /givemoney, /setmoney, /giveitem, /giveinvest, /givestartup, /godmode, /reset, /setcps, /clearloans, /createstartup, /say, /credits, /shop', true); break;
        default: addChatMessage('System', `Unknown command: ${cmd}. Type /help for list.`, true);
    }
}

// Rendering
function renderMarket() {
    marketGrid.innerHTML = '';
    itemsData.forEach(item => {
        const card = document.createElement('div');
        const canAfford = balance >= item.price;
        card.className = `item-card ${canAfford ? 'affordable' : ''}`;
        const imageHTML = item.image ? `<img src="${item.image}" alt="${item.name}">` : `<div class="no-image">📦</div>`;
        card.innerHTML = `${imageHTML}<div class="item-name">${item.name}</div><div class="item-price">${formatCurrency(item.price)}</div><button class="action-btn buy-btn" ${!canAfford ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Buy Item</button>`;
        card.querySelector('.buy-btn').addEventListener('click', () => buyItem(item));
        marketGrid.appendChild(card);
    });
}

function renderInvestments() {
    investmentsGrid.innerHTML = '';
    investmentsData.forEach(inv => {
        const card = document.createElement('div');
        const canAfford = balance >= inv.price;
        const owned = portfolio[inv.id] || 0;
        card.className = `invest-card ${canAfford ? 'affordable' : ''}`;
        card.innerHTML = `<div class="invest-info"><h3>${inv.name} (Owned: ${owned})</h3><p>${inv.description}</p><div class="invest-cps">Yields: +${formatCurrency(inv.cps)} /sec</div></div><div class="invest-action"><div class="item-price">Cost: ${formatCurrency(inv.price)}</div><button class="action-btn buy-btn" style="margin-top: 0;" ${!canAfford ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Invest</button></div>`;
        card.querySelector('.buy-btn').addEventListener('click', () => buyInvestment(inv));
        investmentsGrid.appendChild(card);
    });
}

function renderInventory() {
    inventoryGrid.innerHTML = '';
    if (inventory.length === 0) emptyInvMsg.classList.remove('hidden');
    else {
        emptyInvMsg.classList.add('hidden');
        [...inventory].reverse().forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            const imageHTML = item.image ? `<img src="${item.image}" alt="${item.name}">` : `<div class="no-image" style="height:80px; font-size:2rem;">📦</div>`;
            card.innerHTML = `${imageHTML}<div class="item-name">${item.name}</div><div class="resell-value">Value: ${formatCurrency(item.sellPrice)}</div><button class="action-btn sell-btn">Sell</button>`;
            card.querySelector('.sell-btn').addEventListener('click', () => sellItem(item.uid));
            inventoryGrid.appendChild(card);
        });
    }
}

function renderPortfolio() {
    portfolioList.innerHTML = '';
    let hasPortfolio = false;
    investmentsData.forEach(inv => {
        const owned = portfolio[inv.id] || 0;
        if (owned > 0) {
            hasPortfolio = true;
            const el = document.createElement('div');
            el.className = 'portfolio-item';
            el.innerHTML = `<span>${inv.name} (x${owned})</span><span class="robux">+${formatCurrency(inv.cps * owned * cpsMultiplier)}/s</span>`;
            portfolioList.appendChild(el);
        }
    });
    if (!hasPortfolio) portfolioList.innerHTML = '<div style="color:var(--text-secondary); font-style:italic;">No investments yet.</div>';
}

function renderStartups() {
    if (!startupsGrid) return;
    startupsGrid.innerHTML = '';
    if (startups.length === 0) startupsGrid.innerHTML = '<div style="color:var(--text-secondary); font-style:italic; text-align:center;">No startups yet. Create one below!</div>';
    else {
        startups.forEach(startup => {
            const card = document.createElement('div');
            const shares = startupPortfolio[startup.id] || 0;
            const canAfford = balance >= startup.sharePrice;
            card.className = `startup-card ${canAfford ? 'affordable' : ''}`;
            card.innerHTML = `<div class="startup-info"><h3>${startup.name}</h3><p>Total Invested: ${formatCurrency(startup.totalInvested)}</p><div class="startup-cps">CPS/Share: +${formatCurrency(startup.cpsPerShare)}</div><div class="startup-shares">Your Shares: ${shares}</div></div><div class="startup-action"><div class="item-price">Share: ${formatCurrency(startup.sharePrice)}</div><div class="startup-btns"><button class="action-btn buy-btn startup-invest-btn" ${!canAfford ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Buy 1 Share</button></div><div class="donate-row"><input type="number" class="donate-input" placeholder="Amount" min="1"><button class="action-btn donate-btn">Donate</button></div>`;
            const investBtn = card.querySelector('.startup-invest-btn');
            if (canAfford) investBtn.addEventListener('click', () => investInStartup(startup.id, 1));
            const donateBtn = card.querySelector('.donate-btn');
            const donateInput = card.querySelector('.donate-input');
            donateBtn.addEventListener('click', () => { const amount = parseInt(donateInput.value); if (!isNaN(amount) && amount > 0) { donateToStartup(startup.id, amount); donateInput.value = ''; } });
            startupsGrid.appendChild(card);
        });
    }
    if (startupPortfolioList) {
        startupPortfolioList.innerHTML = '';
        let hasStartups = false;
        startups.forEach(startup => {
            const shares = startupPortfolio[startup.id] || 0;
            if (shares > 0) {
                hasStartups = true;
                const el = document.createElement('div');
                el.className = 'portfolio-item';
                el.innerHTML = `<span>${startup.name} (x${shares})</span><span class="robux">+${formatCurrency(startup.cpsPerShare * shares * cpsMultiplier)}/s</span>`;
                startupPortfolioList.appendChild(el);
            }
        });
        if (!hasStartups) startupPortfolioList.innerHTML = '<div style="color:var(--text-secondary); font-style:italic;">No startup shares yet.</div>';
    }
}

function renderLoans() {
    if (!loansGrid) return;
    loansGrid.innerHTML = '';
    loansData.forEach(loan => {
        const card = document.createElement('div');
        const hasActive = activeLoans.find(l => l.id === loan.id && !l.repaid);
        const canTake = !hasActive || godMode;
        card.className = `loan-card ${canTake ? '' : 'disabled'}`;
        card.innerHTML = `<div class="loan-info"><h3>${loan.name}</h3><p>${loan.description}</p><div class="loan-details"><span>Amount: <b>${formatCurrency(loan.amount)}</b></span><span>Interest: <b>${(loan.interestRate * 100).toFixed(0)}%</b></span><span>Duration: <b>${loan.durationSec}s</b></span></div></div><div class="loan-action"><div class="loan-total">Repay: ${formatCurrency(Math.round(loan.amount * (1 + loan.interestRate)))}</div><button class="action-btn loan-btn" ${!canTake ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>${hasActive ? 'Active' : 'Take Loan'}</button></div>`;
        if (canTake) card.querySelector('.loan-btn').addEventListener('click', () => takeLoan(loan));
        loansGrid.appendChild(card);
    });
}

function renderActiveLoans() {
    if (!activeLoansList || !activeLoansSection) return;
    activeLoansList.innerHTML = '';
    if (activeLoans.length === 0) { activeLoansSection.style.display = 'none'; return; }
    activeLoansSection.style.display = 'block';
    activeLoans.forEach(loan => {
        const el = document.createElement('div');
        el.className = 'active-loan-item';
        const canRepay = godMode || balance >= loan.remaining;
        el.innerHTML = `<div class="active-loan-info"><span class="loan-name">${loan.name}</span><span class="loan-timer">⏱ ${loan.elapsed}s / ${loan.durationSec}s</span><span class="loan-remaining">Owed: <b>${formatCurrency(loan.remaining)}</b></span></div><button class="action-btn repay-btn" ${!canRepay ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>Repay</button>`;
        el.querySelector('.repay-btn').addEventListener('click', () => repayLoan(loan.uid));
        activeLoansList.appendChild(el);
    });
}

function updateUI() {
    balanceEl.textContent = formatCurrency(balance);
    renderMarket();
    renderInvestments();
    renderLoans();
    renderStartups();
    renderActiveLoans();
    renderInventory();
    renderPortfolio();
    renderChat();
    checkDiamondRedirect();
    setTimeout(checkGameOver, 100);
}

function switchView(viewName) {
    Object.values(views).forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });
    
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
        views[viewName].classList.add('active');
    }
}

function resetGame() {
    balance = 500;
    inventory = [];
    portfolio = {};
    passiveIncomePerSec = 0;
    activeLoans = [];
    startups = [];
    startupPortfolio = {};
    chatLog = [];
    godMode = false;
    cpsMultiplier = 1;
    hasRedirected = false;
    if (incomeInterval) { clearInterval(incomeInterval); incomeInterval = null; }
    if (loanTimerInterval) { clearInterval(loanTimerInterval); loanTimerInterval = null; }
    if (bankruptCheckInterval) { clearInterval(bankruptCheckInterval); bankruptCheckInterval = null; }
    updateUI();
    addChatMessage('System', 'Game reset.', true);
}

function toggleAdminPanel() {
    if (!adminPanel) return;
    adminPanel.classList.toggle('hidden');
}

function highRiskTrade() {
    const input = document.getElementById('trade-amount');
    const resultEl = document.getElementById('trade-result');
    if (!input || !resultEl) return;
    const amount = parseInt(input.value);
    if (isNaN(amount) || amount <= 0) {
        resultEl.textContent = 'Enter a valid amount.';
        resultEl.style.color = '#ff4757';
        return;
    }
    if (balance < amount) {
        resultEl.textContent = 'Insufficient funds!';
        resultEl.style.color = '#ff4757';
        return;
    }
    updateBalance(-amount, false);
    const win = Math.random() < 0.45;
    if (win) {
        const multiplier = Math.random() * 2 + 1.5;
        const winnings = Math.round(amount * multiplier);
        updateBalance(winnings);
        resultEl.textContent = `🎉 WIN! Traded ${formatCurrency(amount)} for ${formatCurrency(winnings)}!`;
        resultEl.style.color = '#00ff9d';
    } else {
        resultEl.textContent = `💥 LOSS! Lost ${formatCurrency(amount)}.`;
        resultEl.style.color = '#ff4757';
    }
    updateUI();
    saveGame();
}

let loanTimerInterval = null;
function startLoanTimer() {
    if (loanTimerInterval) clearInterval(loanTimerInterval);
    loanTimerInterval = setInterval(() => {
        if (views.game && views.game.classList.contains('active')) {
            renderActiveLoans();
        }
    }, 1000);
}

let bankruptCheckInterval = null;
function startBankruptCheck() {
    if (bankruptCheckInterval) clearInterval(bankruptCheckInterval);
    bankruptCheckInterval = setInterval(() => {
        if (views.game && views.game.classList.contains('active')) {
            checkGameOver();
        }
    }, 2000);
}

// Update Leak Modal Logic
let leakTimer = null;
const leakModal = document.getElementById('update-leak-modal');
const btnCloseLeak = document.getElementById('btn-close-leak');

function showUpdateLeak() {
    if (!leakModal) return;
    leakModal.classList.remove('hidden');
    leakModal.style.display = 'flex';
    console.log('[Update Leak] Modal shown!');
}

function hideUpdateLeak() {
    if (!leakModal) return;
    leakModal.classList.add('hidden');
    leakModal.style.display = 'none';
    console.log('[Update Leak] Modal hidden.');
}

function startLeakTimer() {
    if (leakTimer) clearTimeout(leakTimer);
    console.log('[Update Leak] Timer started — modal will appear in 3 seconds...');
    leakTimer = setTimeout(() => {
        showUpdateLeak();
    }, 3000);
}

function clearLeakTimer() {
    if (leakTimer) {
        clearTimeout(leakTimer);
        leakTimer = null;
    }
    hideUpdateLeak();
}

if (btnCloseLeak) {
    btnCloseLeak.addEventListener('click', hideUpdateLeak);
}

// Credits Modal Logic
const creditsModal = document.getElementById('credits-modal');
const btnCloseCredits = document.getElementById('btn-close-credits');

function showCredits() {
    if (!creditsModal) return;
    creditsModal.classList.remove('hidden');
    creditsModal.style.display = 'flex';
}

function hideCredits() {
    if (!creditsModal) return;
    creditsModal.classList.add('hidden');
    creditsModal.style.display = 'none';
}

if (btnCloseCredits) {
    btnCloseCredits.addEventListener('click', hideCredits);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (leakModal && !leakModal.classList.contains('hidden')) {
            hideUpdateLeak();
        }
        if (creditsModal && !creditsModal.classList.contains('hidden')) {
            hideCredits();
        }
    }
});

// Event Listeners
const btnPlay = document.getElementById('btn-play');
if (btnPlay) btnPlay.addEventListener('click', () => {
    switchView('game');
    startLeakTimer();
});

const btnRetry = document.getElementById('btn-retry');
if (btnRetry) btnRetry.addEventListener('click', () => { resetGame(); clearLeakTimer(); switchView('game'); startLeakTimer(); });

const btnRestart = document.getElementById('btn-restart');
if (btnRestart) btnRestart.addEventListener('click', () => {
    clearLeakTimer();
    switchView('start');
});

const btnTrade = document.getElementById('btn-trade');
if (btnTrade) btnTrade.addEventListener('click', highRiskTrade);

const btnCreateStartup = document.getElementById('btn-create-startup');
const startupNameInput = document.getElementById('startup-name-input');
if (btnCreateStartup && startupNameInput) {
    btnCreateStartup.addEventListener('click', () => {
        const name = startupNameInput.value.trim();
        if (name) { createStartup(name); startupNameInput.value = ''; }
    });
}

if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}
if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);

document.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        toggleAdminPanel();
    }
});

const btnAdminSet = document.getElementById('btn-admin-set');
const btnAdminAdd = document.getElementById('btn-admin-add');
const btnAdminSub = document.getElementById('btn-admin-sub');
const adminRobuxInput = document.getElementById('admin-robux');

if (btnAdminSet && adminRobuxInput) {
    btnAdminSet.addEventListener('click', () => {
        const val = parseInt(adminRobuxInput.value);
        if (!isNaN(val) && val >= 0) { balance = val; updateUI(); saveGame(); }
    });
}
if (btnAdminAdd && adminRobuxInput) {
    btnAdminAdd.addEventListener('click', () => {
        const val = parseInt(adminRobuxInput.value);
        if (!isNaN(val)) { adminAddFunds(val); }
    });
}
if (btnAdminSub && adminRobuxInput) {
    btnAdminSub.addEventListener('click', () => {
        const val = parseInt(adminRobuxInput.value);
        if (!isNaN(val)) { updateBalance(-val); updateUI(); saveGame(); }
    });
}

const btnAdminGiveItem = document.getElementById('btn-admin-give-item');
const adminItemSelect = document.getElementById('admin-item-select');
if (btnAdminGiveItem && adminItemSelect) {
    btnAdminGiveItem.addEventListener('click', () => adminGiveItem(adminItemSelect.value));
}

const btnAdminGiveInvest = document.getElementById('btn-admin-give-invest');
const adminInvestSelect = document.getElementById('admin-invest-select');
if (btnAdminGiveInvest && adminInvestSelect) {
    btnAdminGiveInvest.addEventListener('click', () => adminGiveInvestment(adminInvestSelect.value));
}

const btnAdminMultiplier = document.getElementById('btn-admin-multiplier');
const adminMultiplierInput = document.getElementById('admin-multiplier');
if (btnAdminMultiplier && adminMultiplierInput) {
    btnAdminMultiplier.addEventListener('click', () => {
        const val = parseFloat(adminMultiplierInput.value);
        if (!isNaN(val)) adminSetMultiplier(val);
    });
}

const btnAdminGod = document.getElementById('btn-admin-god');
if (btnAdminGod) btnAdminGod.addEventListener('click', toggleGodMode);

const btnAdminReset = document.getElementById('btn-admin-reset');
if (btnAdminReset) btnAdminReset.addEventListener('click', () => { resetGame(); switchView('start'); });

const btnAdminCmd = document.getElementById('btn-admin-cmd');
const adminCmdInput = document.getElementById('admin-cmd-input');
if (btnAdminCmd && adminCmdInput) {
    btnAdminCmd.addEventListener('click', () => {
        const text = adminCmdInput.value.trim();
        if (text) { processAdminCommand(text); adminCmdInput.value = ''; }
    });
}

const btnAdminClose = document.getElementById('btn-admin-close');
if (btnAdminClose) btnAdminClose.addEventListener('click', toggleAdminPanel);

// Start the game
init();
    