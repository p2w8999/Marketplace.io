
/**
 * ROBUX MARKETPLACE TYCOON - CORE ENGINE
 * Refactored for performance, stability, and security.
 */

// --- 1. STATE MANAGEMENT ---
const State = {
    version: '1.2.0',
    balance: 500,
    inventory: [],
    portfolio: {},
    passiveIncomePerSec: 0,
    activeLoans: [],
    startups: [],
    startupPortfolio: {},
    godMode: false,
    cpsMultiplier: 1,
    activeEvent: null,
    cryptoWalletName: null,
    myCoin: null,
    cryptos: [
        { id: 'btc', name: 'Bitcoin', ticker: 'BTC', price: 50000, history: [50000], volatility: 0.05 },
        { id: 'eth', name: 'Ethereum', ticker: 'ETH', price: 3000, history: [3000], volatility: 0.06 },
        { id: 'doge', name: 'Dogecoin', ticker: 'DOGE', price: 100, history: [100], volatility: 0.15 },
        { id: 'rbx', name: 'RobuxCoin', ticker: 'RBX', price: 500, history: [500], volatility: 0.08 }
    ],
    cryptoPortfolio: {},
    chatLog: [],
    activeAuctions: [],
    mutatedItems: []
};

// Ephemeral runtime state
const Runtime = {
    intervals: {},
    isInitialized: false,
    isAdminAuthenticated: false,
    isPaused: false,
    transactionLock: false,
    lastChatTime: 0,
    saveTimeout: null,
    bankruptGraceTimer: 0
};

// --- 2. CONFIG & DOM ---
const Config = {
    MAX_INVENTORY: 100,
    MAX_CHAT: 50,
    CHAT_COOLDOWN: 1500,
    MAX_LOAN_CAP: 5,
    MAX_CRYPTO_PRICE: 1000000000,
    MIN_CRYPTO_PRICE: 1,
    DIAMOND_THRESHOLD: 1_000_000_000,
    BAG_THRESHOLD: 10_000_000_000
};

const DOM = {
    views: {
        start: document.getElementById('start-screen'),
        game: document.getElementById('game-screen'),
        gameOver: document.getElementById('game-over-screen')
    },
    adminPanel: document.getElementById('admin-panel'),
    balanceEl: document.getElementById('player-balance'),
    cpsEl: document.getElementById('passive-income-display'),
    grids: {
        market: document.getElementById('market-grid'),
        investments: document.getElementById('investments-grid'),
        inventory: document.getElementById('inventory-grid'),
        loans: document.getElementById('loans-grid'),
        activeLoans: document.getElementById('active-loans-list'),
        startups: document.getElementById('startups-grid'),
        cryptos: document.getElementById('cryptos-grid'),
        auctions: document.getElementById('auctions-container')
    },
    lists: {
        portfolio: document.getElementById('portfolio-list'),
        startupPortfolio: document.getElementById('startup-portfolio-list')
    },
    misc: {
        emptyInvMsg: document.getElementById('empty-inventory-msg'),
        activeLoansSection: document.getElementById('active-loans-section'),
        chatContainer: document.getElementById('chat-container')
    }
};

// Loan Data
const loansData = [
    { id: 'small', name: 'Starter Loan', amount: 1000, interestRate: 0.05, durationSec: 60, description: 'Small loan.' },
    { id: 'medium', name: 'Business Loan', amount: 10000, interestRate: 0.10, durationSec: 120, description: 'For growing traders.' },
    { id: 'large', name: 'Corporate Loan', amount: 100000, interestRate: 0.15, durationSec: 180, description: 'High risk.' },
    { id: 'mega', name: 'Tycoon Loan', amount: 1000000, interestRate: 0.20, durationSec: 300, description: 'Tycoon ambitious.' },
    { id: 'divine', name: 'Divine Loan', amount: 100000000, interestRate: 0.25, durationSec: 600, description: 'From the gods.' }
];

// --- 3. UTILITIES ---
const Utils = {
    sanitizeHTML(str) {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },
    formatCurrency(amount) {
        if (!Number.isFinite(amount)) return 'R$ 0';
        if (amount >= Config.BAG_THRESHOLD) return `${(amount / Config.BAG_THRESHOLD).toLocaleString(undefined, { maximumFractionDigits: 2 })} 💰`;
        if (amount >= Config.DIAMOND_THRESHOLD) return `${(amount / Config.DIAMOND_THRESHOLD).toLocaleString(undefined, { maximumFractionDigits: 2 })} 💎`;
        return `R$ ${Math.round(amount).toLocaleString()}`;
    },
    createElement(tag, classes = [], innerHTML = '') {
        const el = document.createElement(tag);
        const validClasses = classes.filter(c => c && c.trim() !== '');
        if (validClasses.length) el.classList.add(...validClasses);
        if (innerHTML) el.innerHTML = innerHTML;
        return el;
    },
    clamp(val, min, max) {
        return Math.max(min, Math.min(val, max));
    }
};

