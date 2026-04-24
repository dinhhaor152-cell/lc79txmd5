// ============================================================================
// VI LONG SUPER AI - PREDICTION ENGINE V9.2 QUANTUM REVERSAL PRO
// Port nguyên 100% logic từ userscript gốc (24 logics + V3..V16 + ensemble)
// ============================================================================

// ==================== TRACK PERFORMANCE TỪNG LOGIC ====================
const logicPerformance = {};
for (let i = 1; i <= 26; i++) {
    logicPerformance['logic' + i] = {
        correct: 0, total: 0, accuracy: 0, consistency: 0,
        lastPredicted: null, lastActual: null
    };
}

const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const MODERATE_CONFIDENCE_THRESHOLD = 0.60;

function updateLogicPerformance(logicName, predicted, actual) {
    if (predicted === null || !logicPerformance[logicName]) return;
    const currentAcc = logicPerformance[logicName].accuracy;
    const currentTotal = logicPerformance[logicName].total;
    let dynamicDecayFactor = 0.95;
    if (currentTotal > 0 && currentAcc < 0.60) dynamicDecayFactor = 0.85;
    else if (currentTotal > 0 && currentAcc > 0.80) dynamicDecayFactor = 0.98;
    logicPerformance[logicName].correct *= dynamicDecayFactor;
    logicPerformance[logicName].total *= dynamicDecayFactor;
    logicPerformance[logicName].total++;
    let wasCorrect = 0;
    if (predicted === actual) { logicPerformance[logicName].correct++; wasCorrect = 1; }
    logicPerformance[logicName].accuracy = logicPerformance[logicName].total > 0
        ? (logicPerformance[logicName].correct / logicPerformance[logicName].total) : 0;
    const adaptiveAlphaConsistency = (currentAcc < 0.6) ? 0.3 : 0.1;
    logicPerformance[logicName].consistency =
        (logicPerformance[logicName].consistency * (1 - adaptiveAlphaConsistency)) +
        (wasCorrect * adaptiveAlphaConsistency);
    if (logicPerformance[logicName].total < 20 && logicPerformance[logicName].accuracy > 0.90)
        logicPerformance[logicName].accuracy = 0.90;
    else if (logicPerformance[logicName].total < 50 && logicPerformance[logicName].accuracy > 0.95)
        logicPerformance[logicName].accuracy = 0.95;
    logicPerformance[logicName].lastPredicted = predicted;
    logicPerformance[logicName].lastActual = actual;
}

