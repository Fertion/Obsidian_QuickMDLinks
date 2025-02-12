const { Plugin, TFile, Notice, Editor, FuzzySuggestModal } = require("obsidian");

class FileSuggestModal extends FuzzySuggestModal {
  constructor(app, files, onChoose) {
    super(app);
    this.files = files;
    this.onChoose = onChoose;
  }

  getItems() {
    return this.files;
  }

  getItemText(file) {
    const metadata = this.app.metadataCache.getFileCache(file);
    const aliases = metadata?.frontmatter?.aliases;
    if (Array.isArray(aliases) && aliases.length > 0) {
      return `${aliases[0]} (${file.path})`;
    }
    return file.path;
  }

  onChooseItem(file) {
    this.onChoose(file);
  }
}

module.exports = class QuickLinkPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: "quick-link",
      name: "Quick link",
      editorCallback: (editor, view) => this.handleLinkCreation(editor, view),
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        menu.addItem((item) => {
          item
            .setTitle("Quick link")
            .setIcon("link")
            .onClick(async () => {
              await this.handleLinkCreation(editor, view);
            });
        });
      })
    );
  }

  async handleLinkCreation(editor, view) {
    try {
      const { from, to, text } = this.getSelectionContext(editor);
      if (!text) {
        new Notice("Please select text or place cursor on a word");
        return;
      }

      const file = await this.selectFile();
      if (!file) return;

      const link = this.createMarkdownLink(text, file, view);
      editor.replaceRange(link, from, to);
    } catch (error) {
      new Notice(`Error: ${error.message}`);
      console.error("QuickLink Error:", error);
    }
  }

  getSelectionContext(editor) {
    const selection = editor.getSelection();
    if (selection) {
      return {
        from: editor.getCursor("from"),
        to: editor.getCursor("to"),
        text: selection,
      };
    }

    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const nonWordRegex = /[^\p{L}\p{N}_-]/u;

    let start = cursor.ch;
    let end = cursor.ch;

    while (start > 0 && !nonWordRegex.test(line[start - 1])) start--;
    while (end < line.length && !nonWordRegex.test(line[end])) end++;

    return {
      from: { line: cursor.line, ch: start },
      to: { line: cursor.line, ch: end },
      text: line.slice(start, end),
    };
  }

  createMarkdownLink(text, targetFile, sourceView) {
    return this.app.fileManager.generateMarkdownLink(
      targetFile,
      sourceView.file?.path || "",
      "",
      text,
      undefined
    );
  }

  async selectFile() {
    return new Promise((resolve) => {
      const files = this.app.vault.getFiles();
      new FileSuggestModal(this.app, files, resolve).open();
    });
  }
};