// --- 4. SAVE SYSTEM ---
const SaveSystem = {
    save() {
        if (Runtime.saveTimeout) clearTimeout(Runtime.saveTimeout);
        Runtime.saveTimeout = setTimeout(() => {
            try {
                const dataStr = JSON.stringify(State);
                localStorage.setItem('antiAmazonTycoonSave', dataStr);
                localStorage.setItem('antiAmazonTycoonSave_backup', dataStr);
            } catch (e) {
                console.error("Save failed", e);
            }
        }, 1000);
    },
    load() {
        let raw = localStorage.getItem('antiAmazonTycoonSave');
        if (!raw) raw = localStorage.getItem('antiAmazonTycoonSave_backup');
        if (!raw) return false;

        try {
            const data = JSON.parse(raw);
            if (!data.version) return false;
            Object.assign(State, data);
            State.cryptos = data.cryptos || State.cryptos;
            State.balance = Number.isFinite(data.balance) ? data.balance : 500;
            return true;
        } catch (e) {
            console.error("Load failed, corrupted save", e);
            return false;
        }
    },
    hardReset() {
        if (confirm('Hard reset the entire game?')) {
            localStorage.removeItem('antiAmazonTycoonSave');
            localStorage.removeItem('antiAmazonTycoonSave_backup');
            location.reload();
        }
    }
};

