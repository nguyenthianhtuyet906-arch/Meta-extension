let doraTabId = null;
let doraTrackingTabId = null;

// Create context menu items
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "setDoraTab",
    title: "Set as Dora Tab",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.etsy.com/message*"],
  });

  chrome.contextMenus.create({
    id: "offDoraTab",
    title: "Off Dora Tab",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.etsy.com/message*"],
  });

  chrome.contextMenus.create({
    id: "setDoraTracking",
    title: "Set as Dora Tracking",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.etsy.com/*"],
  });

  chrome.contextMenus.create({
    id: "offDoraTracking",
    title: "Off Dora Tracking",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.etsy.com/*"],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "setDoraTab") {
    if (doraTabId !== null && doraTabId !== tab.id) {
      chrome.tabs.sendMessage(doraTabId, { action: "doraTabStatus", isDoraTab: false });
    }

    doraTabId = tab.id;
    chrome.storage.local.set({doraTabId: tab.id});
    chrome.tabs.sendMessage(tab.id, { action: "doraTabStatus", isDoraTab: true });
  }

  if (info.menuItemId === "offDoraTab") {
    if (doraTabId === tab.id) {
      doraTabId = null;
      chrome.storage.local.remove('doraTabId');
      chrome.tabs.sendMessage(tab.id, { action: "doraTabStatus", isDoraTab: false });
    }
  }

  if (info.menuItemId === "setDoraTracking") {
    if (doraTrackingTabId !== null && doraTrackingTabId !== tab.id) {
      chrome.tabs.sendMessage(doraTrackingTabId, { action: "doraTrackingStatus", isDoraTracking: false });
    }
    doraTrackingTabId = tab.id;
    chrome.storage.local.set({ doraTrackingTabId: tab.id });
    chrome.tabs.sendMessage(tab.id, { action: "doraTrackingStatus", isDoraTracking: true });
  }

  if (info.menuItemId === "offDoraTracking") {
    if (doraTrackingTabId === tab.id) {
      doraTrackingTabId = null;
      chrome.storage.local.remove('doraTrackingTabId');
      chrome.tabs.sendMessage(tab.id, { action: "doraTrackingStatus", isDoraTracking: false });
    }
  }
});

// Handle tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === doraTabId) {
    doraTabId = null;
    chrome.storage.local.remove('doraTabId');
  }
  if (tabId === doraTrackingTabId) {
    doraTrackingTabId = null;
    chrome.storage.local.remove('doraTrackingTabId');
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "isDoraTab") {
    const tabId = sender.tab ? sender.tab.id : null;
    sendResponse({ isDoraTab: tabId !== null && tabId === doraTabId });
    return;
  }

  if (request.action === "checkDoraTabStatus") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    chrome.storage.local.get(['doraTabId'], (result) => {
      const isDoraTab = tabId !== null && result.doraTabId === tabId;
      if (isDoraTab) doraTabId = tabId;
      sendResponse({ isDoraTab: isDoraTab });
    });
    return true;
  }

  if (request.action === "checkDoraTrackingStatus") {
    const tabId = request.tabId || (sender.tab ? sender.tab.id : null);
    chrome.storage.local.get(['doraTrackingTabId'], (result) => {
      const isDoraTracking = tabId !== null && result.doraTrackingTabId === tabId;
      if (isDoraTracking) doraTrackingTabId = tabId;
      sendResponse({ isDoraTracking: isDoraTracking });
    });
    return true;
  }
  
  // Handle Set Dora Tab from popup
  if (request.action === 'setDoraTabFromPopup' && request.tabId) {
    if (doraTabId !== null && doraTabId !== request.tabId) {
      // Notify old Dora tab that it's no longer active
      chrome.tabs.sendMessage(doraTabId, { action: "doraTabStatus", isDoraTab: false }).catch(() => {});
    }
    
    doraTabId = request.tabId;
    chrome.storage.local.set({doraTabId: request.tabId});
    chrome.tabs.sendMessage(request.tabId, { action: "doraTabStatus", isDoraTab: true }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
  
  // Handle Off Dora Tab from popup
  if (request.action === 'offDoraTabFromPopup' && request.tabId) {
    if (doraTabId === request.tabId) {
      doraTabId = null;
      chrome.storage.local.remove('doraTabId');
      chrome.tabs.sendMessage(request.tabId, { action: "doraTabStatus", isDoraTab: false }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }

  // Handle Set Dora Tracking from popup
  if (request.action === 'setDoraTrackingFromPopup' && request.tabId) {
    if (doraTrackingTabId !== null && doraTrackingTabId !== request.tabId) {
      chrome.tabs.sendMessage(doraTrackingTabId, { action: "doraTrackingStatus", isDoraTracking: false }).catch(() => {});
    }
    doraTrackingTabId = request.tabId;
    chrome.storage.local.set({ doraTrackingTabId: request.tabId });
    chrome.tabs.sendMessage(request.tabId, { action: "doraTrackingStatus", isDoraTracking: true }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  // Handle Off Dora Tracking from popup
  if (request.action === 'offDoraTrackingFromPopup' && request.tabId) {
    if (doraTrackingTabId === request.tabId) {
      doraTrackingTabId = null;
      chrome.storage.local.remove('doraTrackingTabId');
      chrome.tabs.sendMessage(request.tabId, { action: "doraTrackingStatus", isDoraTracking: false }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }

  // Handle Off Dora Tracking from content script (badge Off button)
  if (request.action === 'offDoraTrackingFromPage') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && doraTrackingTabId === tabId) {
      doraTrackingTabId = null;
      chrome.storage.local.remove('doraTrackingTabId');
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'checkDoraTrackingStatusByTabId' && request.tabId) {
    chrome.storage.local.get(['doraTrackingTabId'], (result) => {
      sendResponse({ isDoraTracking: result.doraTrackingTabId === request.tabId });
    });
    return true;
  }

  // Trigger immediate sync (from popup)
  if (request.action === 'triggerSyncNow') {
    const targetTab = doraTabId || (request.tabId || null);
    if (targetTab) {
      chrome.tabs.sendMessage(targetTab, { action: 'triggerSync' }, (resp) => {
        sendResponse({ success: true, resp });
      });
      return true;
    } else {
      // Try active tab as fallback
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const t = tabs && tabs[0];
        if (t) {
          chrome.tabs.sendMessage(t.id, { action: 'triggerSync' }, (resp) => {
            sendResponse({ success: true, resp });
          });
        } else {
          sendResponse({ success: false, error: 'no-target-tab' });
        }
      });
      return true;
    }
  }

  // Sync schedule management
  if (request.action === 'setSyncSchedule' && request.schedule) {
    const schedule = request.schedule;
    chrome.storage.local.set({ doraSyncSchedule: schedule }, () => {
      // recreate alarms
      setupSyncAlarms(schedule).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err && err.message });
      });
    });
    return true;
  }

  if (request.action === 'clearSyncSchedule') {
    chrome.storage.local.remove('doraSyncSchedule', () => {
      clearSyncAlarms().then(() => sendResponse({ success: true })).catch((e) => sendResponse({ success: false, error: e && e.message }));
    });
    return true;
  }

  if (request.action === 'getSyncSchedule') {
    chrome.storage.local.get(['doraSyncSchedule'], (result) => {
      sendResponse({ schedule: result.doraSyncSchedule || null });
    });
    return true;
  }
});


// Helper: clear existing dora-sync alarms
async function clearSyncAlarms() {
  return new Promise((resolve, reject) => {
    chrome.alarms.getAll((alarms) => {
      const names = alarms.filter(a => a.name && a.name.startsWith('dora-sync-')).map(a => a.name);
      if (names.length === 0) return resolve();
      let remaining = names.length;
      names.forEach(n => {
        chrome.alarms.clear(n, (wasCleared) => {
          remaining -= 1;
          if (remaining === 0) resolve();
        });
      });
    });
  });
}

// Helper: set up alarms based on schedule
async function setupSyncAlarms(schedule) {
  await clearSyncAlarms();
  if (!schedule || schedule.mode === 'off') return;

  if (schedule.mode === 'interval' && schedule.intervalHours && schedule.intervalHours > 0) {
    const minutes = schedule.intervalHours * 60;
    chrome.alarms.create('dora-sync-interval', { periodInMinutes: minutes });
    return;
  }

  if (schedule.mode === 'times' && Array.isArray(schedule.times)) {
    const now = new Date();
    schedule.times.forEach(timeStr => {
      const [hh, mm] = timeStr.split(':').map(s => parseInt(s, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) return;
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
      if (next.getTime() <= now.getTime()) {
        // schedule for next day
        next.setDate(next.getDate() + 1);
      }
      const name = `dora-sync-time-${String(hh).padStart(2, '0')}-${String(mm).padStart(2, '0')}`;
      chrome.alarms.create(name, { when: next.getTime(), periodInMinutes: 24 * 60 });
    });
    return;
  }
}

// On alarm: trigger sync on Dora tab or active tab
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name || !alarm.name.startsWith('dora-sync-')) return;
  const targetTab = doraTabId;
  if (targetTab) {
    chrome.tabs.sendMessage(targetTab, { action: 'triggerSync' }, () => {});
  } else {
    // fallback to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs && tabs[0];
      if (t) chrome.tabs.sendMessage(t.id, { action: 'triggerSync' }, () => {});
    });
  }
});

// Restore doraTabId and doraTrackingTabId on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['doraTabId', 'doraTrackingTabId'], (result) => {
    if (result.doraTabId) doraTabId = result.doraTabId;
    if (result.doraTrackingTabId) doraTrackingTabId = result.doraTrackingTabId;
  });
  // restore sync schedule alarms if any
  chrome.storage.local.get(['doraSyncSchedule'], (result) => {
    if (result && result.doraSyncSchedule) {
      setupSyncAlarms(result.doraSyncSchedule).catch(() => {});
    }
  });
});

// Also restore on installed
chrome.runtime.onInstalled && chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['doraSyncSchedule'], (result) => {
    if (result && result.doraSyncSchedule) {
      setupSyncAlarms(result.doraSyncSchedule).catch(() => {});
    }
  });
});