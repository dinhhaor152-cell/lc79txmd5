// ============================================================================
// VI LONG SUPER AI - SERVER V10.5 (MASTER STABLE - FIXED ALL BUGS)
// ============================================================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const {
    deepAnalysisAdaptive,
    trackAdaptiveResult,
    getAdaptiveSnapshot,
    CAPITAL,
    updateLogicPerformance,
    logicPerformance
} = require('./prediction');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CẤU HÌNH GAME ====================
const GAMES = {
    lc79_hu: {
        name: 'TAI XIU HU',
        api: 'https://wtx.tele68.com/v1/tx/lite-sessions?cp=R&cl=R&pf=web&at=83991213bfd4c554dc94bcd98979bdc5'
    },
    lc79_md5: {
        name: 'TAI XIU MD5',
        api: 'https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=3959701241b686f12e01bfe9c3a319b8'
    }
};

const MAX_PRED_LOG = 50000;     // Sức chứa khổng lồ cho AI Tối Thượng
const PERSIST_LIMIT = 20000;    // Lưu trữ bền vững phục vụ nâng cấp Deep Learning
const DEFAULT_HISTORY_LIMIT = 5000;

// ==================== STATE PER GAME ====================
const STATE = {};
for (const gid of Object.keys(GAMES)) {
    STATE[gid] = {
        lastPhien: 0,
        lastTotal: 0,
        history: [],
        totals: [],
        diceData: [],
        currentPrediction: null,
        currentLogic: '',
        currentConfidence: 0,
        currentExpected: [],
        currentAdaptive: null,
        isReversal: false,
        reversalFrom: '',
        recentHistory: '',
        updatedAt: null,
        predLog: [],
        votes: { tai: 0, xiu: 0 },
        details: {}
    };
}

// ==================== PERSISTENCE ====================
const DATA_FILE = path.join(__dirname, 'data.json');
function saveState() {
    try {
        const dump = {};
        for (const gid of Object.keys(STATE)) {
            const S = STATE[gid];
            dump[gid] = {
                lastPhien: S.lastPhien,
                predLog: S.predLog.slice(0, PERSIST_LIMIT)
            };
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(dump));
    } catch (e) { }
}
function loadState() {
    try {
        if (!fs.existsSync(DATA_FILE)) return;
        const dump = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        for (const gid of Object.keys(dump)) {
            if (STATE[gid]) {
                STATE[gid].lastPhien = dump[gid].lastPhien || 0;
                STATE[gid].predLog = dump[gid].predLog || [];
            }
        }
        console.log('[STATE] Loaded persisted data');
    } catch (e) { console.log('[STATE] Load failed:', e.message); }
}
loadState();
setInterval(saveState, 60000);