// --- 5. UI CONTROLLER ---
const UI = {
    switchView(v) {
        Object.values(DOM.views).forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('active');
            }
        });
        if (DOM.views[v]) {
            DOM.views[v].classList.remove('hidden');
            DOM.views[v].classList.add('active');
        }
    },
    updateBalance(animate = true) {
        if (!DOM.balanceEl) return;
        DOM.balanceEl.textContent = Utils.formatCurrency(State.balance);
        if (animate) {
            DOM.balanceEl.classList.remove('pulse');
            void DOM.balanceEl.offsetWidth;
            DOM.balanceEl.classList.add('pulse');
        }
    },
    updateCPS() {
        if (DOM.cpsEl) DOM.cpsEl.textContent = `+${Utils.formatCurrency(State.passiveIncomePerSec * State.cpsMultiplier)} /sec`;
    },

    renderGrid(container, data, renderer) {
        if (!container) return;
        const frag = document.createDocumentFragment();
        data.forEach((item, index) => {
            const node = renderer(item, index);
            if (node) frag.appendChild(node);
        });
        container.innerHTML = '';
        container.appendChild(frag);
    },

    renderMarket() {
        UI.renderGrid(DOM.grids.market, itemsData, item => {
            let p = item.price;
            if (item.mutationMultiplier) p = Math.round(p * item.mutationMultiplier);
            const html = `
                ${item.image ? `<img src="${item.image}">` : `<div class="no-image">📦</div>`}
                <div class="item-name">${item.name}</div>
                <div class="item-price">${Utils.formatCurrency(p)}</div>
                <button class="action-btn buy-btn" data-action="buyItem" data-id="${item.id}" data-price="${p}">Buy</button>
            `;
            return Utils.createElement('div', ['item-card'], html);
        });
    },

    renderInvestments() {
        UI.renderGrid(DOM.grids.investments, investmentsData, inv => {
            return Utils.createElement('div', ['invest-card'], `
                <div class="invest-info">
                    <h3>${inv.name} (x${State.portfolio[inv.id] || 0})</h3>
                    <p>${inv.description}</p>
                    <div class="invest-cps">+${Utils.formatCurrency(inv.cps)}/s</div>
                </div>
                <div class="invest-action">
                    <div class="item-price">${Utils.formatCurrency(inv.price)}</div>
                    <button class="action-btn buy-btn" data-action="buyInvest" data-id="${inv.id}">Invest</button>
                </div>
            `);
        });
    },

    renderInventory() {
        if (!DOM.grids.inventory) return;
        if (State.inventory.length === 0) {
            DOM.misc.emptyInvMsg.classList.remove('hidden');
            DOM.grids.inventory.innerHTML = '';
            return;
        }
        DOM.misc.emptyInvMsg.classList.add('hidden');
        UI.renderGrid(DOM.grids.inventory, State.inventory, item => {
            return Utils.createElement('div', ['item-card'], `
                ${item.image ? `<img src="${item.image}">` : `<div class="no-image">📦</div>`}
                <div class="item-name">${item.name}</div>
                <div class="item-price">${Utils.formatCurrency(item.sellPrice)}</div>
                <button class="action-btn sell-btn" data-action="sellItem" data-id="${item.uid}">Sell</button>
            `);
        });
    },

    renderLoans() {
        UI.renderGrid(DOM.grids.loans, loansData, l => {
            const active = State.activeLoans.find(x => x.id === l.id);
            return Utils.createElement('div', ['loan-card', active ? 'disabled' : ''], `
                <div class="loan-info"><h3>${l.name}</h3><p>Borrow ${Utils.formatCurrency(l.amount)}</p></div>
                <button class="action-btn loan-btn" data-action="takeLoan" data-id="${l.id}" ${active ? 'disabled' : ''}>${active ? 'Active' : 'Take'}</button>
            `);
        });
    },

    renderActiveLoans() {
        if (!DOM.grids.activeLoans) return;
        if (State.activeLoans.length === 0) {
            DOM.misc.activeLoansSection.classList.add('hidden');
            return;
        }
        DOM.misc.activeLoansSection.classList.remove('hidden');
        UI.renderGrid(DOM.grids.activeLoans, State.activeLoans, l => {
            return Utils.createElement('div', ['active-loan-item'], `
                <span>${l.name}: Owed ${Utils.formatCurrency(l.remaining)}</span>
                <button class="action-btn repay-btn" data-action="repayLoan" data-id="${l.uid}">Repay</button>
            `);
        });
    },

    renderStartups() {
        UI.renderGrid(DOM.grids.startups, State.startups, s => {
            return Utils.createElement('div', ['startup-card'], `
                <div class="startup-header-flex">
                    <div class="startup-icon-box">🚀</div>
                    <div class="startup-info">
                        <h3>${s.name}</h3>
                        <span class="startup-tier">Venture</span>
                    </div>
                </div>
                <div class="startup-stats-grid">
                    <div class="stat-box"><span class="stat-label">Shares</span><span class="stat-value">${State.startupPortfolio[s.id] || 0}</span></div>
                    <div class="stat-box"><span class="stat-label">Div/Share</span><span class="stat-value text-green">+${Utils.formatCurrency(s.cpsPerShare)}/s</span></div>
                    <div class="stat-box"><span class="stat-label">Total Div</span><span class="stat-value text-green">+${Utils.formatCurrency(s.cpsPerShare * (State.startupPortfolio[s.id] || 0))}/s</span></div>
                </div>
                <div class="startup-action">
                    <div class="share-price-display">
                        <span class="price-label">Share Price</span>
                        <span class="price-value">${Utils.formatCurrency(s.sharePrice)}</span>
                    </div>
                    <button class="action-btn invest-btn" data-action="investStartup" data-id="${s.id}">Invest</button>
                </div>
            `);
        });
    },

    renderCryptos() {
        UI.renderGrid(DOM.grids.cryptos, State.cryptos, c => {
            const owned = State.cryptoPortfolio[c.id] || 0;
            return Utils.createElement('div', ['startup-card'], `
                <div class="startup-header-flex">
                    <div class="startup-icon-box crypto-icon">🪙</div>
                    <div class="startup-info">
                        <h3>${c.name} <span class="crypto-ticker">${c.ticker}</span></h3>
                        <span class="startup-tier crypto-tier">Token</span>
                    </div>
                </div>
                <div class="startup-stats-grid">
                    <div class="stat-box"><span class="stat-label">Owned</span><span class="stat-value">${owned}</span></div>
                    <div class="stat-box"><span class="stat-label">Value</span><span class="stat-value text-gold">${Utils.formatCurrency(c.price)}</span></div>
                    <div class="stat-box"><span class="stat-label">Total</span><span class="stat-value text-gold">${Utils.formatCurrency(c.price * owned)}</span></div>
                </div>
                <div class="startup-action">
                    <div class="startup-btns">
                        <button class="action-btn buy-btn" data-action="buyCrypto" data-id="${c.id}">Buy</button>
                        <button class="action-btn sell-btn" data-action="sellCrypto" data-id="${c.id}">Sell</button>
                    </div>
                </div>
            `);
        });
    },

    renderAuctions() {
        UI.renderGrid(DOM.grids.auctions, State.activeAuctions, (a, i) => {
            if (!a) return null;
            return Utils.createElement('div', ['item-card'], `
                <div class="item-name">${a.name}</div>
                <div class="item-price">${Utils.formatCurrency(a.price)}</div>
                <div class="auction-timer">${a.timeLeft}s</div>
                <button class="action-btn buy-btn" data-action="bidAuction" data-index="${i}">Bid</button>
            `);
        });
    },

    renderPortfolio() {
        if (!DOM.lists.portfolio) return;
        let html = investmentsData.filter(i => State.portfolio[i.id]).map(i => `<div class="portfolio-item"><span>${i.name} (x${State.portfolio[i.id]})</span><span>+${Utils.formatCurrency(i.cps * State.portfolio[i.id])}/s</span></div>`).join('');
        html += State.startups.filter(s => State.startupPortfolio[s.id]).map(s => `<div class="portfolio-item"><span>${s.name} (x${State.startupPortfolio[s.id]})</span><span>+${Utils.formatCurrency(s.cpsPerShare * State.startupPortfolio[s.id])}/s</span></div>`).join('');
        DOM.lists.portfolio.innerHTML = html || '<p>No assets yet.</p>';
    },

    renderAll() {
        this.updateBalance(false);
        this.updateCPS();
        this.renderMarket();
        this.renderInvestments();
        this.renderLoans();
        this.renderActiveLoans();
        this.renderInventory();
        this.renderStartups();
        this.renderCryptos();
        this.renderAuctions();
        this.renderPortfolio();
    }
};

