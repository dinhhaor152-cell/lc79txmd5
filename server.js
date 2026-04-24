// ============================================================================
// VI LONG SUPER AI - SERVER V10.0 (NÂNG CẤP THUẬT TOÁN ADAPTIVE)
// - Lưu tối đa 2000 phiên trong RAM (cũ 605)
// - Persist 1500 phiên xuống data.json (cũ 200)
// - /history/:gameId mặc định trả 1000 phiên, hỗ trợ ?limit=N hoặc ?limit=all
// - Dùng deepAnalysisAdaptive: auto-flip logic xấu, calibrate confidence,
//   mean-reversion guard, recommendation rõ ràng
// - /adaptive expose stats từng logic theo dõi rolling
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

// ==================== STORAGE LIMITS (V10) ====================
const MAX_PRED_LOG = 10000;     // RAM cap (Monster Endgame)
const PERSIST_LIMIT = 5000;    // ghi xuống data.json (Monster Endgame)
const DEFAULT_HISTORY_LIMIT = 1000;

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
    } catch (e) { /* ignore */ }
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
setInterval(saveState, 30000);

// ==================== FETCH DATA TỪ API GỐC ====================
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

// ==================== UPDATE STATE TỪ API ====================
async function updateGame(gid) {
    const S = STATE[gid];
    const list = await fetchGameData(gid);
    if (!list) return;

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
        newDice.push({ d1, d2, d3, sid: x.id || x.sid || 0, ts: Date.now() - i * 30000 });
    }
    // MERGE THÔNG MINH ĐỂ NUÔI DATA LÊN 10,000 VÁN (Thay vì reset về 100)
    const latestPhien = list[0].id || list[0].sid || 0;
    const gap = latestPhien - (S.lastPhien || latestPhien);
    
    if (!S.history || S.history.length === 0 || gap >= cap) {
        S.history = newHistory;
        S.totals = newTotals;
        S.diceData = newDice;
    } else if (gap > 0) {
        // Chèn gap phần tử mới nhất vào đầu mảng cũ
        S.history.unshift(...newHistory.slice(0, gap));
        S.totals.unshift(...newTotals.slice(0, gap));
        S.diceData.unshift(...newDice.slice(0, gap));
        
        // Cắt mảng về đúng sức chứa vĩ đại
        if (S.history.length > MAX_PRED_LOG) S.history.length = MAX_PRED_LOG;
        if (S.totals.length > MAX_PRED_LOG) S.totals.length = MAX_PRED_LOG;
        if (S.diceData.length > MAX_PRED_LOG) S.diceData.length = MAX_PRED_LOG;
    }

    S.lastTotal = S.totals[0] || 0;
    S.recentHistory = newHistory.slice(0, 10).map(x => x === 1 ? 'T' : 'X').join('');

    if (latestPhien > S.lastPhien) {
        const actual = (newHistory[0] === 1) ? 'TAI' : 'XIU';

        // Chốt dự đoán đang treo cho phiên này
        const pending = S.predLog.find(p => p.phien === latestPhien && p.actual === null);
        if (pending) {
            pending.actual = actual;
            pending.actualTotal = newTotals[0];
            pending.correct = pending.prediction === actual;

            // Update performance từng logic con
            const actualVN = actual === 'TAI' ? 'Tài' : 'Xỉu';
            for (const [logicName, predicted] of Object.entries(pending.details || {})) {
                updateLogicPerformance(logicName, predicted, actualVN);
            }

            // V10: track logic FINAL (đã qua adaptive layer)
            trackAdaptiveResult(gid, pending.logic, pending.prediction, actual);
        }

        S.lastPhien = latestPhien;

        // V10: dùng deepAnalysisAdaptive thay deepAnalysis
        const result = deepAnalysisAdaptive(gid, S);
        S.currentPrediction = result.prediction;
        S.currentLogic = result.logic;
        S.currentConfidence = result.confidence;
        S.currentExpected = result.expectedNumbers;
        S.currentAdaptive = result.adaptive;
        S.isReversal = result.isReversal;
        S.reversalFrom = result.reversalFrom;
        S.votes = result.votes;
        S.details = result.details;
        S.updatedAt = new Date().toISOString();

        if (result.prediction) {
            S.predLog.unshift({
                phien: latestPhien + 1,
                prediction: result.prediction,
                confidence: result.confidence,
                rawConfidence: result.rawConfidence,
                logic: result.logic,
                isReversal: result.isReversal,
                expectedNumbers: result.expectedNumbers,
                votes: result.votes,
                details: result.details,
                adaptive: result.adaptive,
                actual: null,
                correct: null,
                ts: Date.now()
            });
            if (S.predLog.length > MAX_PRED_LOG) S.predLog.length = MAX_PRED_LOG;
        }

        const rec = result.adaptive ? result.adaptive.recommendation : '';
        console.log(`[${gid}] phien ${latestPhien} -> ${actual} | next ${latestPhien + 1}: ${result.prediction} ${result.confidence}% (${result.logic}) | ${rec}`);
    }
}

for (const gid of Object.keys(GAMES)) {
    updateGame(gid);
    setInterval(() => updateGame(gid), 3000);
}

