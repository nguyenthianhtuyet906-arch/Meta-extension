document.addEventListener('DOMContentLoaded', () => {
    const setBtn = document.getElementById('setDoraBtn');
    const offBtn = document.getElementById('offDoraBtn');
    const statusEl = document.getElementById('doraStatus');
    const trackingStatusEl = document.getElementById('doraTrackingStatus');
    const setTrackingBtn = document.getElementById('setDoraTrackingBtn');
    const offTrackingBtn = document.getElementById('offDoraTrackingBtn');

    function setStatusText(text) {
        statusEl.textContent = text;
    }

    function setTrackingStatusText(text) {
        if (trackingStatusEl) trackingStatusEl.textContent = text;
    }

    function sendMsgWithTimeout(msg, timeoutMs = 2000) {
        return new Promise((resolve) => {
            let done = false;
            const timer = setTimeout(() => {
                if (done) return;
                done = true;
                resolve({ __timeout: true });
            }, timeoutMs);
            try {
                chrome.runtime.sendMessage(msg, (resp) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    const err = chrome.runtime.lastError;
                    if (err) {
                        console.warn('[popup] sendMessage error:', err.message, msg);
                        resolve({ __error: err.message });
                    } else {
                        resolve(resp);
                    }
                });
            } catch (e) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                console.warn('[popup] sendMessage threw:', e, msg);
                resolve({ __error: String(e) });
            }
        });
    }

    function updateStatus() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            const urlEl = document.getElementById('currentUrl');
            if (!tab) {
                setStatusText('no active tab');
                setTrackingStatusText('no active tab');
                if (urlEl) urlEl.textContent = '';
                return;
            }

            if (urlEl) urlEl.textContent = tab.url || '';

            // Default text immediately so UI never sticks at "checking…"
            setStatusText('Not Dora Tab');
            setTrackingStatusText('Not Dora Tracking');

            sendMsgWithTimeout({ action: 'checkDoraTabStatus', tabId: tab.id }).then((resp) => {
                if (resp && resp.__timeout) {
                    setStatusText('background not responding');
                } else if (resp && resp.__error) {
                    setStatusText('error: ' + resp.__error);
                } else {
                    setStatusText(resp && resp.isDoraTab ? 'This is Dora Tab' : 'Not Dora Tab');
                }
            });

            sendMsgWithTimeout({ action: 'checkDoraTrackingStatusByTabId', tabId: tab.id }).then((resp) => {
                if (resp && resp.__timeout) {
                    setTrackingStatusText('background not responding');
                } else if (resp && resp.__error) {
                    setTrackingStatusText('error: ' + resp.__error);
                } else {
                    setTrackingStatusText(resp && resp.isDoraTracking ? 'This is Dora Tracking' : 'Not Dora Tracking');
                }
            });
        });
    }

    // initial status
    updateStatus();
    
    // Handle Set Dora button click
    if (setBtn) {
        setBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab) return;
                
                // Send message to background to set this tab as Dora tab
                chrome.runtime.sendMessage({ 
                    action: 'setDoraTabFromPopup', 
                    tabId: tab.id 
                }, (response) => {
                    if (response && response.success) {
                        updateStatus();
                    }
                });
            });
        });
    }
    
    // Handle Off Dora button click
    if (offBtn) {
        offBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab) return;
                
                // Send message to background to turn off Dora tab
                chrome.runtime.sendMessage({ 
                    action: 'offDoraTabFromPopup', 
                    tabId: tab.id 
                }, (response) => {
                    if (response && response.success) {
                        updateStatus();
                    }
                });
            });
        });
    }

    // Handle Set Dora Tracking button click
    if (setTrackingBtn) {
        setTrackingBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab) return;
                chrome.runtime.sendMessage({
                    action: 'setDoraTrackingFromPopup',
                    tabId: tab.id
                }, (response) => {
                    if (response && response.success) updateStatus();
                });
            });
        });
    }

    // Handle Off Dora Tracking button click
    if (offTrackingBtn) {
        offTrackingBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs && tabs[0];
                if (!tab) return;
                chrome.runtime.sendMessage({
                    action: 'offDoraTrackingFromPopup',
                    tabId: tab.id
                }, (response) => {
                    if (response && response.success) updateStatus();
                });
            });
        });
    }

    // Sync Now button
    const syncNowBtn = document.getElementById('syncNowBtn');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'triggerSyncNow' }, (resp) => {
                if (resp && resp.success) {
                    setStatusText('Sync triggered');
                } else {
                    setStatusText('Sync failed to trigger');
                }
            });
        });
    }

    // Schedule UI
    const scheduleMode = document.getElementById('scheduleMode');
    const intervalRow = document.getElementById('intervalRow');
    const timesRow = document.getElementById('timesRow');
    const intervalHours = document.getElementById('intervalHours');
    const timesInput = document.getElementById('timesInput');
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    const clearScheduleBtn = document.getElementById('clearScheduleBtn');

    function updateScheduleUI() {
        const mode = scheduleMode.value;
        intervalRow.style.display = mode === 'interval' ? 'block' : 'none';
        timesRow.style.display = mode === 'times' ? 'block' : 'none';
    }

    if (scheduleMode) scheduleMode.addEventListener('change', updateScheduleUI);

    if (saveScheduleBtn) {
        saveScheduleBtn.addEventListener('click', () => {
            const mode = scheduleMode.value;
            const schedule = { mode: mode };
            if (mode === 'interval') {
                schedule.intervalHours = parseInt(intervalHours.value, 10) || 1;
            } else if (mode === 'times') {
                const arr = (timesInput.value || '').split(',').map(s => s.trim()).filter(Boolean);
                schedule.times = arr;
            }
            chrome.runtime.sendMessage({ action: 'setSyncSchedule', schedule: schedule }, (resp) => {
                if (resp && resp.success) setStatusText('Schedule saved');
                else setStatusText('Failed to save schedule');
            });
        });
    }

    if (clearScheduleBtn) {
        clearScheduleBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'clearSyncSchedule' }, (resp) => {
                if (resp && resp.success) setStatusText('Schedule cleared');
                else setStatusText('Failed to clear schedule');
            });
        });
    }

    // load current schedule
    chrome.runtime.sendMessage({ action: 'getSyncSchedule' }, (resp) => {
        if (resp && resp.schedule) {
            const s = resp.schedule;
            scheduleMode.value = s.mode || 'off';
            if (s.mode === 'interval' && s.intervalHours) intervalHours.value = s.intervalHours;
            if (s.mode === 'times' && Array.isArray(s.times)) timesInput.value = s.times.join(',');
            updateScheduleUI();
        } else {
            scheduleMode.value = 'off';
            updateScheduleUI();
        }
    });

    // update when active tab changes or finishes loading
    if (chrome.tabs && chrome.tabs.onActivated) chrome.tabs.onActivated.addListener(updateStatus);
    if (chrome.tabs && chrome.tabs.onUpdated) chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo && changeInfo.status === 'complete') updateStatus();
    });
});