// --- 6. CORE ECONOMY ---
const Economy = {
    updateBalance(amount, animate = true) {
        if (!Number.isFinite(amount) || Number.isNaN(amount)) return;
        State.balance += amount;
        State.balance = Math.max(0, State.balance);
        UI.updateBalance(animate);
    },

    buyItem(id, actualPrice) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const itemObj = itemsData.find(x => x.id === id);
        if (!itemObj) return (Runtime.transactionLock = false);

        const price = actualPrice || itemObj.price;
        if (price < 0) return (Runtime.transactionLock = false);

        if (State.inventory.length >= Config.MAX_INVENTORY) {
            Chat.addMessage('System', `Inventory full (${Config.MAX_INVENTORY} max).`, 'system');
            return (Runtime.transactionLock = false);
        }

        if (State.godMode || State.balance >= price) {
            if (!State.godMode) this.updateBalance(-price);
            const newItem = {
                ...itemObj,
                uid: Date.now() + Math.random().toString(),
                sellPrice: Math.round(itemObj.price * (Math.random() * 0.4 + 1.1))
            };
            State.inventory.push(newItem);
            UI.renderInventory();
            SaveSystem.save();
        } else {
            Chat.addMessage('System', `Insufficient balance to buy ${itemObj.name}.`, 'system');
        }
        Runtime.transactionLock = false;
    },

    sellItem(uid) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const idx = State.inventory.findIndex(i => i.uid === uid);
        if (idx !== -1) {
            const item = State.inventory[idx];
            let price = item.sellPrice;
            if (item.mutationMultiplier) price *= item.mutationMultiplier;
            this.updateBalance(price);
            State.inventory.splice(idx, 1);
            UI.renderInventory();
            SaveSystem.save();
        }
        Runtime.transactionLock = false;
    },

    buyInvest(id) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const inv = investmentsData.find(x => x.id === id);
        if (!inv || inv.price < 0) return (Runtime.transactionLock = false);

        if (State.godMode || State.balance >= inv.price) {
            if (!State.godMode) this.updateBalance(-inv.price);
            State.portfolio[inv.id] = (State.portfolio[inv.id] || 0) + 1;
            this.recalculatePassiveIncome();
            UI.renderInvestments();
            UI.renderPortfolio();
            SaveSystem.save();
        } else {
            Chat.addMessage('System', `Insufficient balance for ${inv.name}.`, 'system');
        }
        Runtime.transactionLock = false;
    },

    recalculatePassiveIncome() {
        State.passiveIncomePerSec = 0;
        investmentsData.forEach(inv => {
            if (State.portfolio[inv.id]) State.passiveIncomePerSec += inv.cps * State.portfolio[inv.id];
        });
        State.startups.forEach(s => {
            if (State.startupPortfolio[s.id]) State.passiveIncomePerSec += s.cpsPerShare * State.startupPortfolio[s.id];
        });

        UI.updateCPS();
        this.manageIncomeInterval();
    },

    manageIncomeInterval() {
        if (Runtime.intervals.income) {
            clearInterval(Runtime.intervals.income);
            Runtime.intervals.income = null;
        }

        if (State.passiveIncomePerSec > 0 || State.activeLoans.length > 0) {
            Runtime.intervals.income = setInterval(() => {
                if (Runtime.isPaused) return;

                if (DOM.views.game.classList.contains('active')) {
                    Loans.process();
                    if (State.passiveIncomePerSec > 0) {
                        this.updateBalance(State.passiveIncomePerSec * State.cpsMultiplier, false);
                    }
                    UI.renderActiveLoans();
                }

                if (State.passiveIncomePerSec === 0 && State.activeLoans.length === 0) {
                    clearInterval(Runtime.intervals.income);
                    Runtime.intervals.income = null;
                }
            }, 1000);
        }
    },

    checkGameOver() {
        if (State.godMode) return;
        const cheapest = itemsData && itemsData.length > 0 ? Math.min(...itemsData.map(i => i.price)) : 0;

        if (State.balance < cheapest && State.inventory.length === 0 && State.passiveIncomePerSec === 0 && State.activeLoans.length === 0) {
            Runtime.bankruptGraceTimer++;
            if (Runtime.bankruptGraceTimer > 3) UI.switchView('gameOver');
        } else {
            Runtime.bankruptGraceTimer = 0;
        }
    }
};

// --- 7. LOANS ---
const Loans = {
    take(id) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const loan = loansData.find(x => x.id === id);
        if (!loan) return (Runtime.transactionLock = false);

        if (State.activeLoans.length >= Config.MAX_LOAN_CAP) {
            Chat.addMessage('System', `Max active loans reached (${Config.MAX_LOAN_CAP}).`, 'system');
            return (Runtime.transactionLock = false);
        }

        if (State.activeLoans.find(l => l.id === loan.id) && !State.godMode) {
            Chat.addMessage('System', `You already have an active ${loan.name}.`, 'system');
            return (Runtime.transactionLock = false);
        }

        const total = Math.round(loan.amount * (1 + loan.interestRate));
        State.activeLoans.push({ ...loan, uid: Date.now() + Math.random(), remaining: total, elapsed: 0 });
        Economy.updateBalance(loan.amount);
        Economy.recalculatePassiveIncome();
        UI.renderLoans();
        UI.renderActiveLoans();
        SaveSystem.save();
        Runtime.transactionLock = false;
    },

    repay(uid) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const idx = State.activeLoans.findIndex(l => l.uid === uid);
        if (idx === -1) return (Runtime.transactionLock = false);
        const l = State.activeLoans[idx];

        if (State.godMode || State.balance >= l.remaining) {
            if (!State.godMode) Economy.updateBalance(-l.remaining);
            State.activeLoans.splice(idx, 1);
            Economy.recalculatePassiveIncome();
            UI.renderLoans();
            UI.renderActiveLoans();
            SaveSystem.save();
        } else {
            Chat.addMessage('System', 'Insufficient balance to repay loan.', 'system');
        }
        Runtime.transactionLock = false;
    },

    process() {
        let changed = false;
        State.activeLoans.forEach(l => {
            l.elapsed++;
            if (l.elapsed >= l.durationSec) {
                const maxRemaining = l.amount * 5;
                if (l.remaining < maxRemaining) {
                    l.remaining = Math.min(Math.round(l.remaining * 1.2), maxRemaining);
                    Chat.addMessage('System', `⚠️ Loan ${l.name} overdue! Interest increased.`, 'system');
                    changed = true;
                }
                l.elapsed = 0;
            }
        });
        if (changed) SaveSystem.save();
    }
};

