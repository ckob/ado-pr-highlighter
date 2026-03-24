# --- Config ---
DIST_DIR := dist
CHROME_BUILD := $(DIST_DIR)/chrome_build
FIREFOX_BUILD := $(DIST_DIR)/firefox_build
CHROME_ZIP := $(DIST_DIR)/chrome-extension.zip
FIREFOX_ZIP := $(DIST_DIR)/firefox-extension.zip

# --- Source Files ---
COMMON_FILES := \
	background.js \
	content_script.js \
	custom_styles.css \
	options.html \
	options.js \
	options.css \
	LICENSE

COMMON_DIRS := \
	assets

# --- Primary Targets ---
all: chrome firefox
package: package-chrome package-firefox

clean:
	@echo "Cleaning..."
	@rm -rf $(DIST_DIR)

# --- Build Macros ---
# Arguments:
# 1: Build Directory
# 2: Manifest File
define build-extension
	@echo "Building for $(1)..."
	@rm -rf $(1)
	@mkdir -p $(1)
	@cp $(COMMON_FILES) $(1)/
	@cp -r $(COMMON_DIRS) $(1)/
	@mkdir -p $(1)/prism
	@cp prism/prism.js $(1)/prism/
	@echo "Generating scoped prism.css for $(1)..."
	@rm -f $(1)/prism/prism.css
	@for f in prism/themes/*.css; do \
		name=$$(basename $$f .css); \
		echo ".$${name} {" >> $(1)/prism/prism.css; \
		cat $$f >> $(1)/prism/prism.css; \
		echo "}" >> $(1)/prism/prism.css; \
	done
	@cp $(2) $(1)/manifest.json
	@echo "Minifying assets for $(1)..."
	@npx terser browser-polyfill.js -o $(1)/browser-polyfill.min.js --comments false
	@npx terser prism/prism.js -o $(1)/prism/prism.min.js --comments false
	@rm $(1)/prism/prism.js
endef

# --- Build Targets ---
chrome:
	$(call build-extension,$(CHROME_BUILD),manifest.chrome.json)

firefox:
	$(call build-extension,$(FIREFOX_BUILD),manifest.firefox.json)

# --- Package (Zip) Targets ---
package-chrome: chrome
	@echo "Zipping Chrome..."
	@rm -f $(CHROME_ZIP)
	@cd $(CHROME_BUILD) && zip -r ../$(notdir $(CHROME_ZIP)) . -x "*.DS_Store"

package-firefox: firefox
	@echo "Zipping Firefox..."
	@rm -f $(FIREFOX_ZIP)
	@cd $(FIREFOX_BUILD) && zip -r ../$(notdir $(FIREFOX_ZIP)) . -x "*.DS_Store"

.PHONY: all package clean chrome firefox package-chrome package-firefox