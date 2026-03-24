// Load browser polyfill for Chrome service worker
// Firefox will load this via the scripts array in manifest.json
if (typeof importScripts !== 'undefined') {
  importScripts('browser-polyfill.min.js');
}

function injectContent(tabId) {
  console.log(`ADO Syntax Highlighter: Injecting into custom host on tab ${tabId}`);
  browser.scripting.insertCSS({
    target: { tabId: tabId },
    files: ["prism/prism.css", "custom_styles.css"],
  }).catch(err => console.warn(`CSS injection warning: ${err.message}`));

  browser.scripting.executeScript({
    target: { tabId: tabId },
    files: ["browser-polyfill.min.js", "prism/prism.min.js", "content_script.js"],
  });
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url || !tab.url.startsWith('http')) {
    return;
  }

  const manifest = browser.runtime.getManifest();
  const defaultHosts = manifest.host_permissions || [];
  const isDefaultHost = defaultHosts.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return regex.test(tab.url);
  });

  if (isDefaultHost) {
    return;
  }

  const { customHosts = [] } = await browser.storage.sync.get('customHosts');
  if (customHosts.length === 0) {
    return;
  }

  for (const pattern of customHosts) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');

    if (regex.test(tab.url)) {
      console.log(`URL "${tab.url}" matched custom pattern "${pattern}". Injecting scripts.`);
      injectContent(tabId);
      return;
    }
  }
});