// --- 8. STARTUPS & CRYPTO ---
const Markets = {
    createStartup(name) {
        if (!name) return;
        const safeName = Utils.sanitizeHTML(name);
        State.startups.push({ id: 's_' + Date.now(), name: safeName, totalInvested: 0, sharePrice: 1000, cpsPerShare: 5 });
        Chat.addMessage('System', `🚀 Startup "${safeName}" founded!`, 'system');
        UI.renderStartups();
        SaveSystem.save();
    },

    investStartup(id) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const s = State.startups.find(x => x.id === id);
        if (!s || (!State.godMode && State.balance < s.sharePrice)) {
            Chat.addMessage('System', `Insufficient balance.`, 'system');
            return (Runtime.transactionLock = false);
        }

        if (!State.godMode) Economy.updateBalance(-s.sharePrice);
        State.startupPortfolio[id] = (State.startupPortfolio[id] || 0) + 1;

        s.sharePrice = Math.round(s.sharePrice * 1.05);
        s.cpsPerShare = Math.round(s.cpsPerShare * 1.02);

        Economy.recalculatePassiveIncome();
        UI.renderStartups();
        UI.renderPortfolio();
        SaveSystem.save();
        Runtime.transactionLock = false;
    },

    startCrypto() {
        if (Runtime.intervals.crypto) clearInterval(Runtime.intervals.crypto);
        Runtime.intervals.crypto = setInterval(() => {
            if (Runtime.isPaused) return;
            State.cryptos.forEach(c => {
                const change = (Math.random() * 0.2 - 0.1) * c.volatility;
                c.price = Utils.clamp(Math.round(c.price * (1 + change)), Config.MIN_CRYPTO_PRICE, Config.MAX_CRYPTO_PRICE);
            });
            if (document.getElementById('crypto-tab')?.classList.contains('active')) UI.renderCryptos();
        }, 3000);
    },

    buyCrypto(id) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const c = State.cryptos.find(x => x.id === id);
        if (c && (State.godMode || State.balance >= c.price)) {
            if (!State.godMode) Economy.updateBalance(-c.price);
            State.cryptoPortfolio[id] = (State.cryptoPortfolio[id] || 0) + 1;
            UI.renderCryptos();
            SaveSystem.save();
        } else {
            Chat.addMessage('System', 'Insufficient balance.', 'system');
        }
        Runtime.transactionLock = false;
    },

    sellCrypto(id) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const c = State.cryptos.find(x => x.id === id);
        if (c && State.cryptoPortfolio[id] > 0) {
            State.cryptoPortfolio[id]--;
            Economy.updateBalance(c.price);
            UI.renderCryptos();
            SaveSystem.save();
        }
        Runtime.transactionLock = false;
    }
};

// --- 9. AUCTIONS ---
const Auctions = {
    start() {
        if (State.activeAuctions.length === 0) {
            State.activeAuctions = Array.from({ length: 5 }, () => this.generateItem());
        }
        if (Runtime.intervals.auction) clearInterval(Runtime.intervals.auction);
        Runtime.intervals.auction = setInterval(() => {
            if (Runtime.isPaused) return;
            let changed = false;
            State.activeAuctions.forEach((a, i) => {
                if (a) {
                    a.timeLeft--;
                    if (a.timeLeft <= 0) {
                        State.activeAuctions[i] = this.generateItem();
                        changed = true;
                    }
                }
            });
            if (document.getElementById('auction-tab')?.classList.contains('active')) UI.renderAuctions();
        }, 1000);
    },

    generateItem() {
        const item = itemsData[Math.floor(Math.random() * itemsData.length)];
        return { ...item, timeLeft: 15 + Math.floor(Math.random() * 15), price: Math.round(item.price * 0.7) };
    },

    bid(index) {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const a = State.activeAuctions[index];
        if (!a) return (Runtime.transactionLock = false);

        if (State.inventory.length >= Config.MAX_INVENTORY) {
            Chat.addMessage('System', 'Inventory full.', 'system');
            return (Runtime.transactionLock = false);
        }

        if (State.balance >= a.price) {
            Economy.updateBalance(-a.price);
            State.inventory.push({ ...a, uid: Date.now() + Math.random(), sellPrice: Math.round(a.price * 1.5) });
            State.activeAuctions[index] = this.generateItem();
            UI.renderAuctions();
            UI.renderInventory();
            SaveSystem.save();
        } else {
            Chat.addMessage('System', 'Insufficient balance for bid.', 'system');
        }
        Runtime.transactionLock = false;
    }
};

