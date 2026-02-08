import { App, TFile } from "obsidian";

export class Workspace {
    static async openAndFocusFile(file: TFile, app: App): Promise<void> {
        const leaf = app.workspace.getLeaf('tab');
        await leaf.openFile(file);
        app.workspace.setActiveLeaf(leaf, { focus: true });
    }
}