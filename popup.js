// 時間をフォーマット (分:秒)
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 日付をフォーマット
function formatDate(dateString) {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

// 今日の日付を取得 (YYYY-MM-DD形式)
function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// 使用状況を更新
async function updateUsageDisplay() {
  const today = getTodayKey();
  const result = await chrome.storage.local.get(['dailyLimit', 'usage']);

  const dailyLimit = result.dailyLimit || 60; // デフォルト60分
  const usage = result.usage || {};
  const todayUsage = usage[today] || 0;

  const dailyLimitSeconds = dailyLimit * 60;
  const remainingSeconds = Math.max(0, dailyLimitSeconds - todayUsage);

  document.getElementById('remainingTime').textContent = formatTime(remainingSeconds);
  document.getElementById('usedTime').textContent = formatTime(todayUsage);

  // 制限時間を入力欄に表示（フォーカスされていない場合のみ）
  const dailyLimitInput = document.getElementById('dailyLimit');
  if (document.activeElement !== dailyLimitInput) {
    dailyLimitInput.value = dailyLimit;
  }
}

// 使用履歴を表示
async function updateHistoryDisplay() {
  const result = await chrome.storage.local.get(['usage']);
  const usage = result.usage || {};
  const historyContainer = document.getElementById('historyContainer');

  // 日付でソート (新しい順)
  const sortedDates = Object.keys(usage).sort().reverse();

  if (sortedDates.length === 0) {
    historyContainer.innerHTML = '<div class="no-history">履歴がありません</div>';
    return;
  }

  historyContainer.innerHTML = '';

  // 最新7件（1週間分）を表示
  sortedDates.slice(0, 7).forEach(date => {
    const seconds = usage[date];
    const minutes = Math.floor(seconds / 60);

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <span class="history-date">${formatDate(date)}</span>
      <span class="history-time">${minutes}分</span>
    `;
    historyContainer.appendChild(item);
  });
}

// 設定を保存
async function saveDailyLimit() {
  const dailyLimit = parseInt(document.getElementById('dailyLimit').value);
  const messageDiv = document.getElementById('saveMessage');

  if (isNaN(dailyLimit) || dailyLimit < 1 || dailyLimit > 1440) {
    messageDiv.textContent = '1〜1440分の範囲で入力してください';
    messageDiv.className = 'message error';
    setTimeout(() => {
      messageDiv.textContent = '';
      messageDiv.className = 'message';
    }, 3000);
    return;
  }

  await chrome.storage.local.set({ dailyLimit });

  messageDiv.textContent = '保存しました';
  messageDiv.className = 'message success';
  setTimeout(() => {
    messageDiv.textContent = '';
    messageDiv.className = 'message';
  }, 2000);

  // 表示を更新
  updateUsageDisplay();
}

// イベントリスナーを設定
document.addEventListener('DOMContentLoaded', () => {
  updateUsageDisplay();
  updateHistoryDisplay();

  document.getElementById('saveButton').addEventListener('click', saveDailyLimit);

  // Enterキーでも保存できるように
  document.getElementById('dailyLimit').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveDailyLimit();
    }
  });

  // 全ての履歴を見るリンク
  document.getElementById('viewAllHistory').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  // 1秒ごとに使用状況を更新
  setInterval(updateUsageDisplay, 1000);
});

// ストレージの変更を監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.usage) {
    updateUsageDisplay();
    updateHistoryDisplay();
  }
});