// --- 10. CHAT & EVENTS ---
const Chat = {
    addMessage(sender, message, type = 'normal') {
        const now = Date.now();
        if (type === 'normal' && now - Runtime.lastChatTime < Config.CHAT_COOLDOWN) return;
        if (type === 'normal') Runtime.lastChatTime = now;

        const safeSender = Utils.sanitizeHTML(sender);
        const safeMessage = Utils.sanitizeHTML(message).substring(0, 200);

        State.chatLog.push({ sender: safeSender, message: safeMessage, type, time: new Date().toLocaleTimeString() });
        if (State.chatLog.length > Config.MAX_CHAT) State.chatLog.shift();
        this.render();
        SaveSystem.save();
    },

    render() {
        if (!DOM.misc.chatContainer) return;
        const frag = document.createDocumentFragment();
        State.chatLog.forEach(m => {
            if (m.type === 'announcement') {
                frag.appendChild(Utils.createElement('div', ['chat-announcement'], `
                    <span>${m.sender}</span>
                    <div class="roblox-verified-badge"><div class="badge-square"></div><div class="badge-check"></div></div>
                    <span class="announcement-colon">:</span>
                    <span class="announce-msg">${m.message}</span>
                `));
            } else {
                const isSystem = m.type === 'system';
                frag.appendChild(Utils.createElement('div', ['chat-message', isSystem ? 'chat-system' : ''], `<b>${m.sender}:</b> ${m.message}`));
            }
        });
        DOM.misc.chatContainer.innerHTML = '';
        DOM.misc.chatContainer.appendChild(frag);
        DOM.misc.chatContainer.scrollTop = DOM.misc.chatContainer.scrollHeight;
    },

    send() {
        const input = document.getElementById('chat-input');
        const msg = input.value.trim();
        if (!msg) return;

        if (msg.startsWith('/')) {
            const parts = msg.split(' ');
            const cmd = parts[0].toLowerCase();
            if (cmd === '/credits') {
                document.getElementById('credits-modal').classList.remove('hidden');
                this.addMessage('System', 'Opening credits...', 'system');
            } else if (cmd === '/pm' && Runtime.isAdminAuthenticated) {
                const name = parts[1] || 'ADMIN';
                const announcement = parts.slice(2).join(' ');
                if (announcement) Events.showGlobalAnnouncement(name, announcement);
            } else {
                this.addMessage('System', `Unknown: ${Utils.sanitizeHTML(cmd)}`, 'system');
            }
        } else {
            this.addMessage('You', msg);
        }
        input.value = '';
    }
};

const Events = {
    showGlobalAnnouncement(name, message) {
        const overlay = document.getElementById('announcement-overlay');
        const nameEl = document.getElementById('announce-name');
        const msgEl = document.getElementById('announce-msg-body');
        if (!overlay || !nameEl || !msgEl) return;

        nameEl.textContent = Utils.sanitizeHTML(name);
        msgEl.textContent = Utils.sanitizeHTML(message);
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('hidden'), 5000);
        Chat.addMessage(name, message, 'announcement');
    },

    applyGlobalEvent(name) {
        if (State.activeEvent) document.body.classList.remove(`theme-${State.activeEvent}`);
        itemsData.forEach(i => delete i.mutationMultiplier);
        State.activeEvent = name;
        if (name) {
            document.body.classList.add(`theme-${name}`);
            const mult = (Math.random() * 2 + 1.5).toFixed(1);
            itemsData.forEach(i => i.mutationMultiplier = mult);
            const banner = document.getElementById('event-banner');
            if (banner) {
                document.getElementById('event-title').textContent = name.toUpperCase();
                banner.classList.add('show');
                setTimeout(() => banner.classList.remove('show'), 3000);
            }
        }
        UI.renderMarket();
    }
};

// --- 11. ADMIN ---
const Admin = {
    verify() {
        const e = document.getElementById('admin-email').value;
        const p = document.getElementById('admin-password').value;
        const errorEl = document.getElementById('login-error');

        // Mock Auth
        if (e === 'P2w8999@gmail.com' && p === 'root1234') {
            Runtime.isAdminAuthenticated = true;
            document.getElementById('admin-login-modal').classList.add('hidden');
            if (DOM.adminPanel) DOM.adminPanel.classList.remove('hidden');
            document.getElementById('admin-badge').classList.remove('hidden');
            if (errorEl) errorEl.textContent = '';
            Chat.addMessage('System', 'Admin access granted. (Mock Mode)', 'system');
        } else {
            if (errorEl) {
                errorEl.textContent = 'Invalid credentials. Try admin/admin';
                errorEl.classList.add('shake');
                setTimeout(() => errorEl.classList.remove('shake'), 400);
            }
        }
    },
    populateDropdowns() {
        const iSel = document.getElementById('admin-item-select');
        const vSel = document.getElementById('admin-invest-select');
        if (iSel) {
            const frag = document.createDocumentFragment();
            itemsData.forEach(i => frag.appendChild(Utils.createElement('option', [], i.name)).value = i.id);
            iSel.appendChild(frag);
        }
        if (vSel) {
            const frag = document.createDocumentFragment();
            investmentsData.forEach(i => frag.appendChild(Utils.createElement('option', [], i.name)).value = i.id);
            vSel.appendChild(frag);
        }
    }
};

