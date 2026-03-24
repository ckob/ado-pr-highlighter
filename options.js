const hostInput = document.getElementById('host-input');
const addHostBtn = document.getElementById('add-host-btn');
const hostsList = document.getElementById('hosts-list');
const defaultHostsList = document.getElementById('default-hosts-list');

const patternInput = document.getElementById('pattern-input');
const languageSelect = document.getElementById('language-select');
const addPatternBtn = document.getElementById('add-pattern-btn');
const patternsList = document.getElementById('patterns-list');
const themeSelect = document.getElementById('theme-select');

async function loadThemePreference() {
  const { themePreference = 'auto' } = await browser.storage.sync.get('themePreference');
  themeSelect.value = themePreference;
}

themeSelect.addEventListener('change', async () => {
  const themePreference = themeSelect.value;
  await browser.storage.sync.set({ themePreference });
});

function populateLanguageDropdown() {
  // Get all available Prism languages (filter out helper methods)
  const languages = Object.keys(Prism.languages)
    .filter(lang => typeof Prism.languages[lang] !== 'function')
    .sort();

  // Populate the dropdown
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    languageSelect.appendChild(option);
  });
}

function createCustomHostListItem(host) {
  const listItem = document.createElement('li');
  listItem.textContent = host;

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.marginLeft = '10px';
  removeBtn.addEventListener('click', () => removeHost(host));

  listItem.appendChild(removeBtn);
  hostsList.appendChild(listItem);
}

function loadDefaultHosts() {
  const manifest = browser.runtime.getManifest();
  const defaultHosts = manifest.host_permissions || [];

  defaultHostsList.innerHTML = '';
  for (const host of defaultHosts) {
    const listItem = document.createElement('li');
    listItem.textContent = host;
    defaultHostsList.appendChild(listItem);
  }
}

async function loadCustomHosts() {
  const { customHosts = [] } = await browser.storage.sync.get('customHosts');
  hostsList.innerHTML = '';
  for (const host of customHosts) {
    createCustomHostListItem(host);
  }
}

async function addHost() {
  let hostValue = hostInput.value.trim();
  if (!hostValue) return;

  hostValue = hostValue.replace(/\/+$/, '');

  const permissionPattern = `*://${hostValue}/*`;

  try {
    const granted = await browser.permissions.request({
      origins: [permissionPattern]
    });

    if (granted) {
      const { customHosts = [] } = await browser.storage.sync.get('customHosts');
      if (!customHosts.includes(permissionPattern)) {
        const updatedHosts = [...customHosts, permissionPattern];
        await browser.storage.sync.set({ customHosts: updatedHosts });
        createCustomHostListItem(permissionPattern);
      }
      hostInput.value = '';
    } else {
      console.warn('Permission was not granted by the user.');
    }
  } catch (err) {
    console.error(`Error requesting permission: ${err}`);
    alert(`Could not request permission for "${hostValue}". Please ensure it's a valid hostname.`);
  }
}

async function removeHost(hostToRemove) {
  try {
    const removed = await browser.permissions.remove({
      origins: [hostToRemove]
    });

    if (removed) {
      const { customHosts = [] } = await browser.storage.sync.get('customHosts');
      const updatedHosts = customHosts.filter(h => h !== hostToRemove);
      await browser.storage.sync.set({ customHosts: updatedHosts });
      loadCustomHosts();
    } else {
      console.warn('Could not remove permission.');
    }
  } catch (err) {
    console.error(`Error removing permission: ${err}`);
  }
}

addHostBtn.addEventListener('click', addHost);

hostInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addHost();
  }
});

function createCustomPatternListItem(pattern, language) {
  const listItem = document.createElement('li');
  listItem.innerHTML = `<code>${pattern}</code> → <code>${language}</code>`;

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.marginLeft = '10px';
  removeBtn.addEventListener('click', () => removePattern(pattern));

  listItem.appendChild(removeBtn);
  patternsList.appendChild(listItem);
}

async function loadCustomPatterns() {
  const { customFilePatterns = {} } = await browser.storage.sync.get('customFilePatterns');
  patternsList.innerHTML = '';
  for (const [pattern, language] of Object.entries(customFilePatterns)) {
    createCustomPatternListItem(pattern, language);
  }
}

async function addPattern() {
  const pattern = patternInput.value.trim();
  const language = languageSelect.value;

  if (!pattern || !language) {
    alert('Please enter a file pattern and select a language.');
    return;
  }

  const { customFilePatterns = {} } = await browser.storage.sync.get('customFilePatterns');
  customFilePatterns[pattern] = language;
  await browser.storage.sync.set({ customFilePatterns });

  createCustomPatternListItem(pattern, language);
  patternInput.value = '';
  languageSelect.value = '';
}

async function removePattern(patternToRemove) {
  const { customFilePatterns = {} } = await browser.storage.sync.get('customFilePatterns');
  delete customFilePatterns[patternToRemove];
  await browser.storage.sync.set({ customFilePatterns });
  loadCustomPatterns();
}

addPatternBtn.addEventListener('click', addPattern);

patternInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addPattern();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  populateLanguageDropdown();
  loadDefaultHosts();
  loadCustomHosts();
  loadCustomPatterns();
  loadThemePreference();
});
