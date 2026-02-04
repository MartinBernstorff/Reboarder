import ReboarderPlugin from 'src/ReboarderPlugin';
import { SNOOZE_INTERVAL_KEY, SNOOZE_EXPIRE_KEY, parseISODateTime, type ExpireTime } from 'Main';
import { PluginSettingTab, App, Setting, TFile } from 'obsidian';

export class ReboarderSettingTab extends PluginSettingTab {
	plugin: ReboarderPlugin;

	constructor(app: App, plugin: ReboarderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Card preview length')
			.setDesc('Maximum number of characters to show in card previews')
			.addText(text => text
				.setPlaceholder('200')
				.setValue(this.plugin.settings.cardPreviewLength.toString())
				.onChange(async (value) => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.cardPreviewLength = parsed;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Default snooze duration')
			.setDesc('Default number of hours for custom snooze')
			.addText(text => text
				.setPlaceholder('24')
				.setValue(this.plugin.settings.defaultSnoozeHours.toString())
				.onChange(async (value) => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.defaultSnoozeHours = parsed;
						await this.plugin.saveSettings();
					}
				}));

		containerEl.createEl('h3', { text: 'Excluded Folders' });
		containerEl.createEl('p', {
			text: 'Folders to exclude from boards (one per line)',
			cls: 'setting-item-description'
		});

		// Snoozed notes (frontmatter) section
		containerEl.createEl('h3', { text: 'Snoozed Notes' });
		containerEl.createEl('p', { text: 'Notes currently snoozed (data stored in each note frontmatter).', cls: 'setting-item-description' });
		const snoozeContainer = containerEl.createEl('div', { cls: 'reboarder-snooze-list' });

		const refreshSnoozeList = () => {
			snoozeContainer.empty();
			const files = this.app.vault.getMarkdownFiles();
			const entries: { file: TFile; interval: number; expire: ExpireTime; }[] = [];
			files.forEach(f => {
				const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
				if (!fm) return;
				const interval = fm[SNOOZE_INTERVAL_KEY];
				const expire = fm[SNOOZE_EXPIRE_KEY];
				if (typeof interval === 'number' && typeof expire === 'string') {
					entries.push({ file: f, interval, expire: expire as ExpireTime });
				}
			});
			if (entries.length === 0) {
				snoozeContainer.createEl('div', { text: 'No snoozed notes' });
				return;
			}
			entries.sort((a, b) => parseISODateTime(a.expire).getTime() - parseISODateTime(b.expire).getTime()).forEach(entry => {
				const { file, interval, expire } = entry;
				const row = snoozeContainer.createEl('div', { cls: 'reboarder-snooze-row' });
				row.createEl('div', { text: file.name, cls: 'reboarder-snooze-name' });
				row.createEl('div', { text: file.path, cls: 'reboarder-snooze-path' });
				row.createEl('div', { text: `${interval}h`, cls: 'reboarder-snooze-interval' });
				row.createEl('div', { text: expire, cls: 'reboarder-snooze-expire' });
				const status = Date.now() < parseISODateTime(expire).getTime() ? 'active' : 'expired';
				row.createEl('div', { text: status, cls: `reboarder-snooze-status status-${status}` });
				const clearBtn = row.createEl('button', { text: 'Clear', cls: 'reboarder-snooze-clear' });
				clearBtn.addEventListener('click', async () => {
					// Update the file record in the collection to clear snooze info
					await this.plugin.fileCollection.update(file.name, (draft) => {
						draft.snoozeInfo = {
							interval: undefined,
							expireTime: undefined,
						};
					});
					refreshSnoozeList();
				});
			});
		};

		const expiredBtn = containerEl.createEl('button', { text: 'Remove expired snoozes', cls: 'mod-warning' });
		expiredBtn.addEventListener('click', async () => {
			const now = Date.now();
			const files = this.app.vault.getMarkdownFiles();
			for (const f of files) {
				const entry = this.plugin.getSnoozeEntry(f);
				if (entry && parseISODateTime(entry.expire).getTime() <= now) {
					// Update the file record in the collection to clear snooze info
					await this.plugin.fileCollection.update(f.basename, (draft) => {
						draft.snoozeInfo = {
							interval: undefined,
							expireTime: undefined,
						};
					});
				}
			}
			refreshSnoozeList();
		});

		refreshSnoozeList();
	}
}
