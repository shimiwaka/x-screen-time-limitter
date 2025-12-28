let isXTabActive = false;
let currentTabId = null;
let countInterval = null;

// 今日の日付を取得 (YYYY-MM-DD形式)
function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// URLがXのページかチェック
function isXUrl(url) {
  if (!url) return false;
  return url.startsWith('https://x.com/') || url.startsWith('https://twitter.com/');
}

// 使用時間を1秒増やす
async function incrementUsage() {
  const today = getTodayKey();
  const result = await chrome.storage.local.get(['usage']);
  const usage = result.usage || {};

  usage[today] = (usage[today] || 0) + 1;

  await chrome.storage.local.set({ usage });

  // コンテンツスクリプトに更新を通知
  if (currentTabId) {
    try {
      await chrome.tabs.sendMessage(currentTabId, {
        type: 'UPDATE_TIMER',
        usage: usage[today]
      });
    } catch (error) {
      // タブが閉じられた場合などはエラーを無視
    }
  }
}

// カウントを開始
function startCounting(tabId) {
  if (countInterval) return; // 既に開始している場合は何もしない

  currentTabId = tabId;
  isXTabActive = true;

  // 1秒ごとに使用時間を増やす
  countInterval = setInterval(incrementUsage, 1000);
}

// カウントを停止
function stopCounting() {
  if (countInterval) {
    clearInterval(countInterval);
    countInterval = null;
  }

  isXTabActive = false;
  currentTabId = null;
}

// アクティブタブをチェック
async function checkActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    stopCounting();
    return;
  }

  if (isXUrl(tab.url)) {
    startCounting(tab.id);
  } else {
    stopCounting();
  }
}

// タブのアクティブ状態が変わった時
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);

  if (isXUrl(tab.url)) {
    startCounting(tab.id);
  } else {
    stopCounting();
  }
});

// タブのURLが変わった時
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab && activeTab.id === tabId) {
      if (isXUrl(changeInfo.url)) {
        startCounting(tabId);
      } else {
        stopCounting();
      }
    }
  }
});

// ウィンドウのフォーカスが変わった時
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // ウィンドウがフォーカスを失った
    stopCounting();
  } else {
    // ウィンドウがフォーカスを得た
    await checkActiveTab();
  }
});

// タブが閉じられた時
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === currentTabId) {
    stopCounting();
  }
});

// 拡張機能がインストールされた時の初期設定
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['dailyLimit']);

  // デフォルトの制限時間を設定 (60分)
  if (!result.dailyLimit) {
    await chrome.storage.local.set({ dailyLimit: 60 });
  }

  // 現在のタブをチェック
  await checkActiveTab();
});

// コンテンツスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_USAGE') {
    (async () => {
      const today = getTodayKey();
      const result = await chrome.storage.local.get(['dailyLimit', 'usage']);
      const dailyLimit = result.dailyLimit || 60;
      const usage = result.usage || {};
      const todayUsage = usage[today] || 0;

      sendResponse({
        dailyLimit: dailyLimit * 60, // 秒に変換
        usage: todayUsage
      });
    })();

    return true; // 非同期レスポンスを示す
  }
});

// 初期チェック
checkActiveTab();