// --- 12. INITIALIZATION & EVENTS ---
function init() {
    if (Runtime.isInitialized) return;
    Runtime.isInitialized = true;

    SaveSystem.load();
    UI.renderAll();
    Admin.populateDropdowns();
    Chat.render();
    Economy.recalculatePassiveIncome();
    Markets.startCrypto();
    Auctions.start();

    if (Runtime.intervals.bankrupt) clearInterval(Runtime.intervals.bankrupt);
    Runtime.intervals.bankrupt = setInterval(() => {
        if (!Runtime.isPaused) Economy.checkGameOver();
    }, 3000);

    if (State.activeEvent) Events.applyGlobalEvent(State.activeEvent);
    Chat.addMessage('System', '🎮 Welcome to Marketplace Tycoon!', 'system');
}

function cleanupGame() {
    Object.values(Runtime.intervals).forEach(i => { if (i) clearInterval(i); });
    if (Runtime.saveTimeout) clearTimeout(Runtime.saveTimeout);
    Runtime.intervals = {};
    Runtime.isInitialized = false;
}

function setupGlobalListeners() {
    document.addEventListener('visibilitychange', () => { Runtime.isPaused = document.hidden; });

    document.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const index = btn.dataset.index;
        const price = btn.dataset.price ? parseInt(btn.dataset.price) : null;

        switch (action) {
            case 'buyItem': Economy.buyItem(id, price); break;
            case 'buyInvest': Economy.buyInvest(id); break;
            case 'sellItem': Economy.sellItem(id); break;
            case 'takeLoan': Loans.take(id); break;
            case 'repayLoan': Loans.repay(id); break;
            case 'investStartup': Markets.investStartup(id); break;
            case 'buyCrypto': Markets.buyCrypto(id); break;
            case 'sellCrypto': Markets.sellCrypto(id); break;
            case 'bidAuction': Auctions.bid(parseInt(index)); break;
        }
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
        });
    });

    document.getElementById('btn-play')?.addEventListener('click', () => { UI.switchView('game'); init(); });
    document.getElementById('btn-restart')?.addEventListener('click', () => SaveSystem.hardReset());
    document.getElementById('btn-retry')?.addEventListener('click', () => SaveSystem.hardReset());

    document.getElementById('btn-do-login')?.addEventListener('click', Admin.verify);
    document.getElementById('btn-cancel-login')?.addEventListener('click', () => document.getElementById('admin-login-modal').classList.add('hidden'));
    document.getElementById('btn-admin-close')?.addEventListener('click', () => DOM.adminPanel.classList.add('hidden'));

    document.getElementById('btn-admin-set')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; Economy.updateBalance((parseInt(document.getElementById('admin-robux').value) || 0) - State.balance); SaveSystem.save(); });
    document.getElementById('btn-admin-add')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; Economy.updateBalance(parseInt(document.getElementById('admin-robux').value) || 0); SaveSystem.save(); });
    document.getElementById('btn-admin-sub')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; Economy.updateBalance(-(parseInt(document.getElementById('admin-robux').value) || 0)); SaveSystem.save(); });
    document.getElementById('btn-admin-give-item')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; Economy.buyItem(document.getElementById('admin-item-select').value, 0); SaveSystem.save(); });
    document.getElementById('btn-admin-give-invest')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; Economy.buyInvest(document.getElementById('admin-invest-select').value); SaveSystem.save(); });
    document.getElementById('btn-admin-god')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; State.godMode = !State.godMode; Chat.addMessage('System', `God Mode: ${State.godMode ? 'ON' : 'OFF'}`, 'system'); SaveSystem.save(); });
    document.getElementById('btn-trigger-event')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; Events.applyGlobalEvent(document.getElementById('admin-event-select').value); SaveSystem.save(); });
    document.getElementById('btn-event-clear')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; Events.applyGlobalEvent(null); SaveSystem.save(); });
    document.getElementById('btn-event-mutate')?.addEventListener('click', () => {
        if (!Runtime.isAdminAuthenticated || !State.activeEvent) return;
        itemsData.forEach(i => i.mutationMultiplier = (Math.random() * 5 + 1).toFixed(1));
        UI.renderMarket();
        SaveSystem.save();
        Chat.addMessage('System', 'Event items mutated!', 'system');
    });
    document.getElementById('btn-admin-multiplier')?.addEventListener('click', () => {
        if (!Runtime.isAdminAuthenticated) return;
        const val = parseFloat(document.getElementById('admin-multiplier').value);
        if (!isNaN(val) && val > 0) State.cpsMultiplier = val;
        Economy.recalculatePassiveIncome();
        SaveSystem.save();
        Chat.addMessage('System', `CPS Multiplier set to ${State.cpsMultiplier}x`, 'system');
    });
    document.getElementById('btn-admin-reset')?.addEventListener('click', () => { if (!Runtime.isAdminAuthenticated) return; SaveSystem.hardReset(); });
    document.getElementById('btn-admin-cmd')?.addEventListener('click', () => {
        if (!Runtime.isAdminAuthenticated) return;
        const cmd = document.getElementById('admin-cmd-input').value.trim();
        if (cmd) Chat.addMessage('System', `Executed command: ${Utils.sanitizeHTML(cmd)}`, 'system');
    });

    document.getElementById('chat-send-btn')?.addEventListener('click', () => Chat.send());
    document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') Chat.send(); });

    document.getElementById('btn-create-wallet')?.addEventListener('click', () => {
        const name = document.getElementById('crypto-acc-input').value;
        if (!name) return;
        State.cryptoWalletName = Utils.sanitizeHTML(name);
        document.getElementById('crypto-setup-section').classList.add('hidden');
        document.getElementById('crypto-launch-section').classList.remove('hidden');
        document.getElementById('crypto-wallet-name-display').textContent = `Wallet: ${State.cryptoWalletName}`;
        SaveSystem.save();
    });

    document.getElementById('btn-launch-coin')?.addEventListener('click', () => {
        if (State.myCoin) return Chat.addMessage('System', 'You can only launch one custom coin.', 'system');
        const ticker = document.getElementById('crypto-coin-input').value;
        if (!ticker) return;
        if (State.balance < 10000 && !State.godMode) return Chat.addMessage('System', 'You need R$ 10,000.', 'system');

        if (!State.godMode) Economy.updateBalance(-10000);
        const safeTicker = Utils.sanitizeHTML(ticker).toUpperCase();
        const newCoin = { id: 'user_' + Date.now(), name: safeTicker + ' Coin', ticker: safeTicker, price: 100, history: [100], volatility: 0.2 };
        State.cryptos.push(newCoin);
        State.myCoin = newCoin;
        State.cryptoPortfolio[newCoin.id] = 100;
        document.getElementById('crypto-launch-section').classList.add('hidden');
        Chat.addMessage('System', `🚀 Launched ${newCoin.ticker}!`, 'system');
        UI.renderCryptos();
        SaveSystem.save();
    });

    document.getElementById('btn-create-startup')?.addEventListener('click', () => {
        const input = document.getElementById('startup-name-input');
        if (input && input.value) { Markets.createStartup(input.value); input.value = ''; }
    });

    document.addEventListener('keydown', e => {
        if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            if (Runtime.isAdminAuthenticated) {
                if (DOM.adminPanel) DOM.adminPanel.classList.toggle('hidden');
            } else {
                const loginModal = document.getElementById('admin-login-modal');
                if (loginModal) loginModal.classList.toggle('hidden');
            }
        }
    });

    document.getElementById('btn-close-credits')?.addEventListener('click', () => {
        document.getElementById('credits-modal').classList.add('hidden');
    });

    document.getElementById('btn-trade')?.addEventListener('click', () => {
        if (Runtime.transactionLock) return;
        Runtime.transactionLock = true;

        const input = document.getElementById('trade-amount');
        const result = document.getElementById('trade-result');
        const amt = parseInt(input.value);

        if (!amt || amt <= 0 || amt > State.balance) {
            if (result) {
                result.textContent = 'Invalid amount or insufficient balance.';
                result.className = 'trade-status text-red';
            }
            Runtime.transactionLock = false;
            return;
        }

        Economy.updateBalance(-amt, false);
        const win = Math.random() > 0.5;

        if (win) {
            const wonAmt = amt * 2;
            Economy.updateBalance(wonAmt);
            if (result) {
                result.textContent = `Won ${Utils.formatCurrency(wonAmt)}!`;
                result.className = 'trade-status text-green';
            }
        } else {
            Economy.updateBalance(0); // Trigger update UI
            if (result) {
                result.textContent = `Lost ${Utils.formatCurrency(amt)}...`;
                result.className = 'trade-status text-red';
            }
        }

        SaveSystem.save();
        Runtime.transactionLock = false;
    });

    const chatPanel = document.querySelector('.chat-panel');
    const chatHeader = document.querySelector('.chat-header');
    if (chatPanel && chatHeader) {
        let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

        const startDrag = (e) => {
            isDragging = true;
            chatHeader.style.cursor = 'grabbing';
            const rect = chatPanel.getBoundingClientRect();
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            dragOffsetX = clientX - rect.left;
            dragOffsetY = clientY - rect.top;
            e.preventDefault();
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            let newX = clientX - dragOffsetX;
            let newY = clientY - dragOffsetY;

            newX = Utils.clamp(newX, 0, window.innerWidth - chatPanel.offsetWidth);
            newY = Utils.clamp(newY, 0, window.innerHeight - chatPanel.offsetHeight);

            chatPanel.style.left = `${newX}px`;
            chatPanel.style.top = `${newY}px`;
            chatPanel.style.bottom = 'auto';
            chatPanel.style.right = 'auto';
        };

        const stopDrag = () => { if (isDragging) { isDragging = false; chatHeader.style.cursor = 'grab'; } };

        chatHeader.style.cursor = 'grab';
        chatHeader.addEventListener('mousedown', startDrag);
        chatHeader.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);
    }
}

setupGlobalListeners();
UI.switchView('start');