// ==================== FETCH DATA ====================
async function fetchGameData(gid) {
    const g = GAMES[gid];
    try {
        const res = await fetch(g.api, {
            signal: AbortSignal.timeout(8000),
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        const list = data.list || data.data || (Array.isArray(data) ? data : []);
        if (!list || list.length === 0) return null;
        return list;
    } catch (e) {
        return null;
    }
}

async function updateGame(gid) {
    const S = STATE[gid];
    const list = await fetchGameData(gid);
    if (!list || !list[0]) return;

    const cap = Math.min(list.length, 100);
    const newHistory = [];
    const newTotals = [];
    const newDice = [];
    for (let i = 0; i < cap; i++) {
        const x = list[i];
        const d1 = x.dice1 || x.d1 || 0;
        const d2 = x.dice2 || x.d2 || 0;
        const d3 = x.dice3 || x.d3 || 0;
        let sum = d1 + d2 + d3;
        let bin;
        if (sum === 0 && (x.resultTruyenThong || x.result)) {
            const r = (x.resultTruyenThong || x.result || '').toString().toUpperCase();
            bin = r.includes('TAI') ? 1 : 0;
            sum = bin === 1 ? 14 : 7;
        } else {
            bin = sum > 10 ? 1 : 0;
        }
        newHistory.push(bin);
        newTotals.push(sum);
        newDice.push({ d1, d2, d3, sid: x.id || x.sid || 0 });
    }

    const latestPhien = list[0].id || list[0].sid || 0;
    const gap = latestPhien - (S.lastPhien || latestPhien);
    
    if (!S.history || S.history.length === 0 || gap >= cap) {
        S.history = newHistory;
        S.totals = newTotals;
        S.diceData = newDice;
    } else if (gap > 0) {
        S.history.unshift(...newHistory.slice(0, gap));
        S.totals.unshift(...newTotals.slice(0, gap));
        S.diceData.unshift(...newDice.slice(0, gap));
        if (S.history.length > MAX_PRED_LOG) S.history.length = MAX_PRED_LOG;
        if (S.totals.length > MAX_PRED_LOG) S.totals.length = MAX_PRED_LOG;
        if (S.diceData.length > MAX_PRED_LOG) S.diceData.length = MAX_PRED_LOG;
    }

    if (latestPhien > S.lastPhien) {
        const actual = (newHistory[0] === 1) ? 'TAI' : 'XIU';
        const pending = S.predLog.find(p => p.phien === latestPhien && p.actual === null);
        if (pending) {
            pending.actual = actual;
            pending.actualTotal = newTotals[0];
            pending.correct = pending.prediction === actual;
            const actualVN = actual === 'TAI' ? 'Tài' : 'Xỉu';
            for (const [logicName, predicted] of Object.entries(pending.details || {})) {
                updateLogicPerformance(logicName, predicted, actualVN);
            }
            trackAdaptiveResult(gid, pending.logic, pending.prediction, actual);
        }
        S.lastPhien = latestPhien;
        S.lastTotal = newTotals[0];
        
        const result = deepAnalysisAdaptive(gid, S);
        Object.assign(S, {
            currentPrediction: result.prediction,
            currentLogic: result.logic,
            currentConfidence: result.confidence,
            currentExpected: result.expectedNumbers,
            currentAdaptive: result.adaptive,
            isReversal: result.isReversal,
            reversalFrom: result.reversalFrom,
            votes: result.votes,
            details: result.details,
            updatedAt: new Date().toISOString()
        });

        if (result.prediction) {
            S.predLog.unshift({
                phien: latestPhien + 1,
                prediction: result.prediction,
                confidence: result.confidence,
                logic: result.logic,
                isReversal: result.isReversal,
                votes: result.votes,
                details: result.details,
                adaptive: result.adaptive,
                actual: null,
                correct: null,
                ts: Date.now()
            });
            if (S.predLog.length > MAX_PRED_LOG) S.predLog.length = MAX_PRED_LOG;
        }
        console.log(`[${gid}] PHIÊN ${latestPhien} -> ${actual} | TIẾP THEO: ${result.prediction} ${result.confidence}%`);
    }
}

for (const gid of Object.keys(GAMES)) {
    updateGame(gid);
    setInterval(() => updateGame(gid), 3000);
}

// ==================== API ROUTES ====================
app.use((req, res, next) => {
    res.set({'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST'});
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/system-intelligence', (req, res) => {
    const requestedGame = req.query.game;
    const formatExport = (gameId) => {
        const store = STATE[gameId];
        if (!store || !Array.isArray(store.predLog)) return [];
        return store.predLog.map(h => ({
            phien: h.phien || 0,
            ai_bao: h.prediction || 'NONE',
            tin_cay: h.confidence || 0,
            kq_that: h.actual || 'WAIT',
            dung_sai: h.correct,
            logic: h.logic || 'N/A',
            endgame: h.adaptive?.recommendation || 'NONE'
        }));
    };
    let result = {};
    if (!requestedGame || requestedGame === 'all') {
        Object.keys(STATE).forEach(gid => { result[gid] = formatExport(gid); });
    } else {
        result[requestedGame] = formatExport(requestedGame);
    }
    res.json({ status: 'MONSTER_INTELLIGENCE_DUMP', timestamp: new Date().toISOString(), bundle: result });
});

app.get('/predict/:gameId', (req, res) => {
    const S = STATE[req.params.gameId];
    if (!S) return res.status(404).json({ error: 'N/A' });
    res.json({
        game: GAMES[req.params.gameId].name,
        phien: S.lastPhien + 1,
        prediction: S.currentPrediction,
        confidence: S.currentConfidence,
        logic: S.currentLogic,
        isReversal: S.isReversal,
        reversalFrom: S.reversalFrom,
        updatedAt: S.updatedAt,
        adaptive: S.currentAdaptive,
        lastTotal: S.lastTotal,
        historyCount: S.predLog.length
    });
});

app.get('/history/:gameId', (req, res) => {
    const S = STATE[req.params.gameId];
    if (!S) return res.status(404).json({ error: 'N/A' });
    const completed = S.predLog.filter(p => p.actual !== null);
    const correct = completed.filter(p => p.correct).length;
    res.json({
        accuracy: completed.length > 0 ? `${((correct / completed.length) * 100).toFixed(1)}%` : '--',
        correct, total: completed.length,
        history: S.predLog.slice(0, 1000)
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`SYSTEM LIVE ON PORT ${PORT}`));
