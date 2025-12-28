let timerElement = null;
let currentUsage = 0;
let dailyLimit = 0;

// 時間をフォーマット (分:秒)
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// タイマー要素を作成
function createTimerElement() {
  if (timerElement) return;

  timerElement = document.createElement('div');
  timerElement.id = 'x-screen-time-timer';
  timerElement.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    background-color: rgba(29, 161, 242, 0.95);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    user-select: none;
  `;

  document.body.appendChild(timerElement);
}

// タイマーを更新
function updateTimer() {
  if (!timerElement) return;

  const remaining = Math.max(0, dailyLimit - currentUsage);
  timerElement.textContent = `残り時間: ${formatTime(remaining)}`;

  // 時間切れの場合は背景を赤くする
  if (remaining === 0) {
    document.body.style.backgroundColor = '#fee2e2';
    timerElement.style.backgroundColor = 'rgba(220, 38, 38, 0.95)';
  } else {
    document.body.style.backgroundColor = '';
    timerElement.style.backgroundColor = 'rgba(29, 161, 242, 0.95)';
  }
}

// 使用時間を取得
async function fetchUsage() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_USAGE' });
    dailyLimit = response.dailyLimit;
    currentUsage = response.usage;
    updateTimer();
  } catch (error) {
    console.error('Failed to fetch usage:', error);
  }
}

// バックグラウンドからのメッセージを受信
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_TIMER') {
    currentUsage = message.usage;
    updateTimer();
  }
});

// ストレージの変更を監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.dailyLimit) {
    dailyLimit = changes.dailyLimit.newValue * 60; // 秒に変換
    updateTimer();
  }
});

// 初期化
(async function init() {
  createTimerElement();
  await fetchUsage();

  // 1秒ごとに更新 (バックグラウンドからの更新を補完)
  setInterval(fetchUsage, 5000);
})();
