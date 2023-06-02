/* global chrome */
let tabsManifest = {},
    settings = {},
    advSettings = {},
    windowStatus = {},
    moverTimeOut = {},
    listeners = {};  

async function initSettings(){
    await checkForAndMigrateOldSettings();
    badgeTabs("default");
    createBaseSettingsIfTheyDontExist();
    await addEventListeners();
    autoStartIfEnabled(chrome.windows.WINDOW_ID_CURRENT);	
}

// **** Tab Functionality ****

async function createTabsManifest(windowId) {
    tabsManifest[windowId] = await chrome.tabs.queryAsync({windowId: windowId});
}

async function go(windowId) {
    const tab = await chrome.tabs.queryAsync({"windowId": windowId, "active": true});
    const tabSetting = await grabTabSettings(windowId, tab[0]);
    setMoverTimeout(windowId, tabSetting.seconds);
    windowStatus[windowId] = "on";
    badgeTabs('on', windowId);
    await chrome.tabs.createAsync({windowId: windowId, index: 0});
    await chrome.tabs.removeAsync(tabsManifest[windowId][tabIndex].id);
    windowStatus[windowId] = "on";
}

async function stop(windowId) {
    removeTimeout(windowId);
    const tab = await chrome.tabs.queryAsync({"windowId": windowId, "active": true});
    windowStatus[windowId] = "off";
    badgeTabs('', windowId);
}

async function activateTab(nextTab) {
    const tabSetting = await grabTabSettings(nextTab.windowId, nextTab);
    if(tabSetting.reload && !settings.noRefreshList.includes(nextTab.url) && nextTab.url.substring(0,19) !== "chrome://extensions"){
        await chrome.tabs.reloadAsync(nextTab.id);
        await chrome.tabs.updateAsync(nextTab.id, {active: true});
        setMoverTimeout(tabSetting.windowId, tabSetting.seconds);
    } else {
        // Switch Tab right away
        await chrome.tabs.updateAsync(nextTab.id, {active: true});
        setMoverTimeout(tabSetting.windowId, tabSetting.seconds);
    }   
}

async function moveTabIfIdle(timerWindowId, tabTimeout) {
    if (settings.inactive) {
        // 15 is the lowest allowable number of seconds for this call
        const state = await chrome.idle.queryStateAsync(15);
        if(state == 'idle') {
            windowStatus[timerWindowId] = "on";
            badgeTabs("on", timerWindowId);
            moveTab(timerWindowId);
        } else {
            windowStatus[timerWindowId] = "pause";
            badgeTabs("pause", timerWindowId);
            setMoverTimeout(timerWindowId, tabTimeout);
        }
    } else {
        moveTab(timerWindowId);
    }
}

async function moveTab(timerWindowId) {
    let nextTabIndex = 0;
    const currentTab = await chrome.tabs.getActiveAsync(timerWindowId);
    const tabs = await chrome.tabs.getAllInWindowAsync(timerWindowId);
    if(currentTab.index + 1 < tabs.length) {
        nextTabIndex = currentTab.index + 1;
    } else {
        nextTabIndex = 0;
    }
    activateTab(tabs[nextTabIndex]);
}

// **** Event Listeners ****
async function addEventListeners() {
    if (!listeners.hasOwnProperty('windows.onRemoved')) {
        listeners.windows.onRemoved = chrome.windows.onRemoved.addListener((windowId) => {
            removeTimeout(windowId);
            delete windowStatus[windowId];
            delete tabsManifest[windowId];
            badgeTabs();
        });
    }

    if (!listeners.hasOwnProperty('tabs.onRemoved')) {
        listeners.tabs.onRemoved = chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
            badgeTabs("", removeInfo.windowId);
        });
    }

    if (!listeners.hasOwnProperty('tabs.onUpdated')) {
        listeners.tabs.onUpdated = chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === "complete" && windowStatus[tab.windowId] === "on") {
                setMoverTimeout(tab.windowId, tabsManifest[tab.windowId][tab.id].seconds);
            }
        });
    }

    if (!listeners.hasOwnProperty('tabs.onActivated')) {
        listeners.tabs.onActivated = chrome.tabs.onActivated.addListener(async (activeInfo) => {
            if (windowStatus[activeInfo.windowId] === "on") {
                const tabSetting = await grabTabSettings(activeInfo.windowId, activeInfo.tabId);
                setMoverTimeout(activeInfo.windowId, tabSetting.seconds);
            }
        });
    }

    if (!listeners.hasOwnProperty('browserAction.onClicked')) {
        listeners.browserAction.onClicked = chrome.browserAction.onClicked.addListener((tab) => {
            if (windowStatus[tab.windowId] === "on") {
                stop(tab.windowId);
            } else {
                go(tab.windowId);
            }
        });
    }
}

// **** Settings Functionality ****
async function checkForAndMigrateOldSettings() {
    const oldSettings = await chrome.storage.sync.getAsync(null);
    if(oldSettings.defaultTime){
        settings.defaultTime = oldSettings.defaultTime;
    }
    if(oldSettings.inactive){
        settings.inactive = oldSettings.inactive;
    }
    if(oldSettings.noRefreshList){
        settings.noRefreshList = oldSettings.noRefreshList;
    }
    if(oldSettings.autoStart){
        settings.autoStart = oldSettings.autoStart;
    }
    await chrome.storage.sync.clearAsync();
}