// ==================== CORS ====================
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ==================== ROUTES ====================
// ENDPOINT TRÍ TUỆ ĐEN (BLACK BOX INTELLIGENCE) - HỖ TRỢ XUẤT ALL GAMES
app.get('/api/system-intelligence', (req, res) => {
    const requestedGame = req.query.game;
    
    const formatExport = (gameId) => {
        const store = STATE[gameId];
        if (!store || !Array.isArray(store.history)) return [];
        return store.history.map(h => ({
            phien: h.phien || 0,
            kq_that: h.correct !== null ? (h.correct ? h.prediction : (h.prediction === 'TAI' ? 'XIU' : 'TAI')) : 'WAIT',
            ai_bao: h.prediction || 'NONE',
            tin_cay: h.confidence || 0,
            logic: h.logic || 'N/A',
            endgame: h.adaptive?.recommendation || 'NONE',
            dung_sai: h.correct
        }));
    };

    let result = {};
    if (!requestedGame || requestedGame === 'all') {
        Object.keys(STATE).forEach(gid => {
            result[gid] = formatExport(gid);
        });
    } else {
        const data = formatExport(requestedGame);
        result[requestedGame] = data;
    }

    res.json({
        status: 'MONSTER_INTELLIGENCE_DUMP',
        timestamp: new Date().toISOString(),
        model_version: 'V10_STABLE',
        bundle: result
    });
});

app.get('/predict/:gameId', (req, res) => {
    const gid = req.params.gameId;
    if (!STATE[gid]) return res.status(404).json({ error: 'Game not found', games: Object.keys(GAMES) });
    const S = STATE[gid];
    res.json({
        game: GAMES[gid].name,
        phien: S.lastPhien + 1,
        historyCount: S.predLog.length,
        updatedAt: S.updatedAt,
        prediction: S.currentPrediction,
        confidence: S.currentConfidence,
        logic: S.currentLogic,
        isReversal: S.isReversal,
        reversalFrom: S.reversalFrom,
        expectedNumbers: S.currentExpected,
        lastTotal: S.lastTotal,
        recentHistory: S.recentHistory,
        votes: S.votes,
        adaptive: S.currentAdaptive
    });
});

// V10: history mặc định 1000, hỗ trợ ?limit=N | ?limit=all | ?onlyCompleted=1
app.get('/history/:gameId', (req, res) => {
    const gid = req.params.gameId;
    if (!STATE[gid]) return res.status(404).json({ error: 'Game not found' });
    const S = STATE[gid];

    let pool = S.predLog;
    if (req.query.onlyCompleted === '1') {
        pool = pool.filter(p => p.actual !== null);
    }

    const completed = S.predLog.filter(p => p.actual !== null);
    const correct = completed.filter(p => p.correct).length;
    const total = completed.length;
    const accuracy = total > 0 ? `${((correct / total) * 100).toFixed(1)}%` : '--';

    let limit = Math.min(DEFAULT_HISTORY_LIMIT, pool.length);
    if (req.query.limit) {
        if (req.query.limit === 'all') {
            limit = pool.length;
        } else {
            const n = parseInt(req.query.limit);
            if (!isNaN(n) && n > 0) limit = Math.min(n, pool.length);
        }
    }

    res.json({
        game: GAMES[gid].name,
        accuracy,
        correct,
        total,
        stored: S.predLog.length,
        maxCapacity: MAX_PRED_LOG,
        returned: limit,
        history: pool.slice(0, limit).map(p => ({
            phien: p.phien,
            prediction: p.prediction,
            confidence: p.confidence,
            rawConfidence: p.rawConfidence,
            logic: p.logic,
            isReversal: p.isReversal,
            expectedNumbers: p.expectedNumbers,
            actual: p.actual,
            actualTotal: p.actualTotal,
            correct: p.correct,
            adaptive: p.adaptive,
            ts: p.ts
        }))
    });
});

// V10: Stats adaptive layer (acc rolling từng logic, status TỐT/XẤU)
app.get('/adaptive', (req, res) => {
    res.json({
        snapshot: getAdaptiveSnapshot(),
        config: {
            windowSize: 50,
            minSamples: 8,
            flipThreshold: '40%',
            goodThreshold: '55%'
        }
    });
});

app.get('/capital/calc', (req, res) => {
    const current = parseInt(req.query.current) || 0;
    const target = parseInt(req.query.target) || 1000000;
    const mode = req.query.mode || 'safe';
    const confidence = parseInt(req.query.confidence) || 80;
    res.json(CAPITAL.calculateBet(current, target, mode, confidence));
});

app.get('/performance', (req, res) => {
    const out = {};
    for (const [k, v] of Object.entries(logicPerformance)) {
        if (v.total > 0) {
            out[k] = {
                total: Math.round(v.total),
                correct: Math.round(v.correct),
                accuracy: (v.accuracy * 100).toFixed(1) + '%',
                consistency: (v.consistency * 100).toFixed(1) + '%'
            };
        }
    }
    res.json(out);
});

app.get('/health', (req, res) => res.json({
    status: 'ok',
    version: '10.0',
    uptime: process.uptime(),
    games: Object.keys(GAMES),
    storage: { ramCap: MAX_PRED_LOG, persistCap: PERSIST_LIMIT, defaultHistoryLimit: DEFAULT_HISTORY_LIMIT }
}));

app.get('/', (req, res, next) => {
    if (fs.existsSync(path.join(__dirname, 'public', 'index.html'))) return next();
    res.send('<h1>VI LONG AI V10</h1><p>API: /predict/:gameId, /history/:gameId?limit=1000, /adaptive, /performance, /health</p>');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VI LONG AI V10.0 ADAPTIVE] Server running on port ${PORT}`);
    console.log(`[STORAGE] RAM cap: ${MAX_PRED_LOG} | persist: ${PERSIST_LIMIT} | default history: ${DEFAULT_HISTORY_LIMIT}`);
    console.log(`[GAMES] ${Object.keys(GAMES).join(', ')}`);
});

process.on('SIGTERM', () => { saveState(); process.exit(0); });
process.on('SIGINT', () => { saveState(); process.exit(0); });