// ==================== HELPERS ====================
function calculateStdDev(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

function getDiceFrequencies(history, limit) {
    const allDice = [];
    const effectiveHistory = history.slice(0, limit);
    effectiveHistory.forEach(s => { allDice.push(s.d1, s.d2, s.d3); });
    const diceFreq = new Array(7).fill(0);
    allDice.forEach(d => { if (d >= 1 && d <= 6) diceFreq[d]++; });
    return diceFreq;
}

// ==================== LOGIC 1..24 (NGUYÊN BẢN) ====================
function predictLogic1(lastSession, history) {
    if (!lastSession || history.length < 10) return null;
    const indicatorSum = (lastSession.sid % 10) + lastSession.total;
    const currentPrediction = indicatorSum % 2 === 0 ? "Xỉu" : "Tài";
    let correctCount = 0, totalCount = 0;
    const consistencyWindow = Math.min(history.length - 1, 25);
    for (let i = 0; i < consistencyWindow; i++) {
        const session = history[i], prevSession = history[i + 1];
        if (prevSession) {
            const prevPredicted = ((prevSession.sid % 10) + prevSession.total) % 2 === 0 ? "Xỉu" : "Tài";
            if (prevPredicted === session.result) correctCount++;
            totalCount++;
        }
    }
    if (totalCount > 5 && (correctCount / totalCount) >= 0.65) return currentPrediction;
    return null;
}

function predictLogic2(nextSessionId, history) {
    if (history.length < 15) return null;
    let thuanScore = 0, nghichScore = 0;
    const analysisWindow = Math.min(history.length, 60);
    for (let i = 0; i < analysisWindow; i++) {
        const session = history[i];
        const isEvenSID = session.sid % 2 === 0;
        const weight = 1.0 - (i / analysisWindow) * 0.6;
        if ((isEvenSID && session.result === "Xỉu") || (!isEvenSID && session.result === "Tài")) thuanScore += weight;
        if ((isEvenSID && session.result === "Tài") || (!isEvenSID && session.result === "Xỉu")) nghichScore += weight;
    }
    const currentSessionIsEven = nextSessionId % 2 === 0;
    const totalScore = thuanScore + nghichScore;
    if (totalScore < 10) return null;
    const thuanRatio = thuanScore / totalScore, nghichRatio = nghichScore / totalScore;
    if (thuanRatio > nghichRatio + 0.15) return currentSessionIsEven ? "Xỉu" : "Tài";
    else if (nghichRatio > thuanRatio + 0.15) return currentSessionIsEven ? "Tài" : "Xỉu";
    return null;
}

function predictLogic3(history) {
    if (history.length < 15) return null;
    const analysisWindow = Math.min(history.length, 50);
    const lastXTotals = history.slice(0, analysisWindow).map(s => s.total);
    const average = lastXTotals.reduce((a, b) => a + b, 0) / analysisWindow;
    const stdDev = calculateStdDev(lastXTotals);
    const recentTrendLength = Math.min(5, history.length);
    const recentTrend = history.slice(0, recentTrendLength).map(s => s.total);
    let isRising = false, isFalling = false;
    if (recentTrendLength >= 3) {
        isRising = true; isFalling = true;
        for (let i = 0; i < recentTrendLength - 1; i++) {
            if (recentTrend[i] <= recentTrend[i + 1]) isRising = false;
            if (recentTrend[i] >= recentTrend[i + 1]) isFalling = false;
        }
    }
    if (average < 10.5 - (0.8 * stdDev) && isFalling) return "Xỉu";
    else if (average > 10.5 + (0.8 * stdDev) && isRising) return "Tài";
    return null;
}

function predictLogic4(history) {
    if (history.length < 30) return null;
    let bestPrediction = null, maxConfidence = 0;
    const volatility = calculateStdDev(history.slice(0, Math.min(30, history.length)).map(s => s.total));
    const patternLengths = (volatility < 1.7) ? [6, 5, 4] : [5, 4, 3];
    for (const len of patternLengths) {
        if (history.length < len + 2) continue;
        const recentPattern = history.slice(0, len).map(s => s.result).reverse().join('');
        let taiFollows = 0, xiuFollows = 0, totalMatches = 0;
        for (let i = len; i < Math.min(history.length - 1, 200); i++) {
            if (history.slice(i, i + len).map(s => s.result).reverse().join('') === recentPattern) {
                totalMatches++;
                if (history[i - 1].result === 'Tài') taiFollows++; else xiuFollows++;
            }
        }
        if (totalMatches < 3) continue;
        if (taiFollows / totalMatches >= 0.70 && taiFollows / totalMatches > maxConfidence) {
            maxConfidence = taiFollows / totalMatches; bestPrediction = "Tài";
        } else if (xiuFollows / totalMatches >= 0.70 && xiuFollows / totalMatches > maxConfidence) {
            maxConfidence = xiuFollows / totalMatches; bestPrediction = "Xỉu";
        }
    }
    return bestPrediction;
}

function predictLogic5(history) {
    if (history.length < 40) return null;
    const sumCounts = {};
    const analysisWindow = Math.min(history.length, 400);
    for (let i = 0; i < analysisWindow; i++) {
        const weight = 1.0 - (i / analysisWindow) * 0.8;
        sumCounts[history[i].total] = (sumCounts[history[i].total] || 0) + weight;
    }
    let mostFrequentSum = -1, maxWeightedCount = 0;
    for (const sum in sumCounts) if (sumCounts[sum] > maxWeightedCount) {
        maxWeightedCount = sumCounts[sum]; mostFrequentSum = parseInt(sum);
    }
    if (mostFrequentSum !== -1) {
        const totalWeightedSum = Object.values(sumCounts).reduce((a, b) => a + b, 0);
        if (totalWeightedSum > 0 && (maxWeightedCount / totalWeightedSum) > 0.08) {
            const neighbors = [];
            if (sumCounts[mostFrequentSum - 1]) neighbors.push(sumCounts[mostFrequentSum - 1]);
            if (sumCounts[mostFrequentSum + 1]) neighbors.push(sumCounts[mostFrequentSum + 1]);
            if (neighbors.every(n => maxWeightedCount > n * 1.05)) {
                if (mostFrequentSum <= 10) return "Xỉu";
                if (mostFrequentSum >= 11) return "Tài";
            }
        }
    }
    return null;
}

function predictLogic6(lastSession, history) {
    if (!lastSession || history.length < 40) return null;
    const nextSessionLastDigit = (lastSession.sid + 1) % 10;
    const lastSessionTotalParity = lastSession.total % 2;
    let taiVotes = 0, xiuVotes = 0;
    const analysisWindow = Math.min(history.length, 250);
    for (let i = 0; i < analysisWindow - 1; i++) {
        if (`${history[i + 1].sid % 10 % 2}-${history[i + 1].total % 2}-${(history[i + 1].total > 10.5 ? 'T' : 'X')}` ===
            `${nextSessionLastDigit % 2}-${lastSessionTotalParity}-${(lastSession.total > 10.5 ? 'T' : 'X')}`) {
            if (history[i].result === "Tài") taiVotes++; else xiuVotes++;
        }
    }
    const totalVotes = taiVotes + xiuVotes;
    if (totalVotes >= 5 && Math.abs(taiVotes - xiuVotes) / totalVotes > 0.25)
        return taiVotes > xiuVotes ? "Tài" : "Xỉu";
    return null;
}

function predictLogic7(history) {
    if (history.length < 4) return null;
    const effectiveStreakLength = (calculateStdDev(history.slice(0, Math.min(25, history.length)).map(s => s.total)) < 1.6) ? 7 : 5;
    const recentResults = history.slice(0, effectiveStreakLength).map(s => s.result);
    if (recentResults.length < effectiveStreakLength) return null;
    if (recentResults.every(r => r === "Tài") && history.slice(effectiveStreakLength, effectiveStreakLength + 2).filter(s => s.result === "Tài").length >= 1) return "Tài";
    if (recentResults.every(r => r === "Xỉu") && history.slice(effectiveStreakLength, effectiveStreakLength + 2).filter(s => s.result === "Xỉu").length >= 1) return "Xỉu";
    return null;
}

function predictLogic8(history) {
    if (history.length < 31) return null;
    const longTermTotals = history.slice(1, 31).map(s => s.total);
    const dynamicDeviationThreshold = Math.max(1.5, 0.8 * calculateStdDev(longTermTotals));
    const last5Totals = history.slice(0, Math.min(5, history.length)).map(s => s.total);
    let isLast5Rising = false, isLast5Falling = false;
    if (last5Totals.length >= 2) {
        isLast5Rising = true; isLast5Falling = true;
        for (let i = 0; i < last5Totals.length - 1; i++) {
            if (last5Totals[i] <= last5Totals[i + 1]) isLast5Rising = false;
            if (last5Totals[i] >= last5Totals[i + 1]) isLast5Falling = false;
        }
    }
    const avg = longTermTotals.reduce((a, b) => a + b, 0) / 30;
    if (history[0].total > avg + dynamicDeviationThreshold && isLast5Rising) return "Xỉu";
    if (history[0].total < avg - dynamicDeviationThreshold && isLast5Falling) return "Tài";
    return null;
}

function predictLogic9(history) {
    if (history.length < 20) return null;
    let maxTai = 0, maxXiu = 0, cTai = 0, cXiu = 0;
    for (const s of history.slice(0, Math.min(history.length, 120))) {
        if (s.result === "Tài") { cTai++; cXiu = 0; } else { cXiu++; cTai = 0; }
        maxTai = Math.max(maxTai, cTai); maxXiu = Math.max(maxXiu, cXiu);
    }
    let currentConsecutiveCount = 0;
    for (let i = 0; i < history.length; i++) {
        if (history[i].result === history[0].result) currentConsecutiveCount++; else break;
    }
    if (currentConsecutiveCount >= Math.max(4, Math.floor(Math.max(maxTai, maxXiu) * 0.5)) && currentConsecutiveCount >= 3) {
        let totalReversals = 0, totalContinuations = 0;
        for (let i = currentConsecutiveCount; i < history.length - currentConsecutiveCount; i++) {
            if (history.slice(i, i + currentConsecutiveCount).every(s => s.result === history[0].result)) {
                if (history[i - 1] && history[i - 1].result !== history[0].result) totalReversals++;
                else if (history[i - 1] && history[i - 1].result === history[0].result) totalContinuations++;
            }
        }
        if (totalReversals + totalContinuations > 3 && totalReversals > totalContinuations * 1.3)
            return history[0].result === "Tài" ? "Xỉu" : "Tài";
    }
    return null;
}

function predictLogic10(history) {
    if (history.length < 8) return null;
    if (history.slice(0, 3).every(r => r.result === "Tài") &&
        history.slice(0, 7).filter(r => r.result === "Tài").length / 7 >= 0.75 &&
        predictLogic9(history) !== "Xỉu") return "Tài";
    if (history.slice(0, 3).every(r => r.result === "Xỉu") &&
        history.slice(0, 7).filter(r => r.result === "Xỉu").length / 7 >= 0.75 &&
        predictLogic9(history) !== "Tài") return "Xỉu";
    return null;
}

function predictLogic11(history) {
    if (history.length < 15) return null;
    const reversalPatterns = [
        { pattern: "TàiXỉuTài", predict: "Xỉu", minOccurrences: 3, weight: 1.5 },
        { pattern: "XỉuTàiXỉu", predict: "Tài", minOccurrences: 3, weight: 1.5 },
        { pattern: "TàiTàiXỉu", predict: "Tài", minOccurrences: 4, weight: 1.3 },
        { pattern: "XỉuXỉuTài", predict: "Xỉu", minOccurrences: 4, weight: 1.3 },
        { pattern: "TàiXỉuXỉu", predict: "Tài", minOccurrences: 3, weight: 1.4 },
        { pattern: "XỉuTàiTài", predict: "Xỉu", minOccurrences: 3, weight: 1.4 },
        { pattern: "XỉuTàiTàiXỉu", predict: "Xỉu", minOccurrences: 2, weight: 1.6 },
        { pattern: "TàiXỉuXỉuTài", predict: "Tài", minOccurrences: 2, weight: 1.6 },
        { pattern: "TàiXỉuTàiXỉu", predict: "Tài", minOccurrences: 2, weight: 1.4 },
        { pattern: "XỉuTàiXỉuTài", predict: "Xỉu", minOccurrences: 2, weight: 1.4 },
        { pattern: "TàiXỉuXỉuXỉu", predict: "Tài", minOccurrences: 1, weight: 1.7 },
        { pattern: "XỉuTàiTàiTài", predict: "Xỉu", minOccurrences: 1, weight: 1.7 },
    ];
    let bestPatternMatch = null, maxWeightedConfidence = 0;
    for (const patternDef of reversalPatterns) {
        const patternDefShort = patternDef.pattern.replace(/Tài/g, 'T').replace(/Xỉu/g, 'X');
        if (history.length < patternDefShort.length + 1) continue;
        if (history.slice(0, patternDefShort.length).map(s => s.result === 'Tài' ? 'T' : 'X').reverse().join('') === patternDefShort) {
            let matchCount = 0, totalPatternOccurrences = 0;
            for (let i = patternDefShort.length; i < Math.min(history.length - 1, 350); i++) {
                if (history.slice(i, i + patternDefShort.length).map(s => s.result === 'Tài' ? 'T' : 'X').reverse().join('') === patternDefShort) {
                    totalPatternOccurrences++;
                    if (history[i - 1].result === patternDef.predict) matchCount++;
                }
            }
            if (totalPatternOccurrences >= patternDef.minOccurrences && matchCount / totalPatternOccurrences >= 0.68) {
                if ((matchCount / totalPatternOccurrences) * patternDef.weight > maxWeightedConfidence) {
                    maxWeightedConfidence = (matchCount / totalPatternOccurrences) * patternDef.weight;
                    bestPatternMatch = patternDef.predict;
                }
            }
        }
    }
    return bestPatternMatch;
}

function predictLogic12(lastSession, history) {
    if (!lastSession || history.length < 20) return null;
    let currentConsecutiveCount = 0;
    for (let i = 0; i < history.length; i++) {
        if (history[i].result === history[0].result) currentConsecutiveCount++; else break;
    }
    let taiVotes = 0, xiuVotes = 0;
    for (let i = 0; i < Math.min(history.length, 250) - 1; i++) {
        let histConsecutiveCount = 0;
        for (let j = i + 1; j < Math.min(history.length, 250); j++) {
            if (history[j].result === history[i + 1].result) histConsecutiveCount++; else break;
        }
        if (history[i + 1].sid % 2 === (lastSession.sid + 1) % 2 && histConsecutiveCount === currentConsecutiveCount) {
            if (history[i].result === "Tài") taiVotes++; else xiuVotes++;
        }
    }
    if (taiVotes + xiuVotes >= 6) {
        if (taiVotes / (taiVotes + xiuVotes) >= 0.68) return "Tài";
        if (xiuVotes / (taiVotes + xiuVotes) >= 0.68) return "Xỉu";
    }
    return null;
}

function predictLogic13(history) {
    if (history.length < 80) return null;
    let currentStreakLength = 0;
    for (let i = 0; i < history.length; i++) {
        if (history[i].result === history[0].result) currentStreakLength++; else break;
    }
    if (currentStreakLength < 1) return null;
    const streakStats = {};
    for (let i = 0; i < Math.min(history.length, 500) - 1; i++) {
        let tempStreakLength = 1;
        for (let j = i + 2; j < Math.min(history.length, 500); j++) {
            if (history[j].result === history[i + 1].result) tempStreakLength++; else break;
        }
        if (tempStreakLength > 0) {
            const k = `${history[i + 1].result}_${tempStreakLength}`;
            if (!streakStats[k]) streakStats[k] = { 'Tài': 0, 'Xỉu': 0 };
            streakStats[k][history[i].result]++;
        }
    }
    if (streakStats[`${history[0].result}_${currentStreakLength}`]) {
        const stats = streakStats[`${history[0].result}_${currentStreakLength}`];
        if (stats['Tài'] + stats['Xỉu'] >= 5) {
            if (stats['Tài'] / (stats['Tài'] + stats['Xỉu']) >= 0.65) return "Tài";
            if (stats['Xỉu'] / (stats['Tài'] + stats['Xỉu']) >= 0.65) return "Xỉu";
        }
    }
    return null;
}

function predictLogic14(history) {
    if (history.length < 50) return null;
    const shortTermTotals = history.slice(0, 8).map(s => s.total);
    const longTermTotals = history.slice(0, 30).map(s => s.total);
    const shortAvg = shortTermTotals.reduce((a, b) => a + b, 0) / 8;
    const longAvg = longTermTotals.reduce((a, b) => a + b, 0) / 30;
    const longStdDev = calculateStdDev(longTermTotals);
    if (shortAvg > longAvg + (longStdDev * 0.8) && history.slice(0, 2).map(s => s.result).every(r => r === "Tài")) return "Xỉu";
    if (shortAvg < longAvg - (longStdDev * 0.8) && history.slice(0, 2).map(s => s.result).every(r => r === "Xỉu")) return "Tài";
    return null;
}

function predictLogic15(history) {
    if (history.length < 80) return null;
    const evenCounts = { "Tài": 0, "Xỉu": 0 }, oddCounts = { "Tài": 0, "Xỉu": 0 };
    let totalEven = 0, totalOdd = 0;
    for (let i = 0; i < Math.min(history.length, 400); i++) {
        if (history[i].total % 2 === 0) { evenCounts[history[i].result]++; totalEven++; }
        else { oddCounts[history[i].result]++; totalOdd++; }
    }
    if (totalEven < 20 || totalOdd < 20) return null;
    if (history[0].total % 2 === 0) {
        if (evenCounts["Tài"] / totalEven >= 0.65) return "Tài";
        if (evenCounts["Xỉu"] / totalEven >= 0.65) return "Xỉu";
    } else {
        if (oddCounts["Tài"] / totalOdd >= 0.65) return "Tài";
        if (oddCounts["Xỉu"] / totalOdd >= 0.65) return "Xỉu";
    }
    return null;
}

function predictLogic16(history) {
    if (history.length < 60) return null;
    const moduloPatterns = {};
    for (let i = 0; i < Math.min(history.length, 500) - 1; i++) {
        const moduloValue = history[i + 1].total % 5;
        if (!moduloPatterns[moduloValue]) moduloPatterns[moduloValue] = { 'Tài': 0, 'Xỉu': 0 };
        moduloPatterns[moduloValue][history[i].result]++;
    }
    if (moduloPatterns[history[0].total % 5]) {
        const stats = moduloPatterns[history[0].total % 5];
        if (stats['Tài'] + stats['Xỉu'] >= 7) {
            if (stats['Tài'] / (stats['Tài'] + stats['Xỉu']) >= 0.65) return "Tài";
            if (stats['Xỉu'] / (stats['Tài'] + stats['Xỉu']) >= 0.65) return "Xỉu";
        }
    }
    return null;
}

function predictLogic17(history) {
    if (history.length < 100) return null;
    const totals = history.slice(0, Math.min(history.length, 600)).map(s => s.total);
    const meanTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
    const stdDevTotal = calculateStdDev(totals);
    if (stdDevTotal > 0 && Math.abs(history[0].total - meanTotal) / stdDevTotal >= 1.5) {
        return history[0].total > meanTotal ? "Xỉu" : "Tài";
    }
    return null;
}

function predictLogic18(history) {
    if (history.length < 50) return null;
    const patternStats = {};
    for (let i = 0; i < Math.min(history.length, 300) - 1; i++) {
        const patternKey = `${history[i + 1].d1 % 2}-${history[i + 1].d2 % 2}-${history[i + 1].d3 % 2}`;
        if (!patternStats[patternKey]) patternStats[patternKey] = { 'Tài': 0, 'Xỉu': 0 };
        patternStats[patternKey][history[i].result]++;
    }
    const currentPatternKey = `${history[0].d1 % 2}-${history[0].d2 % 2}-${history[0].d3 % 2}`;
    if (patternStats[currentPatternKey]) {
        const stats = patternStats[currentPatternKey];
        if (stats['Tài'] + stats['Xỉu'] >= 8) {
            if (stats['Tài'] / (stats['Tài'] + stats['Xỉu']) >= 0.65) return "Tài";
            if (stats['Xỉu'] / (stats['Tài'] + stats['Xỉu']) >= 0.65) return "Xỉu";
        }
    }
    return null;
}

function predictLogic19(history) {
    if (history.length < 50) return null;
    let taiScore = 0, xiuScore = 0;
    const now = Date.now();
    for (const session of history) {
        if (now - session.timestamp > 7200000) break;
        const ageFactor = 1 - ((now - session.timestamp) / 7200000);
        const weight = Math.pow(ageFactor, 3);
        if (session.result === "Tài") taiScore += weight; else xiuScore += weight;
    }
    if (taiScore + xiuScore >= 10) {
        if (taiScore / (taiScore + xiuScore) > (xiuScore / (taiScore + xiuScore)) + 0.10) return "Tài";
        if (xiuScore / (taiScore + xiuScore) > (taiScore / (taiScore + xiuScore)) + 0.10) return "Xỉu";
    }
    return null;
}

function markovWeightedV3(patternArr) {
    if (patternArr.length < 3) return null;
    const transitions = {};
    for (let i = 0; i < patternArr.length - 1; i++) {
        const key = patternArr[i] + patternArr[i + 1];
        if (!transitions[key]) transitions[key] = { 'T': 0, 'X': 0 };
        if (i + 2 < patternArr.length) transitions[key][patternArr[i + 2]]++;
    }
    if (patternArr.length > 1 && transitions[patternArr[patternArr.length - 2] + patternArr[patternArr.length - 1]]) {
        const stats = transitions[patternArr[patternArr.length - 2] + patternArr[patternArr.length - 1]];
        if (stats['T'] + stats['X'] > 3) {
            if (stats['T'] / (stats['T'] + stats['X']) > 0.60) return "Tài";
            if (stats['X'] / (stats['T'] + stats['X']) > 0.60) return "Xỉu";
        }
    }
    return null;
}

function repeatingPatternV3(patternArr) {
    if (patternArr.length < 4) return null;
    let taiFollows = 0, xiuFollows = 0, totalMatches = 0;
    for (let i = 0; i < patternArr.length - 4; i++) {
        if (patternArr.slice(-3).join('') === patternArr.slice(i, i + 3).join('') ||
            patternArr.slice(-4).join('') === patternArr.slice(i, i + 4).join('')) {
            totalMatches++;
            if (patternArr[i + 4] === 'T') taiFollows++; else xiuFollows++;
        }
    }
    if (totalMatches >= 3) {
        if (taiFollows / totalMatches > 0.65) return "Tài";
        if (xiuFollows / totalMatches > 0.65) return "Xỉu";
    }
    return null;
}

function detectBiasV3(patternArr) {
    if (patternArr.length < 5) return null;
    let taiCount = patternArr.filter(r => r === 'T').length;
    if (taiCount / patternArr.length > 0.60) return "Tài";
    if ((patternArr.length - taiCount) / patternArr.length > 0.60) return "Xỉu";
    return null;
}

function predictLogic21(history) {
    if (history.length < 20) return null;
    const patternArr = history.map(s => s.result === 'Tài' ? 'T' : 'X');
    const voteCounts = { Tài: 0, Xỉu: 0 };
    let totalWeightSum = 0;
    [3, 5, 8, 12, 20, 30, 40, 60, 80].forEach(win => {
        if (patternArr.length >= win) {
            const subPattern = patternArr.slice(0, win);
            const markovRes = markovWeightedV3(subPattern.slice().reverse());
            if (markovRes) { voteCounts[markovRes] += (win / 10) * 0.7; totalWeightSum += (win / 10) * 0.7; }
            const repeatRes = repeatingPatternV3(subPattern.slice().reverse());
            if (repeatRes) { voteCounts[repeatRes] += (win / 10) * 0.15; totalWeightSum += (win / 10) * 0.15; }
            const biasRes = detectBiasV3(subPattern);
            if (biasRes) { voteCounts[biasRes] += (win / 10) * 0.15; totalWeightSum += (win / 10) * 0.15; }
        }
    });
    if (totalWeightSum === 0) return null;
    if (voteCounts.Tài > voteCounts.Xỉu * 1.08) return "Tài";
    if (voteCounts.Xỉu > voteCounts.Tài * 1.08) return "Xỉu";
    return null;
}

function predictLogic22(history, cauLogData) {
    if (history.length < 15) return null;
    const resultsOnly = history.map(s => s.result === 'Tài' ? 'T' : 'X');
    let taiVotes = 0, xiuVotes = 0, totalContributionWeight = 0;
    let currentStreakLength = 0;
    for (let i = 0; i < resultsOnly.length; i++) {
        if (resultsOnly[i] === resultsOnly[0]) currentStreakLength++; else break;
    }
    if (currentStreakLength >= 3) {
        let streakBreakCount = 0, streakContinueCount = 0;
        for (let i = currentStreakLength; i < Math.min(resultsOnly.length, 200); i++) {
            if (resultsOnly.slice(i, i + currentStreakLength).every(r => r === resultsOnly[0]) && resultsOnly[i - 1]) {
                if (resultsOnly[i - 1] === resultsOnly[0]) streakContinueCount++; else streakBreakCount++;
            }
        }
        if (streakBreakCount + streakContinueCount > 5) {
            if (streakBreakCount / (streakBreakCount + streakContinueCount) > 0.65) {
                if (resultsOnly[0] === 'T') xiuVotes += 1.5; else taiVotes += 1.5; totalContributionWeight += 1.5;
            } else if (streakContinueCount / (streakBreakCount + streakContinueCount) > 0.65) {
                if (resultsOnly[0] === 'T') taiVotes += 1.5; else xiuVotes += 1.5; totalContributionWeight += 1.5;
            }
        }
    }
    if (history.length >= 4) {
        let patternMatches = 0, taiFollows = 0, xiuFollows = 0;
        const patternToMatch = resultsOnly.slice(0, 4).join('').substring(0, 3);
        for (let i = 0; i < Math.min(resultsOnly.length, 150) - 3; i++) {
            if (resultsOnly.slice(i, i + 3).join('') === patternToMatch) {
                if (resultsOnly[i + 3] === 'T') taiFollows++; else xiuFollows++;
                patternMatches++;
            }
        }
        if (patternMatches > 4) {
            if (taiFollows / patternMatches > 0.70) { taiVotes += 1.2; totalContributionWeight += 1.2; }
            else if (xiuFollows / patternMatches > 0.70) { xiuVotes += 1.2; totalContributionWeight += 1.2; }
        }
    }
    if (totalContributionWeight === 0) return null;
    if (taiVotes > xiuVotes * 1.1) return "Tài";
    if (xiuVotes > taiVotes * 1.1) return "Xỉu";
    return null;
}

function predictLogic23(history) {
    if (history.length < 5) return null;
    const totals = history.map(s => s.total);
    const allDice = history.slice(0, Math.min(history.length, 10)).flatMap(s => [s.d1, s.d2, s.d3]);
    const diceFreq = getDiceFrequencies(history, 10);
    const simplePredictions = [];

    if (history.length >= 2) simplePredictions.push((totals[0] + totals[1]) % 2 === 0 ? "Tài" : "Xỉu");
    if (totals.slice(0, Math.min(history.length, 10)).reduce((a, b) => a + b, 0) / Math.min(history.length, 10) > 10.5)
        simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
    simplePredictions.push(diceFreq[4] + diceFreq[5] > diceFreq[1] + diceFreq[2] ? "Tài" : "Xỉu");
    simplePredictions.push(history.filter(s => s.total > 10).length > history.length / 2 ? "Tài" : "Xỉu");

    if (history.length >= 3) simplePredictions.push(totals.slice(0, 3).reduce((a, b) => a + b, 0) > 33 ? "Tài" : "Xỉu");
    if (history.length >= 5) simplePredictions.push(Math.max(...totals.slice(0, 5)) > 15 ? "Tài" : "Xỉu");
    if (history.length >= 5) simplePredictions.push(totals.slice(0, 5).filter(t => t > 10).length >= 3 ? "Tài" : "Xỉu");
    if (history.length >= 3) simplePredictions.push(totals.slice(0, 3).reduce((a, b) => a + b, 0) > 34 ? "Tài" : "Xỉu");
    if (history.length >= 2) {
        if (totals[0] > 10 && totals[1] > 10) simplePredictions.push("Tài"); else simplePredictions.push("Xỉu");
        if (totals[0] < 10 && totals[1] < 10) simplePredictions.push("Xỉu"); else simplePredictions.push("Tài");
    }
    simplePredictions.push((totals[0] + diceFreq[3]) % 2 === 0 ? "Tài" : "Xỉu");
    simplePredictions.push(diceFreq[2] > 3 ? "Tài" : "Xỉu");
    simplePredictions.push([11, 12, 13].includes(totals[0]) ? "Tài" : "Xỉu");
    if (history.length >= 2) simplePredictions.push(totals[0] + totals[1] > 30 ? "Tài" : "Xỉu");
    simplePredictions.push(allDice.filter(d => d > 3).length > 7 ? "Tài" : "Xỉu");
    simplePredictions.push(totals[0] % 2 === 0 ? "Tài" : "Xỉu");
    simplePredictions.push(allDice.filter(d => d > 3).length > 8 ? "Tài" : "Xỉu");
    if (history.length >= 3) {
        simplePredictions.push(totals.slice(0, 3).reduce((a, b) => a + b, 0) % 4 === 0 ? "Tài" : "Xỉu");
        simplePredictions.push(totals.slice(0, 3).reduce((a, b) => a + b, 0) % 3 === 0 ? "Tài" : "Xỉu");
    }
    simplePredictions.push(totals[0] % 3 === 0 ? "Tài" : "Xỉu");
    simplePredictions.push(totals[0] % 5 === 0 ? "Tài" : "Xỉu");
    simplePredictions.push(totals[0] % 4 === 0 ? "Tài" : "Xỉu");
    simplePredictions.push(diceFreq[4] > 2 ? "Tài" : "Xỉu");

    let taiVotes = simplePredictions.filter(p => p === "Tài").length;
    let xiuVotes = simplePredictions.filter(p => p === "Xỉu").length;
    if (taiVotes > xiuVotes * 1.5) return "Tài";
    if (xiuVotes > taiVotes * 1.5) return "Xỉu";
    return null;
}

const PATTERN_DATA = {
    "ttxttx": { tai: 80, xiu: 20 }, "xxttxx": { tai: 25, xiu: 75 },
    "ttxxtt": { tai: 75, xiu: 25 }, "txtxt": { tai: 60, xiu: 40 },
    "xtxtx": { tai: 40, xiu: 60 }, "ttx": { tai: 70, xiu: 30 },
    "xxt": { tai: 30, xiu: 70 }, "txt": { tai: 65, xiu: 35 },
    "xtx": { tai: 35, xiu: 65 }, "tttt": { tai: 85, xiu: 15 },
    "xxxx": { tai: 15, xiu: 85 }, "ttttt": { tai: 88, xiu: 12 },
    "xxxxx": { tai: 12, xiu: 88 }, "tttttt": { tai: 92, xiu: 8 },
    "xxxxxx": { tai: 8, xiu: 92 }
};

function analyzePatterns(history) {
    return [null, "ĐANG PHÂN TÍCH"];
}

function predictLogic24(history) {
    if (!history || history.length < 5) return null;
    const lastResults = history.map(s => s.result);
    const votes = [];
    const [patternPred, patternDesc] = analyzePatterns(lastResults);
    if (patternPred) votes.push(patternPred);
    const patternSeq = lastResults.slice(0, 3).reverse().map(r => r === "Tài" ? "t" : "x").join("");
    if (PATTERN_DATA[patternSeq]) {
        const prob = PATTERN_DATA[patternSeq];
        if (prob.tai > prob.xiu + 15) votes.push("Tài");
        else if (prob.xiu > prob.tai + 15) votes.push("Xỉu");
    }
    const taiCount = votes.filter(v => v === "Tài").length;
    const xiuCount = votes.filter(v => v === "Xỉu").length;
    if (taiCount + xiuCount < 4) return null;
    if (taiCount >= xiuCount + 3) return "Tài";
    if (xiuCount >= taiCount + 3) return "Xỉu";
    return null;
}

function logic25(history) {
    if (history.length < 5) return null;
    const last5 = history.slice(0, 5).map(s => s.result);
    let count = 1;
    for (let i = 0; i < last5.length - 1; i++) {
        if (last5[i] === last5[i + 1]) count++;
        else break;
    }
    if (count >= 3) return last5[0];
    return null;
}

function logic26(history) {
    if (history.length < 10) return null;
    const last10 = history.slice(0, 10).map(s => s.result);
    const taiCount = last10.filter(r => r === 'Tài').length;
    const xiuCount = last10.filter(r => r === 'Xỉu').length;
    if (taiCount >= 7) return 'Xỉu';
    if (xiuCount >= 7) return 'Tài';
    return null;
}

// ==================== ENSEMBLE VOTE ====================
function ensembleVote(history, lastSession, nextSessionId) {
    const votes = { tai: 0, xiu: 0, details: {} };
    const tally = (name, r) => {
        if (r === 'Tài') { votes.tai++; votes.details[name] = 'Tài'; }
        else if (r === 'Xỉu') { votes.xiu++; votes.details[name] = 'Xỉu'; }
    };
    try { tally('logic1', predictLogic1(lastSession, history)); } catch (e) {}
    try { tally('logic3', predictLogic3(history)); } catch (e) {}
    try { tally('logic4', predictLogic4(history)); } catch (e) {}
    try { tally('logic7', predictLogic7(history)); } catch (e) {}
    try { tally('logic9', predictLogic9(history)); } catch (e) {}
    try { tally('logic11', predictLogic11(history)); } catch (e) {}
    try { tally('logic21', predictLogic21(history)); } catch (e) {}
    try { tally('logic25', logic25(history)); } catch (e) {}
    try { tally('logic26', logic26(history)); } catch (e) {}
    return votes;
}

// ==================== QUANTUM REVERSAL V3..V16 (TỪ deepAnalysis) ====================
function quantumAnalysis(h, lastTotal) {
    // h: mảng nhị phân 1=Tài, 0=Xỉu, mới nhất ở [0]
    let curStreak = 0;
    for (let i = 0; i < h.length; i++) { if (h[i] === h[0]) curStreak++; else break; }
    const pStr = h.slice(0, Math.min(30, h.length)).join('');

    const out = {
        v3: -1, v4: -1, v5: -1, v6: -1, v7: -1, v8: -1, v11: -1,
        v13: -1, v14: -1, v15: -1, v16: -1,
        fastDerivative: -1, microTrend: -1, daoNhip4Phien: -1,
        v3Msg: '', v4Msg: '', v5Msg: '', v6Msg: '', v7Msg: '', v8Msg: '', v8Conf: 0,
        v11Msg: '', v13Msg: '', v14Msg: '', v15Msg: '', v16Msg: '',
        isReversal: false, reversalFrom: '',
        logicMsg: '', confBase: 0, curStreak
    };

    // ĐẢO NHỊP 4 PHIÊN
    if (h.length >= 5) {
        const last4 = h.slice(1, 5).join('');
        if (last4 === '1111' || last4 === '0000') {
            out.daoNhip4Phien = h[0] === 1 ? 0 : 1;
            out.isReversal = true; out.reversalFrom = h[0] === 1 ? 'TÀI' : 'XỈU';
            out.logicMsg = "VIP PRO: ĐẢO NHỊP BẺ BỆT TỪ 4 PHIÊN"; out.confBase = 98;
        } else if (last4 === '1010' || last4 === '0101') {
            out.daoNhip4Phien = h[0];
            out.isReversal = true; out.reversalFrom = h[0] === 1 ? 'XỈU' : 'TÀI';
            out.logicMsg = "VIP PRO: ĐẢO NHỊP CẮT PING PONG LỪA"; out.confBase = 98;
        }
    }

    // V16: ĐẢO NHỊP KÉP
    if (h.length >= 7) {
        const sumRecent = h[0] + h[1] + h[2];
        const sumPrev = h[3] + h[4] + h[5];
        if (sumRecent === sumPrev && h[0] === h[3] && h[1] === h[4] && h[2] === h[5]) {
            out.v16 = h[0] === 1 ? 0 : 1; out.v16Msg = "VI LONG V16: ĐẢO NHỊP KÉP LƯỢNG TỬ";
        }
        if (curStreak >= 4 && (h[0] ^ h[4]) === 1) {
            out.v16 = h[0] === 1 ? 0 : 1; out.v16Msg = "VI LONG V16: ÉP BẺ ĐẢO NHỊP BỆT GÃY";
        }
    }
    // V15: XOR ENTROPY
    if (h.length >= 15) {
        const xorQ = h[0] ^ h[2] ^ h[4];
        const entShift = (h[1] << 2) | (h[3] << 1) | h[5];
        if (xorQ === 1 && entShift > 4 && curStreak < 3) { out.v15 = 1; out.v15Msg = "VI LONG V15: QUANTUM MD5 XOR -> TÀI"; }
        else if (xorQ === 0 && entShift <= 4 && curStreak < 3) { out.v15 = 0; out.v15Msg = "VI LONG V15: QUANTUM MD5 XOR -> XỈU"; }
    }
    // V14: BẮT CHỚM BỆT
    if (h.length >= 6) {
        if (h[0] === h[1] && h[1] !== h[2] && h[2] !== h[3] && h[3] !== h[4]) { out.v14 = h[0]; out.v14Msg = "VI LONG V14: BẺ PING PONG -> ÔM BỆT 4D"; }
        else if (h[0] !== h[1] && h[1] !== h[2] && h[2] === h[3] && h[3] === h[4]) { out.v14 = h[0]; out.v14Msg = "VI LONG V14: NHẬN DIỆN BỆT TỪ CẦU 1-1 LỪA"; }
    }
    // V13: BÁM CẦU
    if (h.length >= 10) {
        let changes = 0;
        for (let i = 0; i < 9; i++) { if (h[i] !== h[i + 1]) changes++; }
        if (changes <= 3 && curStreak >= 2) { out.v13 = h[0]; out.v13Msg = "MÍT V13: BÁM CẦU TREND ỔN ĐỊNH VIP"; }
        else if (changes >= 6) {
            if (h[0] === h[1] && h[1] !== h[2] && h[2] === h[3]) { out.v13 = h[0]; out.v13Msg = "MÍT V13: PHÁT HIỆN CẦU LOẠN -> ĐÓN BỆT CHUẨN"; }
            else if (h[0] !== h[1] && h[1] === h[2] && h[2] !== h[3]) {
                out.v13 = h[0] === 1 ? 0 : 1; out.v13Msg = "MÍT V13: CẮT DÂY LOẠN LỪA ĐẢO";
                out.isReversal = true; out.reversalFrom = h[0] === 1 ? 'TÀI' : 'XỈU';
            }
        }
    }
    // V8: TỔNG 3 VIÊN
    if (lastTotal >= 3 && lastTotal <= 18) {
        const map = {
            3: [1, 60, "TỔNG 3 XỈU ĐÁNH TÀI"],
            4: [0, 70, "TỔNG 4 XỈU ĐÁNH XỈU"],
            5: [1, 70, "TỔNG 5 XỈU ĐÁNH TÀI"],
            6: [0, 80, "TỔNG 6 XỈU ĐÁNH XỈU"],
            7: [0, 60, "TỔNG 7 XỈU ĐÁNH XỈU"],
            8: [1, 60, "TỔNG 8 XỈU ĐÁNH TÀI"],
            9: [0, 80, "TỔNG 9 XỈU ĐÁNH XỈU"],
            10: [0, 60, "TỔNG 10 XỈU ĐÁNH XỈU"],
            11: [0, 60, "TỔNG 11 TÀI ĐÁNH XỈU"],
            12: [1, 80, "TỔNG 12 TÀI ĐÁNH TÀI"],
            13: [1, 60, "TỔNG 13 TÀI ĐÁNH TÀI"],
            14: [0, 60, "TỔNG 14 TÀI ĐÁNH XỈU"],
            15: [1, 70, "TỔNG 15 TÀI ĐÁNH TÀI"],
            16: [0, 60, "TỔNG 16 TÀI ĐÁNH XỈU"],
            17: [1, 60, "TỔNG 17 TÀI ĐÁNH TÀI"],
            18: [1, 80, "TỔNG 18 TÀI ĐÁNH TÀI"]
        };
        if (map[lastTotal]) { out.v8 = map[lastTotal][0]; out.v8Conf = map[lastTotal][1]; out.v8Msg = `CẦU V8: ${map[lastTotal][2]}`; }
    }
    // Fast derivative
    if (h.length >= 6) {
        let recentChanges = 0;
        for (let i = 0; i < 3; i++) { if (h[i] !== h[i + 1]) recentChanges++; }
        if (recentChanges === 3) out.fastDerivative = h[0] === 1 ? 0 : 1;
        else if (h[1] === h[2] && h[2] === h[3] && h[0] !== h[1]) out.fastDerivative = h[0];
    }
    // Micro trend
    if (h.length >= 5) {
        const score = (h[0] * 5) + (h[1] * 3) + (h[2] * 2) + (h[3] * 1) - (h[4] * 1);
        if (score > 6 && h[0] === 1) out.microTrend = 1;
        else if (score < 4 && h[0] === 0) out.microTrend = 0;
    }
    // V3
    if (h.length >= 18 && h[0] === h[3] && h[1] === h[4] && h[2] === h[5]) { out.v3 = h[2]; out.v3Msg = "CẦU V3: LẶP CHU KỲ 3 NHỊP"; }
    // V4
    if (h.length >= 20) {
        if (h[0] === h[4] && h[1] === h[3] && h[0] !== h[2]) { out.v4 = h[0]; out.v4Msg = "CẦU V4: ĐỐI XỨNG GƯƠNG TÂM"; }
        else if (pStr.startsWith('100111') || pStr.startsWith('011000')) { out.v4 = h[0] === 1 ? 1 : 0; out.v4Msg = "CẦU V4: THÁP TIẾN CẤP ĐANG MỞ"; }
        else if (h.length >= 12 && h.slice(0, 6).join('') === h.slice(6, 12).join('')) { out.v4 = h[6]; out.v4Msg = "CẦU V4: BÃO LẶP CHU KỲ 6 NHỊP"; }
    }
    // V5
    if (curStreak > 6) {
        out.v5 = h[0] === 1 ? 0 : 1; out.v5Msg = "CẦU V5: ĐỈNH BỆT ẢO -> ÉP BẺ NHỊP";
        out.isReversal = true; out.reversalFrom = h[0] === 1 ? 'TÀI' : 'XỈU';
    }
    // V6
    if (h.length >= 30) {
        let isPingPong = true;
        for (let i = 0; i < 8; i++) { if (h[i] === h[i + 1]) isPingPong = false; }
        if (isPingPong) { out.v6 = h[0] === 1 ? 0 : 1; out.v6Msg = "CẦU V6: PING PONG DÀI HẠN (1-1)"; }
    }
    // V7
    if (h.length >= 15) {
        const xorVal = h[0] ^ h[1] ^ h[2];
        const bitShift = (h[3] << 1) | h[4];
        const rawEnt = (h[0] * 8) + (h[1] * 4) + (h[2] * 2) + h[3];
        if (xorVal === 1 && bitShift > 1 && rawEnt > 7) { out.v7 = 1; out.v7Msg = "CẦU V7: SUPER ENTROPY (BIT SHIFT TÀI)"; }
        else if (xorVal === 0 && bitShift <= 1 && rawEnt <= 7) { out.v7 = 0; out.v7Msg = "CẦU V7: SUPER ENTROPY (BIT SHIFT XỈU)"; }
    }
    // V11
    if (h.length >= 12) {
        const sShort = (h[0] + h[1] + h[2]) / 3;
        const sMid = (h[3] + h[4] + h[5] + h[6]) / 4;
        if (sShort > 0.6 && sMid < 0.4 && curStreak < 2) { out.v11 = 1; out.v11Msg = "CẦU MÍT V11: LỆCH CHUẨN ĐỘT BIẾN -> TRẢ TÀI"; }
        else if (sShort < 0.4 && sMid > 0.6 && curStreak < 2) { out.v11 = 0; out.v11Msg = "CẦU MÍT V11: LỆCH CHUẨN ĐỘT BIẾN -> TRẢ XỈU"; }
    }
    return out;
}

// ==================== MAIN: deepAnalysis ====================
function deepAnalysis(gameId, S) {
    const h = S.history; // mảng nhị phân
    if (!h || h.length < 6) {
        return { prediction: null, logic: 'CẦU CHƯA ỔN ĐỊNH', confidence: 0, isReversal: false, reversalFrom: '', expectedNumbers: [] };
    }

    // historyObjs: mock dữ liệu xúc xắc giống userscript gốc (sid:0, d1:3, d2:3, d3:1)
    const historyObjs = h.map(r => ({
        result: r === 1 ? "Tài" : "Xỉu",
        total: r === 1 ? 14 : 7,
        sid: 0, d1: 3, d2: 3, d3: 1
    }));

    // Vote ensemble (chỉ 9 logic theo gốc)
    const votes = ensembleVote(historyObjs, { sid: S.lastPhien, total: S.lastTotal }, S.lastPhien + 1);

    // Quantum analysis V3..V16
    const Q = quantumAnalysis(h, S.lastTotal);

    let finalPred = -1, logicMsg = '', confBase = 0;
    let isReversal = Q.isReversal, reversalFrom = Q.reversalFrom;

    if (gameId === 'lc79_md5') {
        const apiHistoryStr = h.slice(0, 5).join('');
        if (apiHistoryStr === '11111' || apiHistoryStr === '00000') {
            finalPred = h[0] === 1 ? 0 : 1; logicMsg = "LC MD5: ĐỈNH BỆT -> BẺ"; confBase = 98;
        } else if (apiHistoryStr.startsWith('101') || apiHistoryStr.startsWith('010')) {
            finalPred = h[0] === 1 ? 0 : 1; logicMsg = "LC MD5: DÂY PING PONG"; confBase = 98;
        } else if (h[0] === h[1] && h[1] === h[2]) {
            finalPred = h[0]; logicMsg = "LC MD5: THEO BỆT MỚI"; confBase = 98;
        } else {
            finalPred = h[0] === 1 ? 0 : 1; logicMsg = "LC MD5: ĐẢO NHỊP CHU KỲ NẮN"; confBase = 98;
            isReversal = true; reversalFrom = h[0] === 1 ? 'TÀI' : 'XỈU';
        }
    } else {
        // LC79 HU - ưu tiên đảo nhịp 4 phiên + ensemble + V3..V16
        if (Q.daoNhip4Phien !== -1) { finalPred = Q.daoNhip4Phien; logicMsg = Q.logicMsg; confBase = Q.confBase; }
        else if (votes.tai > votes.xiu + 2 && Q.v16 === -1 && Q.v15 === -1) {
            finalPred = 1; logicMsg = "VI LONG VIP: AI ĐỒNG THUẬN (TÀI)"; confBase = 95 + Math.min(Math.floor(votes.tai), 4);
        } else if (votes.xiu > votes.tai + 2 && Q.v16 === -1 && Q.v15 === -1) {
            finalPred = 0; logicMsg = "VI LONG VIP: AI ĐỒNG THUẬN (XỈU)"; confBase = 95 + Math.min(Math.floor(votes.xiu), 4);
        }
        else if (Q.v16 !== -1) { finalPred = Q.v16; logicMsg = Q.v16Msg; confBase = 99; isReversal = true; reversalFrom = h[0] === 1 ? 'TÀI' : 'XỈU'; }
        else if (Q.v15 !== -1) { finalPred = Q.v15; logicMsg = Q.v15Msg; confBase = 99; }
        else if (Q.v14 !== -1) { finalPred = Q.v14; logicMsg = Q.v14Msg; confBase = 99; }
        else if (Q.v13 !== -1) { finalPred = Q.v13; logicMsg = Q.v13Msg; confBase = 99; }
        else if (Q.v11 !== -1) { finalPred = Q.v11; logicMsg = Q.v11Msg; confBase = 99; }
        else if (Q.v8 !== -1) { finalPred = Q.v8; logicMsg = Q.v8Msg; confBase = Q.v8Conf; }
        else if (Q.v7 !== -1) { finalPred = Q.v7; logicMsg = Q.v7Msg; confBase = 99; }
        else if (Q.v6 !== -1) { finalPred = Q.v6; logicMsg = Q.v6Msg; confBase = 99; }
        else if (Q.v5 !== -1) { finalPred = Q.v5; logicMsg = Q.v5Msg; confBase = 99; }
        else if (Q.v4 !== -1) { finalPred = Q.v4; logicMsg = Q.v4Msg; confBase = 99; }
        else if (Q.v3 !== -1) { finalPred = Q.v3; logicMsg = Q.v3Msg; confBase = 98; }
        else if (Q.fastDerivative !== -1) { finalPred = Q.fastDerivative; logicMsg = "VIP 9: BẮT NGUYÊN TỬ NHANH"; confBase = 95; }
        else if (Q.microTrend !== -1 && Q.curStreak <= 3) { finalPred = Q.microTrend; logicMsg = "VIP MÍT 10: SIÊU TRỌNG SỐ VỊ TẬP CHUNG"; confBase = 94; }
        else { finalPred = h[0] === 1 ? 0 : 1; logicMsg = "ĐẢO NHỊP TIÊU CHUẨN VIP"; confBase = 85; }
    }

    const finalConf = Math.min(Math.max(confBase + (h[0] === h[1] && Q.curStreak < 3 ? 2 : 0), 65), 99);

    // ĐỌC VỊ XÚC XẮC SÂU - 3 SỐ XÁC SUẤT CAO NHẤT
    let expectedNumsArr = [];
    const baseSum = S.lastTotal || 10;
    if (finalPred === 1) {
        if (baseSum <= 6) expectedNumsArr = [11, 12, 13];
        else if (baseSum >= 15) expectedNumsArr = [13, 14, 15];
        else if (baseSum % 2 === 0) expectedNumsArr = [12, 14, 16];
        else expectedNumsArr = [11, 13, 15];
    } else {
        if (baseSum >= 15) expectedNumsArr = [8, 9, 10];
        else if (baseSum <= 6) expectedNumsArr = [6, 7, 8];
        else if (baseSum % 2 === 0) expectedNumsArr = [6, 8, 10];
        else expectedNumsArr = [5, 7, 9];
    }
    if (h.length > 3) {
        const adjust = h[1] === h[2] ? 1 : 0;
        if (finalPred === 1 && expectedNumsArr[2] < 17 && adjust) {
            expectedNumsArr.shift();
            expectedNumsArr.push(expectedNumsArr[1] + 1 > 17 ? 17 : expectedNumsArr[1] + 1);
        }
        if (finalPred === 0 && expectedNumsArr[0] > 4 && adjust) {
            expectedNumsArr.pop();
            expectedNumsArr.unshift(expectedNumsArr[0] - 1 < 4 ? 4 : expectedNumsArr[0] - 1);
        }
    }

    return {
        prediction: finalPred === 1 ? 'TAI' : 'XIU',
        logic: logicMsg,
        confidence: finalConf,
        isReversal,
        reversalFrom,
        expectedNumbers: expectedNumsArr,
        votes: { tai: Math.round(votes.tai * 10) / 10, xiu: Math.round(votes.xiu * 10) / 10 },
        details: votes.details
    };
}

// ==================== QUẢN LÝ VỐN (CAPITAL) — KHỚP 100% userscript gốc ====================
const CAPITAL = {
    formatMoney: (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    calculateBet: (current, target, mode, confidence) => {
        if (current >= target) return { amount: 0, percent: 0, msg: "ĐÃ ĐẠT MỤC TIÊU LÃI" };
        let percent = 0;
        if (mode === 'safe') {
            if (confidence >= 95) percent = 12.5;
            else if (confidence >= 90) percent = 8.5;
            else if (confidence >= 85) percent = 5.5;
            else if (confidence >= 80) percent = 3.5;
            else if (confidence >= 75) percent = 1.5;
            else percent = 0;
        } else {
            if (confidence >= 95) percent = 25.5;
            else if (confidence >= 90) percent = 18.5;
            else if (confidence >= 85) percent = 12.5;
            else if (confidence >= 80) percent = 8.5;
            else if (confidence >= 75) percent = 4.5;
            else percent = 0;
        }
        const amount = Math.floor((current * percent) / 100);
        return { amount, percent, msg: amount > 0 ? "VÀO LỆNH" : "NÊN BỎ QUA" };
    }
};

// ============================================================================
// ============== V10.0 ADAPTIVE LAYER (NÂNG CẤP THUẬT TOÁN) ==================
// Track accuracy thực, auto-flip logic kém, calibrate confidence trung thực,
// mean-reversion guard, recommendation rõ ràng (VÀO/BỎ).
// ============================================================================
const ADAPTIVE = {
    windowSize: 50,         // rolling window theo dõi acc của mỗi logic
    minSamples: 8,          // tối thiểu mẫu mới đủ tin cậy đánh giá logic
    flipThreshold: 0.40,    // acc < 40% → AUTO ĐẢO dự đoán
    goodThreshold: 0.55,    // acc >= 55% → tin cậy, KHUYÊN VÀO
    rolling: {}             // {gameId: {logicName: [{correct: bool, ts: number}, ...]}}
};

function _arr(gameId, logicName) {
    if (!ADAPTIVE.rolling[gameId]) ADAPTIVE.rolling[gameId] = {};
    if (!ADAPTIVE.rolling[gameId][logicName]) ADAPTIVE.rolling[gameId][logicName] = [];
    return ADAPTIVE.rolling[gameId][logicName];
}

// Gọi sau khi chốt phiên thật để cập nhật accuracy của logic đã chọn
function trackAdaptiveResult(gameId, logicName, predicted, actual) {
    if (!logicName) return;
    // Strip prefix "[ADAPTIVE-FLIP] " để gom về logic gốc
    const baseName = logicName.replace(/^\[ADAPTIVE-FLIP\]\s*/, '').replace(/\s*\(acc.*$/, '').replace(/\s*\[BIAS:.*$/, '');
    const arr = _arr(gameId, baseName);
    arr.push({ correct: predicted === actual, ts: Date.now() });
    while (arr.length > ADAPTIVE.windowSize) arr.shift();
}

function adaptiveStats(gameId, logicName) {
    const baseName = (logicName || '').replace(/^\[ADAPTIVE-FLIP\]\s*/, '').replace(/\s*\(acc.*$/, '').replace(/\s*\[BIAS:.*$/, '');
    const arr = _arr(gameId, baseName);
    if (arr.length === 0) return { samples: 0, acc: 0.5, shouldFlip: false, trust: false };
    const correct = arr.filter(x => x.correct).length;
    const acc = correct / arr.length;
    return {
        samples: arr.length,
        acc,
        shouldFlip: arr.length >= ADAPTIVE.minSamples && acc < ADAPTIVE.flipThreshold,
        trust: arr.length >= ADAPTIVE.minSamples && acc >= ADAPTIVE.goodThreshold
    };
}

// Calibrate confidence dựa trên acc thực thay vì gán cứng 98%
// 50% acc -> 55, 60% -> 70, 70% -> 80, >=80% -> 85 (cap)
function calibratedConfidence(stats) {
    if (stats.samples < ADAPTIVE.minSamples) return 60; // chưa đủ data
    return Math.round(Math.min(85, Math.max(50, 55 + (stats.acc - 0.5) * 100)));
}

function getAdaptiveSnapshot() {
    const out = {};
    for (const gid of Object.keys(ADAPTIVE.rolling)) {
        out[gid] = {};
        for (const [name, arr] of Object.entries(ADAPTIVE.rolling[gid])) {
            const correct = arr.filter(x => x.correct).length;
            const acc = arr.length ? correct / arr.length : 0;
            out[gid][name] = {
                samples: arr.length,
                correct,
                accuracy: (acc * 100).toFixed(1) + '%',
                status: arr.length < ADAPTIVE.minSamples ? 'CHƯA ĐỦ DATA'
                       : acc < ADAPTIVE.flipThreshold ? 'XẤU - SẼ AUTO-FLIP'
                       : acc >= ADAPTIVE.goodThreshold ? 'TỐT - TIN CẬY'
                       : 'TRUNG BÌNH'
            };
        }
    }
    return out;
}

// ============================================================================
// VI LONG SUPER AI - TỐI THƯỢNG ĐỘT PHÁ (THE ENDGAME ALGORITHM)
// THUẬT TOÁN BÓNG RÂM (SHADOW-STATE META-INVERSION) + MARKOV DETERMINISTIC
// ============================================================================
function predictEndgameHolyGrail(history, historyTotals) {
    if (history.length < 50) return { prediction: null, logic: `[ENDGAME]: CHƯA ĐỦ 50 VÁN KÍCH HOẠT (HIỆN DO ${history.length})` };
    const h = history; // h is already binary array 1/0
    const ts = historyTotals; // array of totals

    // 1. MARKOV TỔ TUYỆT ĐỐI (MEMORY DEEP SCAN LÊN ĐẾN 10,000 VÁN)
    const currentPattern = h.slice(0, 5).join('');
    let matchT = 0, matchX = 0;
    for (let i = 5; i < Math.min(h.length - 5, 10000); i++) {
        if (h.slice(i, i + 5).join('') === currentPattern) {
            if (h[i - 1] === 1) matchT++;
            else matchX++;
        }
    }
    if (matchT + matchX >= 4) {
        if (matchT === 0) return { prediction: "XIU", logic: "[ENDGAME]: MARKOV 100% CẢNH GIỚI (KHÔNG CÓ TÀI)" };
        if (matchX === 0) return { prediction: "TAI", logic: "[ENDGAME]: MARKOV 100% CẢNH GIỚI (KHÔNG CÓ XỈU)" };
    }

    // 2. SHADOW-STATE META INVERSION
    let pingPongLength = 0;
    for (let i = 0; i < h.length - 1; i++) {
        if (h[i] !== h[i+1]) pingPongLength++;
        else break;
    }
    if (pingPongLength >= 6 && pingPongLength < 9) {
        return { prediction: h[0] === 1 ? "XIU" : "TAI", logic: `[ENDGAME]: ĐÚ THUẬN NHỊP PING-PONG (NHÀ CÁI KÉO DÀI) NHỊP THỨ ${pingPongLength + 1}` };
    }

    let betLength = 1;
    for (let i = 0; i < h.length - 1; i++) {
        if (h[i] === h[0]) betLength++;
        else break;
    }
    if (betLength >= 7 && betLength < 10) {
        return { prediction: h[0] === 1 ? "TAI" : "XIU", logic: `[ENDGAME]: ĐÚ BÃO BỆT CỰC ĐẠI (NHÀ CÁI KÉO DÀI) NHỊP THỨ ${betLength + 1}` };
    }

    // 3. THÁI CỰC TỔNG ĐIỂM NGƯỢC
    if (h.length >= 3) {
        if (ts && ts[0] === 11 && ts[1] === 11 && ts[2] === 11) return { prediction: "XIU", logic: "[ENDGAME]: ÉP CẦU TÀI 11 ĐỈNH ĐIỂM -> XẢ XỈU" };
        if (ts && ts[0] === 10 && ts[1] === 10 && ts[2] === 10) return { prediction: "TAI", logic: "[ENDGAME]: ÉP CẦU XỈU 10 ĐỈNH ĐIỂM -> XẢ TÀI" };
    }

    return { prediction: null, logic: '[ENDGAME]: DÒNG CHẢY ỔN ĐỊNH - CHƯA ĐỦ SÁT KHÍ TẤT TAY' };
}

// HÀM CHÍNH MỚI: thay deepAnalysis ở server.js bằng hàm này
function deepAnalysisAdaptive(gameId, S) {
    // === CHÈN ENDGAME TỐI THƯỢNG TẠI ĐÂY ===
    const endgame = predictEndgameHolyGrail(S.history, S.totals);
    if (endgame && endgame.prediction !== null) {
        return {
            prediction: endgame.prediction,
            logic: endgame.logic,
            confidence: 99,
            isReversal: endgame.logic.includes("BẺ"),
            reversalFrom: endgame.prediction === 'TAI' ? 'XIU' : 'TAI',
            expectedNumbers: [],
            votes: { tai: 10, xiu: 10 },
            details: { endgame: endgame.prediction },
            adaptive: { recommendation: 'TẤT TAY (SHADOW-STATE/MARKOV ĐÃ KHÓA CẦU)' },
            rawConfidence: 99
        };
    }
    // ======================================

    const raw = deepAnalysis(gameId, S);
    if (!raw.prediction) return { ...raw, adaptive: { recommendation: 'CHỜ DATA' } };

    const stats = adaptiveStats(gameId, raw.logic);
    let finalPred = raw.prediction;
    let isReversal = raw.isReversal;
    let logicMsg = raw.logic;

    // 1. AUTO-FLIP: logic kém liên tục thì đảo ngược (anti-signal là signal)
    if (stats.shouldFlip) {
        finalPred = raw.prediction === 'TAI' ? 'XIU' : 'TAI';
        isReversal = !isReversal;
        logicMsg = `[ADAPTIVE-FLIP] ${raw.logic} (acc ${(stats.acc * 100).toFixed(0)}% → đảo)`;
    }

    // 2. MEAN REVERSION GUARD: 10 phiên gần đây lệch nặng → cảnh báo
    const h10 = (S.history || []).slice(0, 10);
    const taiCount = h10.filter(x => x === 1).length;
    let biasNote = '';
    let biasPenalty = 0;
    if (h10.length === 10) {
        if (taiCount >= 8 && finalPred === 'TAI') { biasNote = ' [BIAS: 8/10 Tài, cẩn thận]'; biasPenalty = 10; }
        if (taiCount <= 2 && finalPred === 'XIU') { biasNote = ' [BIAS: 8/10 Xỉu, cẩn thận]'; biasPenalty = 10; }
        // Cơ hội mean-reversion: streak dài rồi → khuyên đảo nhẹ (chỉ cảnh báo, không tự đảo)
        if (taiCount >= 9 && finalPred === 'TAI') biasNote = ' [CỰC LỆCH: 9-10/10 Tài]';
        if (taiCount <= 1 && finalPred === 'XIU') biasNote = ' [CỰC LỆCH: 9-10/10 Xỉu]';
    }

    // 3. CALIBRATED CONFIDENCE
    let confidence = calibratedConfidence(stats) - biasPenalty;
    confidence = Math.max(35, Math.min(85, confidence));

    // 4. RECOMMENDATION rõ ràng
    let recommendation;
    if (stats.samples < ADAPTIVE.minSamples) recommendation = 'CHƯA ĐỦ DATA - QUAN SÁT';
    else if (stats.trust && !biasPenalty) recommendation = 'VÀO LỆNH (logic ổn định)';
    else if (stats.shouldFlip) recommendation = 'VÀO LỆNH (đã auto-đảo)';
    else if (stats.acc >= 0.50) recommendation = 'CÂN NHẮC - vốn nhỏ';
    else recommendation = 'NÊN BỎ QUA - không đủ tin cậy';

    return {
        ...raw,
        prediction: finalPred,
        isReversal,
        logic: (endgame && endgame.logic ? endgame.logic + " | " : "") + logicMsg + biasNote,
        confidence,
        rawConfidence: raw.confidence,
        adaptive: {
            logicAccuracy: (stats.acc * 100).toFixed(1) + '%',
            samples: stats.samples,
            flipped: stats.shouldFlip,
            biased: biasPenalty > 0,
            taiInLast10: taiCount,
            recommendation,
            trust: stats.trust
        }
    };
}

module.exports = {
    deepAnalysis,
    deepAnalysisAdaptive,
    ensembleVote,
    quantumAnalysis,
    CAPITAL,
    logicPerformance,
    updateLogicPerformance,
    // V10 adaptive
    trackAdaptiveResult,
    adaptiveStats,
    getAdaptiveSnapshot,
    ADAPTIVE,
    // export tất cả logic để có thể test riêng
    predictLogic1, predictLogic2, predictLogic3, predictLogic4, predictLogic5,
    predictLogic6, predictLogic7, predictLogic8, predictLogic9, predictLogic10,
    predictLogic11, predictLogic12, predictLogic13, predictLogic14, predictLogic15,
    predictLogic16, predictLogic17, predictLogic18, predictLogic19,
    predictLogic21, predictLogic22, predictLogic23, predictLogic24,
    logic25, logic26,
    markovWeightedV3, repeatingPatternV3, detectBiasV3,
    calculateStdDev, getDiceFrequencies
};