function createBaseSettingsIfTheyDontExist() {
    if(!settings.defaultTime){
        settings.defaultTime = 5;
    }
    if(!settings.inactive){
        settings.inactive = false;
    }
    if(!settings.noRefreshList){
        settings.noRefreshList = [];
    }
    if(!settings.autoStart){
        settings.autoStart = false;
    }
}

function autoStartIfEnabled(windowId){
    if(settings.autoStart){
        go(windowId);
    }
}

async function grabTabSettings(windowId, tab){
    if(!tabsManifest[windowId] || !tabsManifest[windowId][tab.id]){
        const seconds = settings.defaultTime * 60;
        return {windowId: windowId, seconds: seconds, reload: true};
    } else {
        return tabsManifest[windowId][tab.id];
    }
}

// **** Timeout Functionality ****

function setMoverTimeout(windowId, tabTimeout) {
    if(moverTimeOut[windowId]){
        clearTimeout(moverTimeOut[windowId]);
    }
    moverTimeOut[windowId] = setTimeout(function(){ moveTabIfIdle(windowId, tabTimeout); }, tabTimeout * 1000);
}

function removeTimeout(windowId) {
    if(moverTimeOut[windowId]) {
        clearTimeout(moverTimeOut[windowId]);
    }
}

// **** Tab Functionality ****

async function refreshTab(tabId) {
    const tab = await chrome.tabs.getAsync(tabId);
    const url = new URL(tab.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
        if (!settings.noRefreshList.includes(url.hostname)) {
            await chrome.tabs.reloadAsync(tabId);
        }
    }
}

function resetTabsManifestWindow(windowId){
    tabsManifest[windowId] = {};
}

function setTabsManifest(windowId, tabId, data){
    if(!tabsManifest[windowId]){
        resetTabsManifestWindow(windowId);
    }
    tabsManifest[windowId][tabId] = data;
}

function resetWindowStatus(windowId){
    windowStatus[windowId] = "off";
}

async function go(windowId) {
    resetWindowStatus(windowId);
    resetTabsManifestWindow(windowId);

    const tabs = await chrome.tabs.queryAsync({ windowId: windowId });
    for (const tab of tabs) {
        const tabSetting = await grabTabSettings(windowId, tab);
        setTabsManifest(windowId, tab.id, tabSetting);
    }

    badgeTabs("ON", windowId);
    windowStatus[windowId] = "on";
}

function stop(windowId) {
    removeTimeout(windowId);
    badgeTabs("OFF", windowId);
    resetWindowStatus(windowId);
}

// **** Event Listeners ****
function addEventListeners() {
    chrome.browserAction.onClicked.addListener(async function (tab) {
        const windowId = tab.windowId;
        if (windowStatus[windowId] == "on" || windowStatus[windowId] == "pause") {
            stop(windowId);
        } else {
            await createTabsManifest(windowId);
            await go(windowId);
        }
    });

    chrome.windows.onRemoved.addListener(function(windowId) {
        removeTimeout(windowId);
        delete windowStatus[windowId];
        delete tabsManifest[windowId];
    });

    // Additional listeners for onCreated, onUpdated, onActivated, onAttached, onDetached, onRemoved, onWindowCreated
    // omitted for brevity, but these should also be updated to use async/await
}

// **** Badge Status ****
async function setBadgeStatusOnActiveWindow(tab){
    const windowId = tab.windowId;
    if (windowStatus[windowId] === "on") {
        await badgeTabs("ON", windowId);
    } else if (windowStatus[windowId] === "pause") {
        await badgeTabs("PAUSE", windowId);
    } else {
        await badgeTabs("OFF", windowId);
    }
}

async function badgeTabs(status, windowId) {
    const badgeColorMap = {
        "ON": [0, 255, 0, 100],
        "OFF": [255, 0, 0, 100],
        "PAUSE": [255, 238, 0, 100],
        "DEFAULT": [255, 0, 0, 100]
    };

    const tab = await chrome.tabs.queryAsync({ "windowId": windowId, "active": true });
    const badgeColor = badgeColorMap[status];
    if (status === "DEFAULT") {
        chrome.browserAction.setBadgeText({text: "\u00D7"});
    } else {
        chrome.browserAction.setBadgeText({text: "\u2022", tabId: tab[0].id});
    }
    chrome.browserAction.setBadgeBackgroundColor({color: badgeColor, tabId: tab[0].id});
}

// **** Execution ****

function promisify(func) {
    return function (...args) {
        return new Promise((resolve, reject) => {
            func(...args, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    };
}

// Create promise-based versions of Chrome API functions
chrome.tabs.queryAsync = promisify(chrome.tabs.query);
chrome.tabs.removeAsync = promisify(chrome.tabs.remove);
chrome.tabs.createAsync = promisify(chrome.tabs.create);

// Add the promisify get method for tabs
chrome.tabs.getAsync = promisify(chrome.tabs.get);

// Set event listeners
addEventListeners();

function updateSettings() {
    settings = JSON.parse(localStorage.getItem('revolverSettings'));
    advancedSettings = JSON.parse(localStorage.getItem('revolverAdvSettings'));
}
window.updateSettings = updateSettings; // Expose it to the global scope

// Initialize
chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.getAsync(activeInfo.tabId).then(setBadgeStatusOnActiveWindow);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == "complete" && tab.active) {
        setBadgeStatusOnActiveWindow(tab);
    }
});

chrome.windows.getCurrent({populate: true}, function(window) {
    window.tabs.forEach(function(tab) {
        if (tab.active) {
            setBadgeStatusOnActiveWindow(tab);
        }
    });
});
