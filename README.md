# Syntax Highlighter for Azure DevOps

A browser extension that brings syntax highlighting to file diffs in Azure DevOps, including Pull Requests. Making code reviews easier and more efficient.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/lclohacjbfchomeeopaffkedfnbjicdn?style=for-the-badge&logo=google-chrome&logoColor=white&label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/lclohacjbfchomeeopaffkedfnbjicdn)
[![Firefox Add-on](https://img.shields.io/amo/v/syntax-highlighter-for-ado?style=for-the-badge&logo=firefox&logoColor=white&label=Firefox%20Add-ons)](https://addons.mozilla.org/firefox/addon/syntax-highlighter-for-ado/)

## Features

- **Syntax Highlighting:** Automatically applies syntax highlighting to code in pull request diffs.
- **Language Detection:** Detects the programming language based on file extensions.
- **Theme Support:** Seamlessly integrates with both light and dark themes in Azure DevOps.
- **Powered by Prism:** Utilizes the popular [Prism](https://prismjs.com/) library for fast and accurate highlighting.
- **Cross-Browser Support:** Available for both Chrome and Firefox.
- **Custom Domains Support**: Works with self-hosted (on-premise) and other custom Azure DevOps domains via a simple configuration page.
- **Custom File Type Mapping:** Map specific file patterns (e.g., `*.myext`, `myfile.ext`) to a syntax highlighting language of your choice.

## Screenshots

### Before & After

![Before and After](assets/screenshots/before-after-1280-800.png)

### Side-by-side Diff

![Side-by-side Diff](assets/screenshots/side-by-side-1280-800.png)

### Inline Diff

![Inline Diff](assets/screenshots/inline-1280-800.png)

## Installation

### Chrome

#### From the Chrome Web Store (Recommended)

[Available in the Chrome Web Store](https://chromewebstore.google.com/detail/lclohacjbfchomeeopaffkedfnbjicdn?utm_source=github)

#### From GitHub Releases (Manual)

1.  Go to the [**latest release**](https://github.com/ckob/ado-syntax-highlighter/releases/latest).
2.  Download the `chrome-extension.zip` file.
3.  Unzip the file (you will get a folder named `chrome-extension`).
4.  Open Google Chrome and navigate to `chrome://extensions`.
5.  Enable "Developer mode" in the top right corner.
6.  Click "Load unpacked" and select the unzipped `chrome-extension` folder.

### Firefox

#### From the Firefox Add-on Store (Recommended)

[Available in the Firefox Add-on Store](https://addons.mozilla.org/firefox/addon/syntax-highlighter-for-ado/)

#### From GitHub Releases (Manual)

1.  Go to the [**latest release**](https://github.com/ckob/ado-syntax-highlighter/releases/latest).
2.  Download the `firefox-extension.zip` file.
3.  Unzip the file (you will get a folder named `firefox-extension`)
4.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
5.  Click "Load Temporary Add-on".
6.  Navigate to the extension directory and select the `manifest.json` file.

**Note:** This is a temporary add-on and will need to be reloaded every time you restart Firefox.

## Usage

Once installed, the extension will automatically apply syntax highlighting to files in any Azure DevOps pull request you view. There are no additional steps required.

## Configuration

![Options Page](assets/screenshots/options-page.png)

The extension's options page allows you to customize its behavior. You can access it through your browser's extension management page, usually by right-clicking the extension icon and selecting "Options".

### Custom Host Permissions

If you use a self-hosted or custom domain for Azure DevOps (e.g., `devops.mycompany.com`), you'll need to grant the extension permission to access it.

1.  Open the extension options.
2.  In the "Manage Custom Hosts" section, enter the hostname (e.g., `devops.mycompany.com`).
3.  Click "Add Host". Your browser will ask you to confirm the permission.

### Custom File Type Mappings

You can override the default language detection by mapping specific file patterns to a language. This is useful for files with non-standard extensions or for file types that aren't automatically recognized.

1.  Open the extension options.
2.  Go to the "Custom File Type Mappings" section.
3.  Enter a file pattern (e.g., `*.myext`, `Jenkinsfile`, `*.config.json`).
4.  Select the desired language from the dropdown.
5.  Click "Add Pattern".

Custom patterns take priority over the default language detection.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

### Building from Source

1.  Clone this repository.
2.  Run `make package`. This will build and zip both extensions into the `/dist` directory.
3.  You can then load the unpacked build directories (`dist/chrome_build` and `dist/firefox_build`) into your browser for testing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.