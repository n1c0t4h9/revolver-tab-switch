/* Section 1: Variable Declaration and Event Listeners */
/* global chrome */
const bg = chrome.extension.getBackgroundPage();

// Restores saved values from localStorage.
const restoreOptions = () => {
  const appSettings = localStorage["revolverSettings"] 
    ? JSON.parse(localStorage["revolverSettings"]) 
    : {};

  document.getElementById("seconds").value = appSettings.seconds || 10;
  document.getElementById("reload").checked = appSettings.reload || false;
  document.getElementById("inactive").checked = appSettings.inactive || false;
  document.getElementById("autostart").checked = appSettings.autostart || false;

  let noRefreshList = appSettings.noRefreshList || [];
  noRefreshList = noRefreshList.filter(item => item !== "");
  document.getElementById("noRefreshList").value = noRefreshList.join("\n");
}

const addEventListeners = () => {
  restoreOptions();
  if (localStorage["revolverAdvSettings"]) restoreAdvancedOptions();
  buildCurrentTabsList();
  document.querySelector('#save').addEventListener('click', saveAllOptions);
}

document.addEventListener('DOMContentLoaded', addEventListeners);

/* Section 2: Variable Declaration and Event Listeners */
// Asynchronously get current tabs
const getCurrentTabs = () => {
  return new Promise((resolve, reject) => {
    chrome.windows.getCurrent({populate: true}, (window) => {
      const returnTabs = window.tabs.filter(tab => tab.url.substring(0,16) != "chrome-extension");
      resolve(returnTabs);
    });
  });
}

//Base options code
const saveBaseOptions = async () => {
  const appSettings = {
    seconds: document.getElementById("seconds").value,
    reload: document.getElementById("reload").checked,
    inactive: document.getElementById("inactive").checked,
    autostart: document.getElementById("autostart").checked,
    noRefreshList: document.getElementById('noRefreshList').value.split('\n')
  };

  bg.timeDelay = (appSettings.seconds * 1000);
  bg.reload = appSettings.reload;
  bg.inactive = appSettings.inactive;
  bg.autostart = appSettings.autostart;
  bg.noRefreshList = appSettings.noRefreshList;

  document.getElementById("status").innerHTML = "OPTIONS SAVED";
  setTimeout(() => document.getElementById("status").innerHTML = "", 1000);
  localStorage["revolverSettings"] = JSON.stringify(appSettings);
}

/* Section 3: Advanced Options */
// Advanced options code
const saveAdvancedOptions = () => {
  const advancedSettings = document.getElementById("adv-settings");
  const advancedDivs = advancedSettings.getElementsByTagName("div");
  const advUrlObjectArray = [];

  for (const advancedDiv of advancedDivs) {
    if (advancedDiv.getElementsByClassName("enable")[0].checked) {
      const divInputTags = advancedDiv.getElementsByTagName("input");
      advUrlObjectArray.push({
        url: advancedDiv.getElementsByClassName("url-text")[0].value,
        reload: divInputTags[3].checked,
        seconds: divInputTags[2].value,
        favIconUrl: advancedDiv.getElementsByClassName("icon")[0].src,
      });
    }
  }

  localStorage["revolverAdvSettings"] = JSON.stringify(advUrlObjectArray);
  
  chrome.runtime.getBackgroundPage((bg) => {
    bg.updateSettings();

    document.getElementById("status3").innerHTML = "OPTIONS SAVED";
    setTimeout(() => document.getElementById("status3").innerHTML = "", 1000);
  });
}

const restoreAdvancedOptions = () => {
  const settings = JSON.parse(localStorage["revolverAdvSettings"]);
  if(settings.length>0){
    settings.forEach(setting => generateAdvancedSettingsHtml(setting, true));
  }
}

/* Section 4: Helper Functions */
const generateAdvancedSettingsHtml = (tab, saved = false) => {
    const advancedSettings = document.getElementsByClassName("adv-settings")[0];

    let enableHtmlChunk = '<div><input type="checkbox" class="enable" name="enable">';
    let secondsChunk = '<p><label for="seconds">Seconds:</label> <input type="text" name="seconds" value="10" style="width:30px;">';
    let reloadChunk = '<label class="inline" for="reload">Reload:</label> <input type="checkbox" name="reload"></p></div>';

    const iconAndUrlChunk = '<img class="icon" src='+tab.favIconUrl+'\><input class="url-text" type="text" value="'+tab.url+'">';

    if(saved) { 
        enableHtmlChunk = '<div><input type="checkbox" class="enable" name="enable" checked>';
        secondsChunk = '<p><label for="seconds">Seconds:</label> <input type="text" name="seconds" value="'+tab.seconds+'" style="width:30px;">';
        if(tab.reload){
            reloadChunk = '<label class="inline" for="reload">Reload:</label> <input type="checkbox" name="reload" checked></p></div>';    
        } 
    }
    advancedSettings.innerHTML += enableHtmlChunk + iconAndUrlChunk + secondsChunk + reloadChunk;
};

const compareSavedAndCurrentUrls = async () => {
    const savedTabsUrls = JSON.parse(localStorage["revolverAdvSettings"]).map(save => save.url);
    const allCurrentTabs = await getCurrentTabs();

    const currentTabsUrls = allCurrentTabs.map(tab => tab.url);

    const urlsToWrite = currentTabsUrls.filter(url => !savedTabsUrls.includes(url));

    return urlsToWrite;
}

/* Section 5: Building Current Tab List and Saving Options */
const buildCurrentTabsList = async () => {
    const allCurrentTabs = await getCurrentTabs();

    if(localStorage["revolverAdvSettings"]){
        const urls = await compareSavedAndCurrentUrls();
        for(const url of urls){
            for(const tab of allCurrentTabs){
                if(url === tab.url){
                    generateAdvancedSettingsHtml(tab);
                }
            }
        } 
        createAdvancedSaveButton();
    } else {
        allCurrentTabs.forEach(tab => generateAdvancedSettingsHtml(tab));
        createAdvancedSaveButton();
    }
}

const saveAllOptions = async () => {
    await saveBaseOptions();
    await saveAdvancedOptions();
}

const createAdvancedSaveButton = () => {
    const parent = document.querySelector("#adv-settings");
    const advSaveButton = document.createElement("button");
    const advSaveIndicator = document.createElement("span");

    advSaveButton.setAttribute("id", "adv-save");
    advSaveButton.innerText = "Save";
    advSaveButton.addEventListener("click", saveAllOptions);

    advSaveIndicator.setAttribute("id", "status3");

    parent.appendChild(advSaveButton);
    parent.appendChild(advSaveIndicator); 
}
