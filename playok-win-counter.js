// ==UserScript==
// @name         PlayOK Reversi Total Win Counter
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Track total wins from a specific start date in PlayOK Reversi
// @author       umigamep
// @match        https://www.playok.com/*/reversi*
// @match        https://playok.com/*/reversi*
// @match        https://www.playok.com/*/stat.phtml*
// @match        https://playok.com/*/stat.phtml*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    console.log('PlayOK Counter: スクリプト開始');

    // 設定
    const CONFIG = {
        historyUpdateInterval: 5000,
        storagePrefix: 'playok_reversi_total_',
        gameCode: 'rv'
    };

    // 状態管理
    let gameState = {
        isTracking: false,
        trackingStartDate: null,
        myUsername: null,
        counterElement: null,
        lastHistoryCheck: 0,
        historyData: [],
        drawHandling: 'normal', // 'normal', 'half_point', 'black_wins'
        autoRefreshInterval: null // 自動更新タイマー
    };

    // CSS スタイルを追加
    GM_addStyle(`
        #reversi-total-counter {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.92);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            z-index: 10000;
            min-width: 280px;
            max-width: 340px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            border: 1px solid #444;
        }

        #reversi-total-counter .title {
            font-weight: bold;
            margin-bottom: 10px;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 6px;
            color: #4CAF50;
            font-size: 15px;
            text-align: center;
        }

        #reversi-total-counter .user-greeting {
            background: rgba(33, 150, 243, 0.15);
            border-left: 3px solid #2196F3;
            padding: 8px;
            margin: 8px 0;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
        }

        #reversi-total-counter .username {
            color: #2196F3;
            font-weight: bold;
        }

        #reversi-total-counter .section {
            margin: 8px 0;
            padding: 10px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 6px;
        }

        #reversi-total-counter .stats {
            background: rgba(255, 193, 7, 0.15);
            border-left: 3px solid #FFC107;
            text-align: center;
        }

        #reversi-total-counter .big-stats {
            font-size: 18px;
            font-weight: bold;
            margin: 8px 0;
        }

        #reversi-total-counter .wins { color: #4CAF50; font-weight: bold; }
        #reversi-total-counter .losses { color: #f44336; font-weight: bold; }
        #reversi-total-counter .draws { color: #FF9800; font-weight: bold; }

        #reversi-total-counter .input-group {
            margin: 8px 0;
        }

        #reversi-total-counter .datetime-group {
            display: flex;
            gap: 5px;
            align-items: flex-end;
        }

        #reversi-total-counter .datetime-group > div {
            flex: 1;
        }

        #reversi-total-counter label {
            display: block;
            margin-bottom: 4px;
            font-size: 11px;
            color: #ccc;
        }

        #reversi-total-counter input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #555;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 12px;
            box-sizing: border-box;
        }

        #reversi-total-counter button {
            border: none;
            color: white;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 11px;
            margin: 2px;
            transition: background-color 0.2s;
        }

        #reversi-total-counter .start-btn { background: #4CAF50; }
        #reversi-total-counter .stop-btn { background: #FF9800; }
        #reversi-total-counter .refresh-btn { background: #2196F3; }
        #reversi-total-counter .reset-btn { background: #f44336; }
        #reversi-total-counter .now-btn {
            background: #2196F3;
            padding: 6px 8px;
            font-size: 10px;
            white-space: nowrap;
        }

        #reversi-total-counter .buttons {
            margin-top: 12px;
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        #reversi-total-counter .buttons button {
            flex: 1;
            min-width: 70px;
        }

        #reversi-total-counter .status {
            font-size: 11px;
            margin: 8px 0;
            text-align: center;
            padding: 5px;
            border-radius: 4px;
        }

        #reversi-total-counter .tracking {
            background: rgba(76, 175, 80, 0.2);
            color: #4CAF50;
            font-weight: bold;
        }

        #reversi-total-counter .not-tracking {
            background: rgba(158, 158, 158, 0.2);
            color: #999;
        }

        #reversi-total-counter .loading { color: #2196F3; }
        #reversi-total-counter .error { color: #f44336; }

        #reversi-total-counter .last-update {
            font-size: 10px;
            color: #888;
            text-align: center;
            margin-top: 8px;
        }

        #reversi-total-counter .period-info {
            font-size: 11px;
            color: #aaa;
            text-align: center;
            margin: 5px 0;
        }

        #reversi-total-counter select {
            width: 100%;
            padding: 8px;
            border: 1px solid #555;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 11px;
            box-sizing: border-box;
            line-height: 1.2;
            min-height: 32px;
        }

        #reversi-total-counter select option {
            background: #333;
            color: white;
            padding: 4px 8px;
            line-height: 1.3;
        }
    `);

    // PlayOK Counterクラス
    class PlayOKCounter {
        constructor() {
            this.gameState = gameState;
            this.CONFIG = CONFIG;
            console.log('PlayOK Counter: クラス初期化');
        }

        // ユーザー名を取得
        getMyUsername() {
            // 既に保存されているユーザー名があれば使用
            const stored = GM_getValue('my_username', null);
            if (stored) {
                console.log('保存済みユーザー名を使用:', stored);
                return stored;
            }

            // 統計ページではユーザー名を自動取得しない（他人のページの可能性）
            if (window.location.href.includes('/stat.phtml')) {
                console.log('統計ページではユーザー名を自動取得しません');
                return null;
            }

            // ログイン中のユーザー名を検出するためのセレクター
            const loginSelectors = [
                'a[href*="/settings.phtml"]', // アカウント設定リンク
                'a[href*="/logout.phtml"]',   // ログアウトリンク
            ];

            for (const selector of loginSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    // アカウント設定リンクからユーザー名を抽出
                    const parent = element.parentElement;
                    if (parent) {
                        const text = parent.textContent;
                        const match = text.match(/--\s*([^\s]+)\s*--/);
                        if (match) {
                            const username = match[1];
                            console.log('アカウントリンクからユーザー名取得:', username);
                            GM_setValue('my_username', username);
                            return username;
                        }
                    }
                }
            }

            // ドロップダウンメニューからユーザー名を取得
            const dropdown = document.querySelector('select option[value=""]');
            if (dropdown && dropdown.textContent.includes('--')) {
                const match = dropdown.textContent.match(/--\s*([^\s]+)\s*--/);
                if (match) {
                    const username = match[1];
                    console.log('ドロップダウンからユーザー名取得:', username);
                    GM_setValue('my_username', username);
                    return username;
                }
            }

            console.log('ユーザー名を取得できませんでした');
            return null;
        }

        // 現在時刻を設定
        setCurrentDateTime() {
            console.log('現在時刻設定');
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

            const dateInput = document.getElementById('start-date-input');
            const timeInput = document.getElementById('start-time-input');

            if (dateInput) dateInput.value = dateStr;
            if (timeInput) timeInput.value = timeStr;
        }

        // 追跡開始
        startTracking() {
            console.log('=== 記録開始処理 ===');

            if (!this.gameState.myUsername) {
                console.log('エラー: ユーザー名なし');
                alert('ユーザー名が設定されていません。');
                return;
            }

            const startDateStr = document.getElementById('start-date-input')?.value || '';
            const startTimeStr = document.getElementById('start-time-input')?.value || '';

            let startDateTime;

            if (startDateStr && startTimeStr) {
                startDateTime = new Date(`${startDateStr}T${startTimeStr}`);
            } else if (startDateStr) {
                startDateTime = new Date(startDateStr);
            } else {
                startDateTime = new Date();
            }

            if (isNaN(startDateTime.getTime())) {
                alert('開始日時が正しくありません。');
                return;
            }

            this.gameState.isTracking = true;
            this.gameState.trackingStartDate = startDateTime;

            GM_setValue(`${this.CONFIG.storagePrefix}tracking_start_date`, startDateTime.toISOString());
            GM_setValue(`${this.CONFIG.storagePrefix}is_tracking`, true);

            console.log('記録開始完了:', startDateTime.toLocaleString());

            // 自動更新を開始
            this.startAutoRefresh();
            
            this.updateCounterDisplay();
            this.refreshHistory();
        }

        // 追跡停止
        stopTracking() {
            console.log('記録停止');
            this.gameState.isTracking = false;
            this.gameState.trackingStartDate = null;
            GM_setValue(`${this.CONFIG.storagePrefix}is_tracking`, false);
            
            // 自動更新を停止
            this.stopAutoRefresh();
            
            this.updateCounterDisplay();
        }

        // 設定リセット
        resetTracking() {
            if (confirm('記録設定をリセットしますか？')) {
                console.log('設定リセット');
                GM_setValue(`${this.CONFIG.storagePrefix}is_tracking`, false);
                GM_setValue(`${this.CONFIG.storagePrefix}tracking_start_date`, '');

                this.gameState.isTracking = false;
                this.gameState.trackingStartDate = null;
                this.gameState.historyData = [];
                
                // 自動更新を停止
                this.stopAutoRefresh();

                this.updateCounterDisplay();
            }
        }

        // 履歴更新
        refreshHistory() {
            console.log('履歴更新開始');

            if (!this.gameState.isTracking) {
                this.showError('記録が開始されていません');
                return;
            }

            if (!this.gameState.myUsername) {
                this.showError('ユーザー名が設定されていません');
                return;
            }

            this.showLoading('履歴を更新中...');

            // PlayOK統計ページから履歴データを取得
            const statUrl = `https://www.playok.com/ja/stat.phtml?u=${this.gameState.myUsername}&g=${this.CONFIG.gameCode}&sk=2`;
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: statUrl,
                onload: (response) => {
                    try {
                        this.parseHistoryData(response.responseText);
                    } catch (error) {
                        console.error('履歴解析エラー:', error);
                        this.showError('履歴の解析に失敗しました');
                    }
                },
                onerror: () => {
                    console.error('履歴取得エラー');
                    this.showError('履歴の取得に失敗しました');
                }
            });
        }

        // 履歴データを解析
        parseHistoryData(htmlText) {
            console.log('履歴データ解析開始');
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            // テーブル行を取得（ヘッダー行を除く）
            const rows = doc.querySelectorAll('table.ktb tr');
            const historyData = [];
            
            for (let i = 1; i < rows.length; i++) { // i=0はヘッダー行なのでスキップ
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                
                if (cells.length >= 3) {
                    // 日付と時刻を解析 (例: "2025-06-08 22:04 (1)")
                    const dateTimeText = cells[0].textContent.trim();
                    const dateTimeMatch = dateTimeText.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
                    
                    if (dateTimeMatch) {
                        const gameDateTime = new Date(dateTimeMatch[1]);
                        
                        // 追跡開始日時以降のゲームのみを対象とする
                        if (gameDateTime >= this.gameState.trackingStartDate) {
                            // プレイヤー情報を解析
                            const playersText = cells[1].textContent.trim();
                            
                            // 結果を解析 ("勝ち"、"負け"、"引き分け")
                            const resultText = cells[2].textContent.trim();
                            let result = 'unknown';
                            
                            if (resultText.includes('勝ち')) {
                                result = 'win';
                            } else if (resultText.includes('負け')) {
                                result = 'loss';
                            } else if (resultText.includes('引き分け') || resultText.includes('タイ') || resultText.includes('draw')) {
                                result = 'draw';
                            }
                            
                            // プレイヤーの位置を確認（黒番勝ちルール用）
                            const isUserFirst = playersText.indexOf(this.gameState.myUsername) < playersText.indexOf(' - ');
                            
                            historyData.push({
                                datetime: gameDateTime,
                                players: playersText,
                                result: result,
                                isUserFirst: isUserFirst,
                                resultText: resultText,
                                raw: dateTimeText
                            });
                        }
                    }
                }
            }
            
            this.gameState.historyData = historyData;
            this.gameState.lastHistoryCheck = Date.now();
            
            console.log(`履歴解析完了: ${historyData.length}件のゲーム`);
            this.updateCounterDisplay();
        }

        // ローディング表示
        showLoading(message) {
            const statusDiv = document.querySelector('#reversi-total-counter .status');
            if (statusDiv) {
                statusDiv.innerHTML = `<span class="loading">${message}</span>`;
            }
        }

        // エラー表示
        showError(message) {
            const statusDiv = document.querySelector('#reversi-total-counter .status');
            if (statusDiv) {
                statusDiv.innerHTML = `<span class="error">${message}</span>`;
            }
        }

        // 統計計算
        calculateStats() {
            const drawHandling = this.gameState.drawHandling;
            let wins = 0;
            let losses = 0;
            let draws = 0;
            
            this.gameState.historyData.forEach(game => {
                if (game.result === 'win') {
                    wins++;
                } else if (game.result === 'loss') {
                    losses++;
                } else if (game.result === 'draw') {
                    if (drawHandling === 'half_point') {
                        // 0.5勝0.5敗として扱う
                        wins += 0.5;
                        losses += 0.5;
                    } else if (drawHandling === 'black_wins') {
                        // 黒番（先手）の勝ちとして扱う
                        if (game.isUserFirst) {
                            wins++;
                        } else {
                            losses++;
                        }
                    } else {
                        // 通常の引き分け
                        draws++;
                    }
                }
            });
            
            const total = this.gameState.historyData.length;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
            
            return { 
                wins: drawHandling === 'half_point' ? wins.toFixed(1) : Math.round(wins),
                losses: drawHandling === 'half_point' ? losses.toFixed(1) : Math.round(losses),
                draws: Math.round(draws),
                total, 
                winRate 
            };
        }

        // カウンター表示更新
        updateCounterDisplay() {
            console.log('UI更新');

            if (!this.gameState.counterElement) {
                this.createCounterElement();
            }

            const total = this.gameState.historyData.length;
            const statusText = this.gameState.isTracking
                ? `<div class="tracking">📊 記録中</div>`
                : '<div class="not-tracking">⏸️ 記録停止中</div>';

            const userGreeting = this.gameState.myUsername
                ? `こんにちは、<span class="username">${this.gameState.myUsername}</span>さん`
                : '<span style="color: #f44336;">ユーザー名が取得できませんでした</span>';

            const lastUpdateText = this.gameState.lastHistoryCheck
                ? `最終更新: ${new Date(this.gameState.lastHistoryCheck).toLocaleTimeString()}`
                : '';

            const periodText = this.gameState.trackingStartDate
                ? `${this.gameState.trackingStartDate.toLocaleString()}から`
                : '';

            const startDateValue = this.gameState.trackingStartDate
                ? this.gameState.trackingStartDate.toISOString().split('T')[0]
                : '';
            const startTimeValue = this.gameState.trackingStartDate
                ? this.gameState.trackingStartDate.toTimeString().split(' ')[0].substring(0, 5)
                : '';

            this.gameState.counterElement.innerHTML = `
                <div class="title">🏆 PlayOK 戦績カウンター</div>

                <div class="user-greeting">
                    ${userGreeting}
                    ${!this.gameState.myUsername ? `
                        <div class="input-group" style="margin-top: 8px;">
                            <label>ユーザー名:</label>
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <input type="text" id="username-input" placeholder="ユーザー名を入力" style="flex: 1;">
                                <button class="refresh-btn" id="set-username-btn" style="font-size: 10px; padding: 6px 8px; white-space: nowrap;">設定</button>
                            </div>
                        </div>
                    ` : `
                        <div style="margin-top: 8px; text-align: center;">
                            <button class="refresh-btn" id="change-username-btn" style="font-size: 10px; padding: 4px 8px;">ユーザー名変更</button>
                        </div>
                    `}
                </div>

                <div class="status">${statusText}</div>

                <div class="input-group">
                    <label>記録開始日時:</label>
                    <div class="datetime-group">
                        <div><input type="date" id="start-date-input" value="${startDateValue}"></div>
                        <div><input type="time" id="start-time-input" value="${startTimeValue}"></div>
                        <button class="now-btn" id="set-now-btn">今</button>
                    </div>
                    <div style="font-size: 10px; color: #aaa; margin-top: 3px;">
                        空欄の場合は現在時刻から開始
                    </div>
                </div>

                <div class="input-group">
                    <label>引き分けの扱い:</label>
                    <select id="draw-handling-select">
                        <option value="normal" ${this.gameState.drawHandling === 'normal' ? 'selected' : ''}>引き分けとして扱う</option>
                        <option value="half_point" ${this.gameState.drawHandling === 'half_point' ? 'selected' : ''}>0.5勝0.5敗として扱う</option>
                        <option value="black_wins" ${this.gameState.drawHandling === 'black_wins' ? 'selected' : ''}>黒番（先手）の勝ちとして扱う</option>
                    </select>
                </div>

                ${this.gameState.isTracking && total > 0 ? `
                    <div class="section stats">
                        <div class="period-info">${periodText}</div>
                        <div class="big-stats">
                            <span class="wins">${this.calculateStats().wins}勝</span> -
                            <span class="losses">${this.calculateStats().losses}敗</span> -
                            <span class="draws">${this.calculateStats().draws}分</span>
                        </div>
                        <div>勝率: ${this.calculateStats().winRate}% (${total}戦)</div>
                    </div>
                ` : this.gameState.isTracking ? `
                    <div class="section stats">
                        <div class="period-info">${periodText}</div>
                        <div>まだ対戦データがありません</div>
                    </div>
                ` : ''}

                <div class="buttons">
                    ${!this.gameState.isTracking ?
                        '<button class="start-btn" id="start-tracking-btn">記録開始</button>' :
                        '<button class="stop-btn" id="stop-tracking-btn">記録停止</button>'
                    }
                    <button class="refresh-btn" id="refresh-history-btn">更新</button>
                    <button class="reset-btn" id="reset-tracking-btn">リセット</button>
                </div>

                ${lastUpdateText ? `<div class="last-update">${lastUpdateText}</div>` : ''}
            `;

            // イベントリスナーを設定
            this.setupEventListeners();
        }

        // カウンター要素作成
        createCounterElement() {
            console.log('カウンター要素作成');
            this.gameState.counterElement = document.createElement('div');
            this.gameState.counterElement.id = 'reversi-total-counter';
            document.body.appendChild(this.gameState.counterElement);
        }

        // イベントリスナー設定
        setupEventListeners() {
            console.log('イベントリスナー設定');

            const startBtn = document.getElementById('start-tracking-btn');
            const stopBtn = document.getElementById('stop-tracking-btn');
            const refreshBtn = document.getElementById('refresh-history-btn');
            const resetBtn = document.getElementById('reset-tracking-btn');
            const nowBtn = document.getElementById('set-now-btn');

            if (startBtn) {
                startBtn.onclick = () => {
                    console.log('記録開始ボタンクリック');
                    this.startTracking();
                };
            }

            if (stopBtn) {
                stopBtn.onclick = () => {
                    console.log('記録停止ボタンクリック');
                    this.stopTracking();
                };
            }

            if (refreshBtn) {
                refreshBtn.onclick = () => {
                    console.log('更新ボタンクリック');
                    this.refreshHistory();
                };
            }

            if (resetBtn) {
                resetBtn.onclick = () => {
                    console.log('リセットボタンクリック');
                    this.resetTracking();
                };
            }

            if (nowBtn) {
                nowBtn.onclick = () => {
                    console.log('現在時刻ボタンクリック');
                    this.setCurrentDateTime();
                };
            }

            const drawSelect = document.getElementById('draw-handling-select');
            if (drawSelect) {
                drawSelect.onchange = () => {
                    console.log('引き分け扱い変更:', drawSelect.value);
                    this.gameState.drawHandling = drawSelect.value;
                    GM_setValue(`${this.CONFIG.storagePrefix}draw_handling`, drawSelect.value);
                    this.updateCounterDisplay();
                };
            }

            const setUsernameBtn = document.getElementById('set-username-btn');
            if (setUsernameBtn) {
                setUsernameBtn.onclick = () => {
                    console.log('ユーザー名設定ボタンクリック');
                    this.setUsernameManually();
                };
            }

            const changeUsernameBtn = document.getElementById('change-username-btn');
            if (changeUsernameBtn) {
                changeUsernameBtn.onclick = () => {
                    console.log('ユーザー名変更ボタンクリック');
                    this.changeUsername();
                };
            }

            // Enterキーでユーザー名設定
            const usernameInput = document.getElementById('username-input');
            if (usernameInput) {
                usernameInput.onkeypress = (e) => {
                    if (e.key === 'Enter') {
                        this.setUsernameManually();
                    }
                };
            }
        }

        // 自動更新開始
        startAutoRefresh() {
            // 既存のタイマーがあればクリア
            if (this.gameState.autoRefreshInterval) {
                clearInterval(this.gameState.autoRefreshInterval);
            }
            
            console.log('自動更新開始:', this.CONFIG.historyUpdateInterval + 'ms間隔');
            
            this.gameState.autoRefreshInterval = setInterval(() => {
                if (this.gameState.isTracking && this.gameState.myUsername) {
                    console.log('自動更新実行');
                    this.refreshHistory();
                }
            }, this.CONFIG.historyUpdateInterval);
        }
        
        // 自動更新停止
        stopAutoRefresh() {
            if (this.gameState.autoRefreshInterval) {
                console.log('自動更新停止');
                clearInterval(this.gameState.autoRefreshInterval);
                this.gameState.autoRefreshInterval = null;
            }
        }

        // 手動でユーザー名を設定
        setUsernameManually() {
            const usernameInput = document.getElementById('username-input');
            if (usernameInput) {
                // 入力フィールドから取得
                const username = usernameInput.value.trim();
                if (username) {
                    this.gameState.myUsername = username;
                    GM_setValue('my_username', username);
                    console.log('手動でユーザー名設定:', username);
                    this.updateCounterDisplay();
                } else {
                    alert('ユーザー名を入力してください。');
                }
            } else {
                // フォールバック: promptを使用
                const username = prompt('ユーザー名を入力してください:');
                if (username && username.trim()) {
                    this.gameState.myUsername = username.trim();
                    GM_setValue('my_username', username.trim());
                    console.log('手動でユーザー名設定:', username.trim());
                    this.updateCounterDisplay();
                }
            }
        }

        // ユーザー名変更
        changeUsername() {
            const username = prompt('新しいユーザー名を入力してください:', this.gameState.myUsername);
            if (username && username.trim()) {
                this.gameState.myUsername = username.trim();
                GM_setValue('my_username', username.trim());
                console.log('ユーザー名変更:', username.trim());
                this.updateCounterDisplay();
                
                // 追跡中の場合は履歴を更新
                if (this.gameState.isTracking) {
                    this.refreshHistory();
                }
            }
        }

        // 初期化
        initialize() {
            console.log('PlayOK Counter: 初期化開始');

            this.gameState.myUsername = this.getMyUsername();
            console.log('ユーザー名:', this.gameState.myUsername || 'なし');

            // 保存された設定を復元
            this.gameState.isTracking = GM_getValue(`${this.CONFIG.storagePrefix}is_tracking`, false);
            this.gameState.drawHandling = GM_getValue(`${this.CONFIG.storagePrefix}draw_handling`, 'normal');
            const startDateStr = GM_getValue(`${this.CONFIG.storagePrefix}tracking_start_date`, null);
            if (startDateStr) {
                this.gameState.trackingStartDate = new Date(startDateStr);
            }

            // UI表示
            this.updateCounterDisplay();

            // 追跡中の場合は履歴を取得し、自動更新を開始
            if (this.gameState.isTracking && this.gameState.myUsername) {
                this.refreshHistory();
                this.startAutoRefresh();
            }

            console.log('PlayOK Counter: 初期化完了');
        }
    }

    // インスタンス作成と初期化
    const counter = new PlayOKCounter();

    // ページロード完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => counter.initialize());
    } else {
        counter.initialize();
    }

    console.log('PlayOK Counter: スクリプト読み込み完了');

})();